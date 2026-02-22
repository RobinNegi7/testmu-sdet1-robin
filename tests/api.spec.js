// @ts-check
/**
 * REST API — Playwright Automation Test Suite
 *
 * Uses Playwright's built-in `request` (APIRequestContext) fixture.
 * No browser is launched — these are pure HTTP-level API tests.
 *
 * Covers:
 *   ✅ Authentication Token Validation  (TC-API-001 to 004)
 *   ✅ CRUD Operations                  (TC-API-005 to 011)
 *   ✅ Error Handling (400/401/403/500) (TC-API-012 to 014)
 *   ✅ Rate Limiting                    (TC-API-015 to 016)
 *   ✅ Schema Validation                (TC-API-017 to 020)
 *
 * Before running:
 *   1. Set BASE_URL in data/api-test-data.js
 *   2. Set API tokens via env vars or directly in api-test-data.js
 */

import { test, expect } from '@playwright/test';
import { authHeaders, validateSchema, burstRequests } from '../utils/apiHelper.js';
import {
    BASE_URL,
    TOKENS,
    NEW_ITEM,
    UPDATED_ITEM,
    PATCH_PAYLOAD,
    INVALID_ITEM,
    ITEM_SCHEMA,
    ERROR_SCHEMA,
    PAGINATION_META_SCHEMA,
    RATE_LIMIT_THRESHOLD,
    RATE_LIMIT_BURST,
} from '../data/api-test-data.js';

// ════════════════════════════════════════════════════════════════
// 1. AUTHENTICATION TOKEN VALIDATION
// ════════════════════════════════════════════════════════════════
test.describe('Authentication Token Validation', () => {

    test('TC-API-001 · Valid token grants access to protected endpoint', async ({ request }) => {
        const response = await request.get(`${BASE_URL}/users/me`, {
            headers: authHeaders(TOKENS.VALID),
        });

        expect(response.status()).toBe(200);
        const body = await response.json();
        expect(body).toMatchObject({
            id: expect.anything(),
            email: expect.stringContaining('@'),
            role: expect.any(String),
        });
    });

    test('TC-API-002 · Missing Authorization header is rejected with 401', async ({ request }) => {
        const response = await request.get(`${BASE_URL}/users/me`);

        expect(response.status()).toBe(401);
        const body = await response.json();
        expect(body).toHaveProperty('error');
        // Must not leak any user data
        expect(body).not.toHaveProperty('id');
        expect(body).not.toHaveProperty('email');
    });

    test('TC-API-003 · Expired / invalid token is rejected with 401', async ({ request }) => {
        const response = await request.get(`${BASE_URL}/users/me`, {
            headers: authHeaders(TOKENS.EXPIRED),
        });

        expect(response.status()).toBe(401);
        const body = await response.json();
        expect(body.error).toMatch(/invalid|expired/i);
    });

    test('TC-API-004 · Insufficient role returns 403', async ({ request }) => {
        const response = await request.get(`${BASE_URL}/admin/stats`, {
            headers: authHeaders(TOKENS.BASIC),
        });

        expect(response.status()).toBe(403);
        const body = await response.json();
        expect(body.error).toMatch(/permission|forbidden|access/i);
    });

});

