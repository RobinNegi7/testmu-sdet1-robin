// @ts-check
/**
 * Login Module — Test Data
 *
 * Update these values to match your actual application credentials
 * and configuration before running the tests.
 */

export const VALID_USER = {
    username: 'standard_user',
    password: 'secret_sauce',
};

export const LOCKOUT_USER = {
    username: 'locked_out_user',
    password: 'secret_sauce',
    wrongPassword: 'wrong_password',
};

export const RESET_EMAIL = {
    registered: 'valid@example.com',
    unregistered: 'notregistered@nowhere.com',
    invalid: 'not-an-email',
};

/** Max consecutive failed attempts before the account locks */
export const LOCKOUT_THRESHOLD = 5;

/** Idle session timeout in milliseconds (set to a short value in test env) */
export const SESSION_TIMEOUT_MS = 30_000;

/** Lockout duration in milliseconds (use short value in test env) */
export const LOCKOUT_DURATION_MS = 5 * 60 * 1000;  // 5 minutes

export const SQL_INJECTION_PAYLOADS = [
    `' OR '1'='1`,
    `'; DROP TABLE users; --`,
    `" OR ""="`,
    `admin'--`,
];

/** Generates a string of `len` random alphabetical characters */
export function generateString(len = 300) {
    return 'a'.repeat(len);
}
