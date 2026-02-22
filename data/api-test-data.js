// @ts-check
/**
 * REST API — Test Data & Configuration
 *
 * Update BASE_URL and TOKENS to match your API environment.
 */

export const BASE_URL = 'https://api.yourapp.com/v1';

// ── Auth Tokens (update with real values or pull from env) ────
export const TOKENS = {
    VALID: process.env.API_VALID_TOKEN || 'your-valid-bearer-token',
    EXPIRED: process.env.API_EXPIRED_TOKEN || 'expired-or-invalid-token',
    BASIC: process.env.API_BASIC_TOKEN || 'basic-user-bearer-token',
    ADMIN: process.env.API_ADMIN_TOKEN || 'admin-bearer-token',
};

// ── CRUD Payloads ─────────────────────────────────────────────
export const NEW_ITEM = {
    name: 'Playwright Test Item',
    price: 99.99,
};

export const UPDATED_ITEM = {
    name: 'Updated Test Item',
    price: 199.99,
};

export const PATCH_PAYLOAD = {
    price: 49.99,
};

export const INVALID_ITEM = {
    name: 123,          // should be string
    price: 'not-a-number', // should be number
};

// ── Expected JSON Schemas ─────────────────────────────────────
export const ITEM_SCHEMA = {
    requiredFields: ['id', 'name', 'price', 'createdAt'],
    types: {
        id: 'string',
        name: 'string',
        price: 'number',
        createdAt: 'string',  // ISO-8601 date
    }
};

export const ERROR_SCHEMA = {
    requiredFields: ['error'],
    types: { error: 'string' },
};

export const PAGINATION_META_SCHEMA = {
    requiredFields: ['total', 'page', 'limit', 'totalPages'],
    types: { total: 'number', page: 'number', limit: 'number', totalPages: 'number' },
};

// ── Rate Limit Config ─────────────────────────────────────────
export const RATE_LIMIT_THRESHOLD = 20; // how many requests before 429
export const RATE_LIMIT_BURST = 25; // how many to fire in test