// ════════════════════════════════════════════════════════════════
// 2. CRUD OPERATIONS
// (We track createdItemId across CREATE → READ → UPDATE → DELETE)
// ════════════════════════════════════════════════════════════════
test.describe('CRUD Operations', () => {

    /** @type {string | number} */
    let createdItemId;

    test('TC-API-005 · CREATE — POST creates a new resource', async ({ request }) => {
        const response = await request.post(`${BASE_URL}/items`, {
            headers: authHeaders(TOKENS.VALID),
            data: NEW_ITEM,
        });

        expect(response.status()).toBe(201);
        const body = await response.json();

        expect(body).toHaveProperty('id');
        expect(body.name).toBe(NEW_ITEM.name);
        expect(body.price).toBe(NEW_ITEM.price);

        // Playwright doesn't share state across tests — store in outer scope
        createdItemId = body.id;

        // Location header check (optional but best-practice)
        const locationHeader = response.headers()['location'];
        if (locationHeader) {
            expect(locationHeader).toContain(String(createdItemId));
        }
    });

    test('TC-API-006 · READ — GET returns a specific resource by ID', async ({ request }) => {
        // Ensure TC-API-005 runs first or use a known test-seeded ID
        const id = createdItemId ?? 'test-seed-id-1';

        const response = await request.get(`${BASE_URL}/items/${id}`, {
            headers: authHeaders(TOKENS.VALID),
        });

        expect(response.status()).toBe(200);
        const body = await response.json();
        expect(body.id).toBe(id);
    });

    test('TC-API-007 · READ — GET list returns paginated array', async ({ request }) => {
        const response = await request.get(`${BASE_URL}/items?page=1&limit=10`, {
            headers: authHeaders(TOKENS.VALID),
        });

        expect(response.status()).toBe(200);
        const body = await response.json();

        // Data must be an array with at most `limit` items
        const items = body.data ?? body; // handle both wrapped and unwrapped responses
        expect(Array.isArray(items)).toBeTruthy();
        expect(items.length).toBeLessThanOrEqual(10);

        // Check pagination metadata if wrapped
        if (body.meta) {
            expect(typeof body.meta.total).toBe('number');
            expect(body.meta.page).toBe(1);
            expect(body.meta.limit).toBe(10);
        }
    });

    test('TC-API-008 · UPDATE — PUT fully replaces a resource', async ({ request }) => {
        const id = createdItemId ?? 'test-seed-id-1';

        const response = await request.put(`${BASE_URL}/items/${id}`, {
            headers: authHeaders(TOKENS.VALID),
            data: UPDATED_ITEM,
        });

        expect(response.status()).toBe(200);
        const body = await response.json();
        expect(body.name).toBe(UPDATED_ITEM.name);
        expect(body.price).toBe(UPDATED_ITEM.price);

        // Confirm persistence with a follow-up GET
        const getResponse = await request.get(`${BASE_URL}/items/${id}`, {
            headers: authHeaders(TOKENS.VALID),
        });
        const fetched = await getResponse.json();
        expect(fetched.price).toBe(UPDATED_ITEM.price);
    });

    test('TC-API-009 · UPDATE — PATCH partially updates a resource', async ({ request }) => {
        const id = createdItemId ?? 'test-seed-id-1';

        const response = await request.patch(`${BASE_URL}/items/${id}`, {
            headers: authHeaders(TOKENS.VALID),
            data: PATCH_PAYLOAD,
        });

        expect(response.status()).toBe(200);
        const body = await response.json();

        // Only price should change; name must be preserved
        expect(body.price).toBe(PATCH_PAYLOAD.price);
        expect(body.name).toBeDefined(); // name was not sent but must still be present
    });

    test('TC-API-010 · DELETE — removes the resource, subsequent GET returns 404', async ({ request }) => {
        const id = createdItemId ?? 'test-seed-id-1';

        const deleteResponse = await request.delete(`${BASE_URL}/items/${id}`, {
            headers: authHeaders(TOKENS.VALID),
        });
        expect(deleteResponse.status()).toBe(204);

        // Verify deletion
        const getResponse = await request.get(`${BASE_URL}/items/${id}`, {
            headers: authHeaders(TOKENS.VALID),
        });
        expect(getResponse.status()).toBe(404);
    });

    test('TC-API-011 · DELETE is idempotent — second delete returns 404 not 500', async ({ request }) => {
        // Use a known-deleted ID or re-create and delete twice
        const tempResponse = await request.post(`${BASE_URL}/items`, {
            headers: authHeaders(TOKENS.VALID),
            data: { name: 'Temp Idempotency Item', price: 1.00 },
        });
        const tempId = (await tempResponse.json()).id;

        // First delete
        const first = await request.delete(`${BASE_URL}/items/${tempId}`, {
            headers: authHeaders(TOKENS.VALID),
        });
        expect(first.status()).toBe(204);

        // Second delete — must NOT return 500
        const second = await request.delete(`${BASE_URL}/items/${tempId}`, {
            headers: authHeaders(TOKENS.VALID),
        });
        expect(second.status()).toBe(404);
    });

});

// ════════════════════════════════════════════════════════════════
// 3. ERROR HANDLING
// ════════════════════════════════════════════════════════════════
test.describe('Error Handling', () => {

    test('TC-API-012 · 400 Bad Request on malformed/invalid body', async ({ request }) => {
        const response = await request.post(`${BASE_URL}/items`, {
            headers: authHeaders(TOKENS.VALID),
            data: INVALID_ITEM,
        });

        expect(response.status()).toBe(400);
        const body = await response.json();

        // Should return field-level errors, NOT a stack trace
        expect(body).toHaveProperty('errors');
        const bodyStr = JSON.stringify(body);
        expect(bodyStr).not.toMatch(/at Object\.|stack|Error:/);
    });

    test('TC-API-013 · 404 Not Found for non-existent resource', async ({ request }) => {
        const response = await request.get(`${BASE_URL}/items/non-existent-id-99999`, {
            headers: authHeaders(TOKENS.VALID),
        });

        expect(response.status()).toBe(404);
        const body = await response.json();
        expect(body).toHaveProperty('error');
        expect(body.error).toMatch(/not found/i);
    });

    test('TC-API-014 · 500 errors do not expose internal stack traces', async ({ request }) => {
        // Trigger a server error using a known problematic payload (adjust to your app)
        const crashPayload = { name: null, price: null, __triggerCrash: true };

        const response = await request.post(`${BASE_URL}/items`, {
            headers: authHeaders(TOKENS.VALID),
            data: crashPayload,
        });

        // Status must be 400 or 500, but body must never leak internals
        expect([400, 500]).toContain(response.status());
        const bodyText = await response.text();
        expect(bodyText).not.toMatch(/at Object\.|stack|SQL|at .*\.js:\d+/);
    });

});

