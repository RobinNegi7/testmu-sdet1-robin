// @ts-check
/**
 * API Helper Utility
 *
 * A thin wrapper around Playwright's APIRequestContext.
 * Centralises header logic and schema validation so tests stay clean.
 */

/**
 * @param {import('@playwright/test').APIRequestContext} request
 * @param {string} token
 * @returns {{ Authorization: string, 'Content-Type': string }}
 */
export function authHeaders(token) {
    return {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
    };
}

/**
 * Validates that a JSON body contains all required fields with correct types.
 * @param {Record<string, any>} body - Parsed response JSON.
 * @param {{ requiredFields: string[], types: Record<string, string> }} schema
 * @throws if any required field is missing or has wrong type.
 */
export function validateSchema(body, schema) {
    for (const field of schema.requiredFields) {
        if (!(field in body)) throw new Error(`Schema violation: missing field "${field}"`);
    }
    for (const [field, expectedType] of Object.entries(schema.types)) {
        const actual = typeof body[field];
        if (actual !== expectedType) {
            throw new Error(
                `Schema violation: "${field}" expected ${expectedType}, got ${actual}`
            );
        }
    }
}

/**
 * Fires `count` rapid GET requests to the given URL and returns all status codes.
 * @param {import('@playwright/test').APIRequestContext} request
 * @param {string} url
 * @param {Record<string, string>} headers
 * @param {number} count
 * @returns {Promise<number[]>}
 */
export async function burstRequests(request, url, headers, count) {
    const promises = Array.from({ length: count }, () =>
        request.get(url, { headers }).then(r => r.status())
    );
    return Promise.all(promises);
}
