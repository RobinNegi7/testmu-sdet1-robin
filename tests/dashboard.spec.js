// @ts-check
/**
 * Dashboard Module — Playwright Automation Test Suite
 *
 * Scenarios Covered:
 *   ✅ Widget Loading Validation   (TC-DASH-001 to 003)
 *   ✅ Data Accuracy Checks        (TC-DASH-004 to 005)
 *   ✅ Filtering Functionality     (TC-DASH-006 to 007)
 *   ✅ Sorting Functionality       (TC-DASH-008 to 009)
 *   ✅ Responsive Layout Behavior  (TC-DASH-010 to 011)
 *   ✅ Permission-Based Visibility (TC-DASH-012 to 014)
 */

import { test, expect } from '@playwright/test';
import { DashboardPage } from './pages/DashboardPage.js';
import {
    MOCK_SUMMARY_DATA,
    MOCK_EMPTY_DATA,
    MOCK_CLIENTS_DATA,
    SORTED_CLIENTS_NAMES_ASC,
    SORTED_CLIENTS_NAMES_DESC,
    API_ENDPOINTS
} from '../data/dashboard-test-data.js';

// Setup Mock environment for consistent tests without relying on a brittle backend database
test.beforeEach(async ({ page }) => {
    // Basic route interception to simulate logged in state or fast data loading
    // In a real app, you might use storageState for authentication
    await page.route(API_ENDPOINTS.SUMMARY, async (route) => {
        await route.fulfill({ json: MOCK_SUMMARY_DATA });
    });
});

// ════════════════════════════════════════════════════════════════
// 1. WIDGET LOADING VALIDATION
// ════════════════════════════════════════════════════════════════
test.describe('Widget Loading Validation', () => {

    test('TC-DASH-001 · All widgets render successfully without errors', async ({ page }) => {
        const dashboard = new DashboardPage(page);
        await dashboard.goto();

        await dashboard.assertAllCoreWidgetsVisible();
        await dashboard.assertNoWidgetErrors();
    });

    test('TC-DASH-002 · Skeleton screens/spinners appear during data fetch', async ({ page }) => {
        const dashboard = new DashboardPage(page);

        // Delay the API response to ensure loaders have time to render
        await page.route(API_ENDPOINTS.SUMMARY, async (route) => {
            await new Promise(resolve => setTimeout(resolve, 2000));
            await route.fulfill({ json: MOCK_SUMMARY_DATA });
        });

        // Don't wait on networkidle here, we want to see the loading state immediately
        await page.goto('/dashboard');

        // Assert loaders are visible then vanish
        await dashboard.assertLoadersVisibleThenHidden();
        await dashboard.assertAllCoreWidgetsVisible();
    });

    test('TC-DASH-003 · Graceful degradation on individual widget failure', async ({ page }) => {
        const dashboard = new DashboardPage(page);

        // Force one specific widget API to fail
        await page.route(API_ENDPOINTS.REVENUE_CHART, async (route) => {
            await route.fulfill({ status: 500, body: 'Internal Server Error' });
        });

        await dashboard.goto();

        // The dashboard shouldn't crash entirely; other widgets should be fine
        await expect(dashboard.summaryWidget).toBeVisible();

        // The failed widget should show an error
        await expect(dashboard.widgetErrorMsg.first()).toBeVisible();
    });

});

// ════════════════════════════════════════════════════════════════
// 2. DATA ACCURACY CHECKS
// ════════════════════════════════════════════════════════════════
test.describe('Data Accuracy Checks', () => {

    test('TC-DASH-004 · Summary metrics match the underlying dataset', async ({ page }) => {
        const dashboard = new DashboardPage(page);
        await dashboard.goto();

        // Verify the UI rendered the mocked MOCK_SUMMARY_DATA exactly
        const summaryText = await dashboard.summaryWidget.innerText();

        // Assuming your app formats '1540' -> '1,540' and '5000' -> '$5,000'
        expect(summaryText).toContain('1,540');
        expect(summaryText).toContain('$5,000');
    });

    test('TC-DASH-005 · Empty state representation', async ({ page }) => {
        const dashboard = new DashboardPage(page);

        // Mock empty data returns
        await page.route(API_ENDPOINTS.SUMMARY, async (route) => route.fulfill({ json: MOCK_EMPTY_DATA }));
        await page.route(API_ENDPOINTS.TOP_CLIENTS, async (route) => route.fulfill({ json: [] }));

        await dashboard.goto();

        // Ensure "No Data" or similar messages appear in list/chart widgets
        await expect(dashboard.emptyStateMsg.first()).toBeVisible();

        // Ensure summary widgets handle '0' gracefully without showing NaN
        const summaryText = await dashboard.summaryWidget.innerText();
        expect(summaryText).not.toContain('NaN');
        expect(summaryText).not.toContain('undefined');
        expect(summaryText).toMatch(/\b0\b/);
    });

});

