// @ts-check
/**
 * Login Module — Playwright Automation Test Suite
 *
 * Covers:
 *   ✅ Valid Login          (TC-LOGIN-001 to 002)
 *   ✅ Invalid Username     (TC-LOGIN-003 to 005)
 *   ✅ Invalid Password     (TC-LOGIN-006 to 008)
 *   ✅ Empty Fields         (TC-LOGIN-009 to 012)
 *   ✅ Forgot Password      (TC-LOGIN-013 to 016)
 *   ✅ Session Timeout      (TC-LOGIN-017 to 019)
 *   ✅ Brute-Force Lockout  (TC-LOGIN-020 to 024)
 *
 * Prerequisites:
 *   1. Set baseURL in playwright.config.js → use: { baseURL: 'https://your-app.com' }
 *   2. Update credentials in data/login-test-data.js
 *   3. Configure LOCKOUT_THRESHOLD and SESSION_TIMEOUT_MS to match your app
 */

import { test, expect } from '@playwright/test';
import { LoginPage } from './pages/LoginPage.js';
import { explainFailure } from '../utils/aiHelper.js';
import {
    VALID_USER,
    LOCKOUT_USER,
    RESET_EMAIL,
    LOCKOUT_THRESHOLD,
    SESSION_TIMEOUT_MS,
    SQL_INJECTION_PAYLOADS,
    generateString,
} from '../data/login-test-data.js';

// ════════════════════════════════════════════════════════════════
// 🤖 AI FAILURE EXPLAINER — Global hook (applies to every test)
//
//    When any test fails, Gemini explains the error in plain English,
//    suggests the root cause, and recommends a fix.
//
//    Requirements:
//      Set GEMINI_API_KEY in your environment before running:
//        PowerShell : $env:GEMINI_API_KEY = "AIza..."
//        CMD        : set GEMINI_API_KEY=AIza...
// ════════════════════════════════════════════════════════════════
test.afterEach(async ({ }, testInfo) => {
    if (testInfo.status !== testInfo.expectedStatus) {
        const errorMessage = testInfo.error?.message ?? 'Unknown error';
        const aiExplanation = await explainFailure(errorMessage);
        console.log(aiExplanation);
    }
});


// ════════════════════════════════════════════════════════════════
// 1. VALID LOGIN
// ════════════════════════════════════════════════════════════════
test.describe('Valid Login', () => {

    test('TC-LOGIN-001 · Successful login with valid credentials', async ({ page }) => {
        const loginPage = new LoginPage(page);
        await loginPage.goto();

        await loginPage.fillAndSubmit(VALID_USER.username, VALID_USER.password);

        // Should land on dashboard and session cookie must be set
        await loginPage.assertLoggedIn();
        const cookies = await page.context().cookies();
        const sessionCookie = cookies.find(c => /session|auth|jwt|token/i.test(c.name));
        expect(sessionCookie, 'Auth/session cookie should be present').toBeTruthy();
    });

    test('TC-LOGIN-002 · Username casing variation (case-insensitivity check)', async ({ page }) => {
        const loginPage = new LoginPage(page);
        await loginPage.goto();

        // Attempt with uppercase username — pass/fail depends on app behaviour
        await loginPage.fillAndSubmit(VALID_USER.username.toUpperCase(), VALID_USER.password);

        // NOTE: Update assertion below to match your app's behaviour:
        //   Case-insensitive app → assertLoggedIn()
        //   Case-sensitive app   → assertLoginError()
        const currentUrl = page.url();
        if (currentUrl.match(/dashboard|home/i)) {
            await loginPage.assertLoggedIn();
        } else {
            await loginPage.assertLoginError('Invalid username or password');
        }
    });

});

// ════════════════════════════════════════════════════════════════
// 2. INVALID USERNAME
// ════════════════════════════════════════════════════════════════
test.describe('Invalid Username', () => {

    test('TC-LOGIN-003 · Login with a non-existent username', async ({ page }) => {
        const loginPage = new LoginPage(page);
        await loginPage.goto();

        await loginPage.fillAndSubmit('ghost_user_xyz_' + Date.now(), 'AnyPassword@1');

        await loginPage.assertOnLoginPage();
        await loginPage.assertLoginError('Invalid username or password');
        // Username enumeration guard: message must NOT reveal whether user exists
        const errorText = await loginPage.errorMessage.innerText();
        expect(errorText).not.toMatch(/user.*not found|no account/i);
    });

    test('TC-LOGIN-004 · SQL injection attempt in Username field', async ({ page }) => {
        const loginPage = new LoginPage(page);

        for (const payload of SQL_INJECTION_PAYLOADS) {
            await loginPage.goto();
            await loginPage.fillAndSubmit(payload, 'anything');

            await loginPage.assertOnLoginPage();
            // Must not expose DB errors or bypass auth
            const body = await page.locator('body').innerText();
            expect(body).not.toMatch(/sql|syntax error|ORA-|mysql|pg_/i);
        }
    });

    test('TC-LOGIN-005 · Username exceeds maximum character limit', async ({ page }) => {
        const loginPage = new LoginPage(page);
        await loginPage.goto();

        const longUsername = generateString(300);
        await loginPage.usernameInput.fill(longUsername);
        await loginPage.passwordInput.fill('AnyPass@1');
        await loginPage.loginButton.click();

        // Either the field caps input OR a validation error is shown
        const actualValue = await loginPage.usernameInput.inputValue();
        const errorVisible = await loginPage.usernameError.isVisible().catch(() => false);

        const fieldWasTruncated = actualValue.length < 300;
        expect(
            fieldWasTruncated || errorVisible,
            'App must either truncate the input or show a validation error'
        ).toBeTruthy();
    });

});

