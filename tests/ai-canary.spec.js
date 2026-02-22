// @ts-check
/**
 * ai-canary.spec.js
 *
 * Example showing how to integrate the AI Failure Explainer
 * into any Playwright test file using test.afterEach().
 *
 * Usage for your own spec files — just copy the afterEach block:
 *
 *   import { explainFailure } from '../utils/aiHelper.js';
 *
 *   test.afterEach(async ({}, testInfo) => {
 *     if (testInfo.status !== testInfo.expectedStatus) {
 *       const aiExplanation = await explainFailure(testInfo.error?.message);
 *       console.log(aiExplanation);
 *     }
 *   });
 */

import { test, expect } from '@playwright/test';
import { explainFailure } from '../utils/aiHelper.js';

// ── AI Failure Explainer hook ─────────────────────────────────
test.afterEach(async ({ }, testInfo) => {
    if (testInfo.status !== testInfo.expectedStatus) {
        const errorMessage = testInfo.error?.message ?? 'Unknown error';
        const aiExplanation = await explainFailure(errorMessage);
        console.log(aiExplanation);
    }
});

// ── Intentional failure test — demonstrates AI analysis ──────
test('AI Canary · Intentional failure to trigger Gemini explanation', async ({ page }) => {
    await page.goto('https://www.saucedemo.com/');

    // Deliberately wrong selector — this will fail
    // Gemini will explain WHY it failed and how to fix it
    await page.locator('#this-element-does-not-exist').click({ timeout: 5000 });
});