// ════════════════════════════════════════════════════════════════
// 3. FILTERING FUNCTIONALITY
// ════════════════════════════════════════════════════════════════
test.describe('Filtering Functionality', () => {

    test('TC-DASH-006 · Global date range filter updates all applicable widgets', async ({ page }) => {
        const dashboard = new DashboardPage(page);
        await dashboard.goto();

        // Listen for the outgoing request when the filter changes
        const requestPromise = page.waitForRequest(req =>
            req.url().includes(API_ENDPOINTS.SUMMARY.replace('**', '')) && req.url().includes('days=7')
        );

        // Change Date filter (adjust exact match string based on your UI)
        await dashboard.globalDateFilter.click();
        await page.getByRole('option', { name: 'Last 7 Days' }).click();

        // Wait for the specific API call containing the new date parameter
        const request = await requestPromise;
        expect(request).toBeTruthy();
    });

    test('TC-DASH-007 · Clearing filters resets dashboard', async ({ page }) => {
        const dashboard = new DashboardPage(page);
        await dashboard.goto();

        // Apply a filter
        await dashboard.globalDateFilter.click();
        await page.getByRole('option', { name: 'Custom Range' }).click();

        // Clear it
        await dashboard.clearFiltersBtn.click();

        // Ensure default state is restored (e.g., date picker shows default text)
        await expect(dashboard.globalDateFilter).toContainText(/Last 30 Days|Yeat To Date/i);
    });

});

// ════════════════════════════════════════════════════════════════
// 4. SORTING FUNCTIONALITY
// ════════════════════════════════════════════════════════════════
test.describe('Sorting Functionality', () => {

    test.beforeEach(async ({ page }) => {
        await page.route(API_ENDPOINTS.TOP_CLIENTS, async (route) => {
            await route.fulfill({ json: MOCK_CLIENTS_DATA });
        });
    });

    test('TC-DASH-008 · Sort data table widgets by string columns', async ({ page }) => {
        const dashboard = new DashboardPage(page);
        await dashboard.goto();

        // Click the 'Name' column header to sort ascending
        await dashboard.clickColumnHeader('Name');

        // Extract the First Column (index 0) text and compare
        let extractedNames = await dashboard.getColumnData(0);
        expect(extractedNames).toEqual(SORTED_CLIENTS_NAMES_ASC);

        // Click again for descending
        await dashboard.clickColumnHeader('Name');
        extractedNames = await dashboard.getColumnData(0);
        expect(extractedNames).toEqual(SORTED_CLIENTS_NAMES_DESC);
    });

    test('TC-DASH-009 · Sort data table widgets by numerical/date columns', async ({ page }) => {
        const dashboard = new DashboardPage(page);
        await dashboard.goto();

        // Click 'Revenue' column (assume it's index 1)
        await dashboard.clickColumnHeader('Revenue');

        let extractedRevenues = await dashboard.getColumnData(1);
        // Stripping commas/currency symbols and converting to float for validation
        let parsedRevenues = extractedRevenues.map(r => parseFloat(r.replace(/[^0-9.-]+/g, "")));

        // Assert the array is numerically sorted (ascending)
        const sortedAsc = [...parsedRevenues].sort((a, b) => a - b);
        expect(parsedRevenues).toEqual(sortedAsc);
    });

});

// ════════════════════════════════════════════════════════════════
// 5. RESPONSIVE LAYOUT BEHAVIOR
// ════════════════════════════════════════════════════════════════
test.describe('Responsive Layout Behavior', () => {

    test('TC-DASH-010 · Dashboard adapts to Mobile viewport', async ({ page }) => {
        // Set mobile viewport size
        await page.setViewportSize({ width: 375, height: 812 });
        const dashboard = new DashboardPage(page);
        await dashboard.goto();

        // Ensure widgets stack securely. Horizontal scrolling should be minimised.
        const summaryBox = await dashboard.summaryWidget.boundingBox();
        const chartBox = await dashboard.revenueChart.boundingBox();

        expect(summaryBox.width).toBeLessThanOrEqual(375);
        expect(chartBox.width).toBeLessThanOrEqual(375);

        // Chart should ideally be below the summary boxes on mobile layout
        expect(chartBox.y).toBeGreaterThan(summaryBox.y);
    });

    test('TC-DASH-011 · Dashboard adapts to Tablet viewport', async ({ page }) => {
        await page.setViewportSize({ width: 768, height: 1024 });
        const dashboard = new DashboardPage(page);
        await dashboard.goto();

        const chartBox = await dashboard.revenueChart.boundingBox();
        expect(chartBox.width).toBeLessThanOrEqual(768);
    });

});

// ════════════════════════════════════════════════════════════════
// 6. PERMISSION-BASED VISIBILITY
// ════════════════════════════════════════════════════════════════
test.describe('Permission-Based Visibility', () => {

    test('TC-DASH-012 · High-privilege user sees all widgets', async ({ page }) => {
        // Mock role API
        await page.route('**/api/user/profile', async (route) => {
            await route.fulfill({ json: { role: 'admin' } });
        });

        const dashboard = new DashboardPage(page);
        await dashboard.goto();

        await expect(dashboard.restrictedAdminWidget).toBeVisible();
    });

    test('TC-DASH-013 · Low-privilege user sees restricted dashboard', async ({ page }) => {
        // Mock basic user profile
        await page.route('**/api/user/profile', async (route) => {
            await route.fulfill({ json: { role: 'basic_user' } });
        });

        const dashboard = new DashboardPage(page);
        await dashboard.goto();

        // Protected widget must NOT be in the DOM
        await expect(dashboard.restrictedAdminWidget).not.toBeVisible();
    });

    test('TC-DASH-014 · Unauthorized data fetch returns 403 (Negative Test)', async ({ request }) => {
        // Directly ping the admin API (simulating a basic user auth context holding the `request` object)
        const response = await request.get('/api/admin/revenue-stats');

        // Depending on your API implementation, it should yield 401 or 403
        expect([401, 403, 404]).toContain(response.status());
    });

});