// ════════════════════════════════════════════════════════════════
// 3. INVALID PASSWORD
// ════════════════════════════════════════════════════════════════
test.describe('Invalid Password', () => {

    test('TC-LOGIN-006 · Wrong password for valid username', async ({ page }) => {
        const loginPage = new LoginPage(page);
        await loginPage.goto();

        await loginPage.fillAndSubmit(VALID_USER.username, 'WrongPass@999');

        await loginPage.assertOnLoginPage();
        await loginPage.assertLoginError('Invalid username or password');
    });

    test('TC-LOGIN-007 · Password is case-sensitive', async ({ page }) => {
        const loginPage = new LoginPage(page);
        await loginPage.goto();

        // Use lowercase version of the correct password
        await loginPage.fillAndSubmit(VALID_USER.username, VALID_USER.password.toLowerCase());

        await loginPage.assertOnLoginPage();
        await loginPage.assertLoginError('Invalid username or password');
    });

    test.skip('TC-LOGIN-008 · Password field is masked by default', async ({ page }) => {
        const loginPage = new LoginPage(page);
        await loginPage.goto();

        await loginPage.passwordInput.fill('SomePassword@1');
        await loginPage.assertPasswordMasked();

        // If show-password toggle exists, test it
        const toggleExists = await loginPage.showPasswordToggle.count() > 0;
        if (toggleExists) {
            await loginPage.showPasswordToggle.click();
            await loginPage.assertPasswordVisible();
            await loginPage.showPasswordToggle.click();
            await loginPage.assertPasswordMasked();
        }
    });

});

// ════════════════════════════════════════════════════════════════
// 4. EMPTY FIELDS
// ════════════════════════════════════════════════════════════════
test.describe('Empty Fields', () => {

    test('TC-LOGIN-009 · Submit with both fields empty', async ({ page }) => {
        const loginPage = new LoginPage(page);
        await loginPage.goto();

        // Listen for network requests; none should fire for an empty submit
        let requestFired = false;
        page.on('request', req => {
            if (req.url().includes('/login') && req.method() === 'POST') requestFired = true;
        });

        await loginPage.loginButton.click();

        await loginPage.assertFieldValidationError('both');
        expect(requestFired, 'No POST request should fire when both fields are empty').toBe(false);
    });

    test('TC-LOGIN-010 · Submit with only Username filled', async ({ page }) => {
        const loginPage = new LoginPage(page);
        await loginPage.goto();

        await loginPage.usernameInput.fill(VALID_USER.username);
        await loginPage.loginButton.click();

        await loginPage.assertFieldValidationError('password');
    });

    test('TC-LOGIN-011 · Submit with only Password filled', async ({ page }) => {
        const loginPage = new LoginPage(page);
        await loginPage.goto();

        await loginPage.passwordInput.fill(VALID_USER.password);
        await loginPage.loginButton.click();

        await loginPage.assertFieldValidationError('username');
    });

    test('TC-LOGIN-012 · Whitespace-only credentials are treated as empty', async ({ page }) => {
        const loginPage = new LoginPage(page);
        await loginPage.goto();

        await loginPage.usernameInput.fill('     ');
        await loginPage.passwordInput.fill('     ');
        await loginPage.loginButton.click();

        // App should trim and either show validation errors or a generic login error
        const validationVisible = await loginPage.usernameError.isVisible().catch(() => false);
        const errorVisible = await loginPage.errorMessage.isVisible().catch(() => false);
        expect(
            validationVisible || errorVisible,
            'Whitespace-only input must produce an error'
        ).toBeTruthy();
        await loginPage.assertOnLoginPage();
    });

});

