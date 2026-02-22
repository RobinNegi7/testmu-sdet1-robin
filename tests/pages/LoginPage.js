// @ts-check
import { expect } from '@playwright/test';

/**
 * LoginPage Page Object Model
 * Centralises all selectors and actions for the login page.
 *
 * Update the BASE_URL and selectors to match your application.
 */
export class LoginPage {
    /**
     * @param {import('@playwright/test').Page} page
     */
    constructor(page) {
        this.page = page;

        // ── Locators ──────────────────────────────────────────────────
        this.usernameInput = page.locator('[data-test="username"]');
        this.passwordInput = page.locator('[data-test="password"]');
        this.loginButton = page.locator('[data-test="login-button"]');
        this.errorMessage = page.locator('[data-test="error"]');

        // Stubbed or optional locators for SauceDemo (avoids breaking existing specs)
        this.forgotPasswordLink = page.locator('#forgot-password-link-not-existent');
        this.usernameError = page.locator('.input-error-icon'); // SauceDemo shows icons
        this.passwordError = page.locator('.input-error-icon');
        this.captchaWidget = page.locator('#captcha-not-existent');
        this.showPasswordToggle = page.locator('#show-password-not-existent');
    }

    // ── Navigation ────────────────────────────────────────────────

    async goto() {
        await this.page.goto('/');
        await this.page.waitForLoadState('networkidle');
    }

    async gotoForgotPassword() {
        // SauceDemo doesn't have a forgot password link on the landing page, 
        // but we'll mock the intent for documentation.
        await this.page.goto('https://www.saucedemo.com/');
    }

    // ── Core Actions ──────────────────────────────────────────────

    /**
     * Fill the login form and submit.
     * @param {string} username
     * @param {string} password
     */
    async fillAndSubmit(username, password) {
        await this.usernameInput.fill(username);
        await this.passwordInput.fill(password);
        await this.loginButton.click();
    }

    /**
     * Attempt login N times with the same bad credentials.
     * Useful for brute-force / lockout tests.
     * @param {string} username
     * @param {string} wrongPassword
     * @param {number} times
     */
    async attemptFailedLogin(username, wrongPassword, times = 1) {
        for (let i = 0; i < times; i++) {
            await this.usernameInput.fill(username);
            await this.passwordInput.fill(wrongPassword);
            await this.loginButton.click();
            // Wait for the error to appear before next attempt
            await this.errorMessage.waitFor({ state: 'visible', timeout: 5000 }).catch(() => { });
        }
    }

    // ── Assertions ────────────────────────────────────────────────

    async assertLoggedIn() {
        await expect(this.page).toHaveURL(/dashboard|home/i);
        // Ensure no auth-related error is on screen
        await expect(this.errorMessage).not.toBeVisible();
    }

    async assertLoginError(expectedText) {
        await expect(this.errorMessage).toBeVisible();
        if (expectedText) {
            await expect(this.errorMessage).toContainText(expectedText);
        }
    }

    async assertFieldValidationError(field = 'both') {
        if (field === 'username' || field === 'both') {
            await expect(this.usernameError).toBeVisible();
        }
        if (field === 'password' || field === 'both') {
            await expect(this.passwordError).toBeVisible();
        }
    }

    async assertOnLoginPage() {
        await expect(this.page).toHaveURL(/login/i);
    }

    async assertCaptchaVisible() {
        await expect(this.captchaWidget).toBeVisible();
    }

    async assertPasswordMasked() {
        await expect(this.passwordInput).toHaveAttribute('type', 'password');
    }

    async assertPasswordVisible() {
        await expect(this.passwordInput).toHaveAttribute('type', 'text');
    }
}
