// @ts-check
/**
 * Dashboard Module — Test Data
 *
 * Mock data for intercepting network requests to ensure consistent 
 * dashboard testing without relying on brittle live databases.
 */

export const MOCK_SUMMARY_DATA = {
    totalUsers: 1540,
    revenue: 5000.00,
    activeSessions: 342
};

// Represents an empty state response
export const MOCK_EMPTY_DATA = {
    totalUsers: 0,
    revenue: 0,
    activeSessions: 0,
    items: []
};

// Data for verifying Sorting (A-Z, and numerical)
export const MOCK_CLIENTS_DATA = [
    { id: 1, name: "Alpha Corp", revenue: 10000, joined: "2023-01-15" },
    { id: 2, name: "Zeta LLC", revenue: 500, joined: "2023-11-02" },
    { id: 3, name: "Bravo Inc", revenue: 7500, joined: "2023-05-20" },
    { id: 4, name: "Charlie Co", revenue: 200, joined: "2024-01-10" }
];

export const SORTED_CLIENTS_NAMES_ASC = ["Alpha Corp", "Bravo Inc", "Charlie Co", "Zeta LLC"];
export const SORTED_CLIENTS_NAMES_DESC = ["Zeta LLC", "Charlie Co", "Bravo Inc", "Alpha Corp"];

// Roles for permission testing
export const ROLES = {
    ADMIN: 'admin',
    BASIC: 'basic_user'
};

// API Endpoints to intercept (Update these to match your actual app)
export const API_ENDPOINTS = {
    SUMMARY: '**/api/dashboard/summary',
    REVENUE_CHART: '**/api/dashboard/revenue',
    ACTIVITY: '**/api/dashboard/activity',
    TOP_CLIENTS: '**/api/dashboard/clients',
    RESTRICTED_ADMIN: '**/api/admin/revenue-stats'
};