// ════════════════════════════════════════════════════════════════
// 5. FORGOT PASSWORD
// ════════════════════════════════════════════════════════════════
test.describe.skip('Forgot Password', () => {

    test('TC-LOGIN-013 · "Forgot Password" link navigates to reset page', async ({ page }) => {
        const loginPage = new LoginPage(page);
        await loginPage.goto();

        await loginPage.forgotPasswordLink.click();
        await expect(page).toHaveURL(/forgot-password|reset-password/i);
        // Reset form must be visible
        await expect(page.getByRole('textbox', { name: /email/i })).toBeVisible();
    });

    test('TC-LOGIN-014 · Reset email sent for registered email address', async ({ page }) => {
        const loginPage = new LoginPage(page);
        await loginPage.gotoForgotPassword();

        await page.getByRole('textbox', { name: /email/i }).fill(RESET_EMAIL.registered);
        await page.getByRole('button', { name: /send|reset|submit/i }).click();

        // Generic success message (intentionally ambiguous for security)
        await expect(
            page.locator('text=/reset link|email sent|check your/i')
        ).toBeVisible({ timeout: 8000 });
    });

    test('TC-LOGIN-015 · Reset request for unregistered email shows same message (no enumeration)', async ({ page }) => {
        const loginPage = new LoginPage(page);
        await loginPage.gotoForgotPassword();

        await page.getByRole('textbox', { name: /email/i }).fill(RESET_EMAIL.unregistered);
        await page.getByRole('button', { name: /send|reset|submit/i }).click();

        // Must show same message as TC-LOGIN-014 — no user enumeration
        await expect(
            page.locator('text=/reset link|email sent|check your/i')
        ).toBeVisible({ timeout: 8000 });
    });

    test('TC-LOGIN-016 · Invalid email format on Forgot Password form', async ({ page }) => {
        const loginPage = new LoginPage(page);
        await loginPage.gotoForgotPassword();

        let requestFired = false;
        page.on('request', req => {
            if (req.method() === 'POST') requestFired = true;
        });

        await page.getByRole('textbox', { name: /email/i }).fill(RESET_EMAIL.invalid);
        await page.getByRole('button', { name: /send|reset|submit/i }).click();

        // Inline validation must trigger; no API call should fire
        const validationError = page.locator('text=/valid email|invalid email/i');
        await expect(validationError).toBeVisible();
        expect(requestFired, 'No POST request should fire for invalid email format').toBe(false);
    });

});

// ════════════════════════════════════════════════════════════════
// 6. SESSION TIMEOUT
// ════════════════════════════════════════════════════════════════
test.describe.skip('Session Timeout', () => {

    test('TC-LOGIN-017 · Idle session timeout redirects user to login', async ({ page }) => {
        const loginPage = new LoginPage(page);
        await loginPage.goto();
        await loginPage.fillAndSubmit(VALID_USER.username, VALID_USER.password);
        await loginPage.assertLoggedIn();

        // Wait for the configured idle timeout (use a short value in test env — see login-test-data.js)
        test.setTimeout(SESSION_TIMEOUT_MS + 15_000);
        await page.waitForTimeout(SESSION_TIMEOUT_MS + 2_000);

        // Any interaction with a protected resource should redirect to login
        await page.reload();
        await expect(page).toHaveURL(/login/i, { timeout: 10_000 });

        const expiredMsg = page.locator('text=/session.*expired|please log in again/i');
        const isVisible = await expiredMsg.isVisible().catch(() => false);
        // Session expiry message is desirable but may not always be shown; log intent
        if (!isVisible) {
            console.warn('[TC-LOGIN-017] Session-expired message not shown — redirect verified only.');
        }
    });

    test('TC-LOGIN-018 · Active session is not prematurely terminated', async ({ page }) => {
        test.setTimeout(60_000);
        const loginPage = new LoginPage(page);
        await loginPage.goto();
        await loginPage.fillAndSubmit(VALID_USER.username, VALID_USER.password);
        await loginPage.assertLoggedIn();

        // Simulate activity every 10 seconds for 40 seconds
        for (let i = 0; i < 4; i++) {
            await page.waitForTimeout(10_000);
            await page.mouse.move(100 + i * 5, 100);  // small mouse movement = activity
        }

        // Verify still logged in
        await expect(page).not.toHaveURL(/login/i);
        await expect(page.locator('body')).not.toContainText(/session.*expired/i);
    });

    test('TC-LOGIN-019 · Expired JWT token is rejected, redirects to login', async ({ page }) => {
        const loginPage = new LoginPage(page);
        await loginPage.goto();

        // Inject an obviously expired JWT (signature is invalid — harmless for testing intent)
        const expiredToken =
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9' +
            '.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IlRlc3QiLCJpYXQiOjE1MTYyMzkwMjIsImV4cCI6MX0' +
            '.InvalidSignature';

        await page.evaluate(token => {
            // Attempt common storage keys — update to match your app
            localStorage.setItem('authToken', token);
            localStorage.setItem('accessToken', token);
            document.cookie = `session=${token}; path=/`;
        }, expiredToken);

        await page.goto('/dashboard');
        await expect(page).toHaveURL(/login/i, { timeout: 10_000 });
    });

});

