// @ts-check
import { expect } from '@playwright/test';

/**
 * DashboardPage Page Object Model
 * Centralises all selectors and actions for the dashboard page.
 */
export class DashboardPage {
    /**
     * @param {import('@playwright/test').Page} page
     */
    constructor(page) {
        this.page = page;

        // ── Locators ──────────────────────────────────────────────────

        // Core Layout
        this.dashboardContainer = page.locator('[data-testid="dashboard-container"], .dashboard-layout');
        this.globalDateFilter = page.locator('[data-testid="global-date-picker"], #date-filter');
        this.clearFiltersBtn = page.getByRole('button', { name: /clear filters|reset/i });

        // Widgets (Generic placeholders - adapt to your app)
        this.summaryWidget = page.locator('[data-widget="summary"], .summary-cards');
        this.revenueChart = page.locator('[data-widget="revenue"], .revenue-chart');
        this.activityFeed = page.locator('[data-widget="activity"], .recent-activity');
        this.topClientsTable = page.locator('[data-widget="top-clients"], table.clients-table');
        this.restrictedAdminWidget = page.locator('[data-widget="admin-controls"], .admin-panel');

        // Inside Widgets
        this.widgetLoaders = page.locator('.skeleton-loader, [role="progressbar"], .spinner');
        this.widgetErrorMsg = page.locator('.widget-error, [data-testid="widget-error"]');
        this.emptyStateMsg = page.locator('.empty-state, text=/no data|no items found/i');

        // Table specific
        this.tableHeaders = this.topClientsTable.locator('th');
        this.tableRows = this.topClientsTable.locator('tbody tr');
    }

    // ── Navigation ────────────────────────────────────────────────

    async goto() {
        await this.page.goto('/dashboard');
        // We wait for DOM content loaded at minimum, specific widget network requests 
        // should be awaited in the tests themselves for accurate validation.
        await this.page.waitForLoadState('domcontentloaded');
    }

    // ── Actions ───────────────────────────────────────────────────

    /**
     * Clicks a specific table header to trigger sorting
     * @param {string} columnName 
     */
    async clickColumnHeader(columnName) {
        await this.tableHeaders.filter({ hasText: new RegExp(columnName, 'i') }).click();
        // Brief wait for UI to update (prefer waiting for a network response in the actual spec if it's server-side sorting)
        await this.page.waitForTimeout(500);
    }

    /**
     * Extracts text content from a specific column index across all rows
     * @param {number} colIndex (0-based)
     * @returns {Promise<string[]>}
     */
    async getColumnData(colIndex) {
        const rowsCount = await this.tableRows.count();
        const data = [];
        for (let i = 0; i < rowsCount; i++) {
            const cellText = await this.tableRows.nth(i).locator('td').nth(colIndex).innerText();
            data.push(cellText.trim());
        }
        return data;
    }

    async setGlobalDateFilter(dateRangeStr) {
        await this.globalDateFilter.click();
        // Assuming a standard select or dropdown list
        await this.page.getByRole('option', { name: dateRangeStr }).click();
    }

    // ── Assertions ────────────────────────────────────────────────

    async assertAllCoreWidgetsVisible() {
        await expect(this.summaryWidget).toBeVisible();
        await expect(this.revenueChart).toBeVisible();
        await expect(this.activityFeed).toBeVisible();
    }

    async assertNoWidgetErrors() {
        await expect(this.widgetErrorMsg).toHaveCount(0);
    }

    async assertLoadersVisibleThenHidden() {
        // There should be at least one loader initially
        expect(await this.widgetLoaders.count()).toBeGreaterThan(0);
        // Then they should all disappear
        await expect(this.widgetLoaders).toHaveCount(0, { timeout: 10000 });
    }

}