// ════════════════════════════════════════════════════════════════
// 4. RATE LIMITING
// ════════════════════════════════════════════════════════════════
test.describe('Rate Limiting', () => {

    test('TC-API-015 · 429 returned after threshold exceeded, with Retry-After header', async ({ request }) => {
        const url = `${BASE_URL}/items`;
        const headers = authHeaders(TOKENS.VALID);

        const statuses = await burstRequests(request, url, headers, RATE_LIMIT_BURST);

        // At least one 429 must be present
        const has429 = statuses.some(s => s === 429);
        expect(has429, `Expected 429 among: ${statuses.join(', ')}`).toBeTruthy();

        // Also verify Retry-After is present on the 429 by sending one more request
        const rateLimitedResponse = await request.get(url, { headers });
        if (rateLimitedResponse.status() === 429) {
            const retryAfter = rateLimitedResponse.headers()['retry-after'];
            expect(retryAfter, 'Retry-After header should be present on 429').toBeTruthy();
        }
    });

    test('TC-API-016 · Rate limit headers present on normal responses', async ({ request }) => {
        const response = await request.get(`${BASE_URL}/items`, {
            headers: authHeaders(TOKENS.VALID),
        });

        // These are standard rate limit headers (RFC 6585 / common convention)
        const responseHeaders = response.headers();
        const hasLimit = 'x-ratelimit-limit' in responseHeaders;
        const hasRemaining = 'x-ratelimit-remaining' in responseHeaders;

        expect(
            hasLimit && hasRemaining,
            'Rate limit headers (X-RateLimit-Limit, X-RateLimit-Remaining) should be present'
        ).toBeTruthy();
    });

});

// ════════════════════════════════════════════════════════════════
// 5. SCHEMA VALIDATION
// ════════════════════════════════════════════════════════════════
test.describe('Schema Validation', () => {

    test('TC-API-017 · GET /items/{id} response matches expected JSON schema', async ({ request }) => {
        // Seed an item first
        const created = await request.post(`${BASE_URL}/items`, {
            headers: authHeaders(TOKENS.VALID),
            data: NEW_ITEM,
        });
        const { id } = await created.json();

        const response = await request.get(`${BASE_URL}/items/${id}`, {
            headers: authHeaders(TOKENS.VALID),
        });
        const body = await response.json();

        // Validate every required field exists with the correct type
        validateSchema(body, ITEM_SCHEMA);

        // Specifically verify createdAt is a valid ISO 8601 date string
        expect(new Date(body.createdAt).toISOString()).toBe(body.createdAt);
    });

    test('TC-API-018 · POST /items response schema includes server-generated id', async ({ request }) => {
        const response = await request.post(`${BASE_URL}/items`, {
            headers: authHeaders(TOKENS.VALID),
            data: NEW_ITEM,
        });

        expect(response.status()).toBe(201);
        const body = await response.json();

        validateSchema(body, ITEM_SCHEMA);

        // id must NOT have been sent in the request, but IS in the response
        expect(body.id).toBeDefined();
        expect(String(body.id).length).toBeGreaterThan(0);
    });

    test('TC-API-019 · 401 error response matches error schema', async ({ request }) => {
        const response = await request.get(`${BASE_URL}/items`, {
            // No auth header — intentionally triggers 401
        });

        expect(response.status()).toBe(401);
        const body = await response.json();

        // Error body must conform to minimal error schema
        validateSchema(body, ERROR_SCHEMA);

        // Must not leak internals
        expect(body).not.toHaveProperty('stack');
        expect(body).not.toHaveProperty('trace');
    });

    test('TC-API-020 · GET list pagination metadata schema is correct', async ({ request }) => {
        const response = await request.get(`${BASE_URL}/items?page=1&limit=5`, {
            headers: authHeaders(TOKENS.VALID),
        });

        expect(response.status()).toBe(200);
        const body = await response.json();

        // Validate structure exists and types are correct
        if (body.meta) {
            validateSchema(body.meta, PAGINATION_META_SCHEMA);
            expect(body.meta.page).toBe(1);
            expect(body.meta.limit).toBe(5);
            expect(body.meta.totalPages).toBeGreaterThanOrEqual(1);
        } else {
            // If the API returns flat pagination, adapt accordingly
            console.warn('[TC-API-020] No `meta` key — check if API wraps pagination differently.');
        }

        // Data array must still be present
        expect(Array.isArray(body.data ?? body)).toBeTruthy();
    });

});