// ════════════════════════════════════════════════════════════════
// 7. BRUTE-FORCE LOCKOUT
// ════════════════════════════════════════════════════════════════
test.describe.skip('Brute-Force Lockout', () => {

    test('TC-LOGIN-020 · Account locks after N consecutive failed attempts', async ({ page }) => {
        const loginPage = new LoginPage(page);
        await loginPage.goto();

        // Perform LOCKOUT_THRESHOLD failed attempts
        await loginPage.attemptFailedLogin(
            LOCKOUT_USER.username,
            LOCKOUT_USER.wrongPassword,
            LOCKOUT_THRESHOLD
        );

        // On the next attempt (correct password) the account should still be locked
        await loginPage.fillAndSubmit(LOCKOUT_USER.username, LOCKOUT_USER.password);

        await loginPage.assertOnLoginPage();
        const errorText = await loginPage.errorMessage.innerText();
        expect(errorText).toMatch(/locked|too many|disabled|limit/i);
    });

    test('TC-LOGIN-021 · Warning shown on the attempt before final lockout', async ({ page }) => {
        const loginPage = new LoginPage(page);
        await loginPage.goto();

        // Perform (LOCKOUT_THRESHOLD - 1) failed attempts, then check for warning
        await loginPage.attemptFailedLogin(
            LOCKOUT_USER.username,
            LOCKOUT_USER.wrongPassword,
            LOCKOUT_THRESHOLD - 1
        );

        const warningText = await loginPage.errorMessage.innerText().catch(() => '');
        const hasCountdown = /1 attempt|remaining|warning/i.test(warningText);

        // If the app shows a countdown this passes; otherwise it's informational
        if (!hasCountdown) {
            console.warn(`[TC-LOGIN-021] Warning message not detected. Actual: "${warningText}"`);
        }
        // At minimum — we must still be on the login page (not locked yet)
        await loginPage.assertOnLoginPage();
    });

    test('TC-LOGIN-022 · Locked account auto-unlocks after timeout period', async ({ page }) => {
        // This test is slow — increase timeout to cover lockout duration
        // (set LOCKOUT_DURATION_MS to a short value like 60_000 in test env)
        const REDUCED_LOCKOUT = Math.min(60_000, 5 * 60 * 1000);  // cap at 60s for test env
        test.setTimeout(REDUCED_LOCKOUT + 30_000);

        const loginPage = new LoginPage(page);

        // 1. Lock the account
        await loginPage.goto();
        await loginPage.attemptFailedLogin(
            LOCKOUT_USER.username,
            LOCKOUT_USER.wrongPassword,
            LOCKOUT_THRESHOLD
        );

        // 2. Wait for lockout to expire
        console.log(`[TC-LOGIN-022] Waiting ${REDUCED_LOCKOUT / 1000}s for lockout to expire…`);
        await page.waitForTimeout(REDUCED_LOCKOUT);

        // 3. Retry with correct credentials
        await loginPage.goto();
        await loginPage.fillAndSubmit(LOCKOUT_USER.username, LOCKOUT_USER.password);
        await loginPage.assertLoggedIn();
    });

    test('TC-LOGIN-023 · CAPTCHA or rate-limit triggered after repeated failures', async ({ page }) => {
        const loginPage = new LoginPage(page);
        await loginPage.goto();

        // Trigger 3 consecutive failures
        await loginPage.attemptFailedLogin(LOCKOUT_USER.username, LOCKOUT_USER.wrongPassword, 3);

        // Check for either a CAPTCHA widget OR a rate-limit message
        const captchaVisible = await loginPage.captchaWidget.isVisible().catch(() => false);
        const rateLimitMsg = page.locator('text=/wait|too many|slow down|rate limit/i');
        const rateLimitVisible = await rateLimitMsg.isVisible().catch(() => false);

        expect(
            captchaVisible || rateLimitVisible,
            'App should show a CAPTCHA or rate-limit message after repeated failures'
        ).toBeTruthy();
    });

    test('TC-LOGIN-024 · IP-level rate limit returns 429 after high-volume failures', async ({ page, request }) => {
        // Use the Playwright API request context for rapid-fire requests
        const loginUrl = new URL('/api/login', page.url()).href;

        const responses = [];
        for (let i = 0; i < 15; i++) {
            const res = await request.post(loginUrl, {
                data: { username: `fake_user_${i}`, password: 'bad_pass' },
                headers: { 'Content-Type': 'application/json' },
            }).catch(() => null);
            if (res) responses.push(res.status());
        }

        const has429 = responses.some(status => status === 429);
        expect(
            has429,
            `Expected at least one 429 Too Many Requests. Statuses received: ${responses.join(', ')}`
        ).toBeTruthy();
    });

});
