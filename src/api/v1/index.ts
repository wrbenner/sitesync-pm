// API v1 — stable public surface for SiteSync integrations.
//
// All exports here represent the versioned contract. Breaking changes
// require a new version module (v2/) rather than modifying this file.
// Additive changes (new endpoints, new optional fields) are allowed.

export * from './router'

export const API_VERSION = 'v1' as const
export const API_BASE_PATH = '/api/v1' as const
