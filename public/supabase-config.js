// Global configuration for the Supabase frontend client.
// Values are injected server-side (server.js locally, api/env.js on Vercel).
// This file only holds a fallback; no secrets are stored here.

window.__SUPABASE_CONFIG__ = window.__SUPABASE_CONFIG__ || {
  url: '',
  anonKey: ''
};