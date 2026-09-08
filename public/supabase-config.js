// Global configuration for the Supabase frontend client.
// Preference: values are fetched from /api/config at runtime.
// Fallback: the publishable values below (URL + anon key) are NOT secrets —
// the anon key is designed to be exposed in the browser (RLS enforces access).
// No service_role or any secret lives in the frontend.

window.__SUPABASE_CONFIG__ = window.__SUPABASE_CONFIG__ || {
  url: 'https://utwhqgbotlejfhcupnny.supabase.co',
  anonKey:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0d2hxZ2JvdGxlamZoY3Vwbm55Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg4ODIwNTAsImV4cCI6MjEwNDQ1ODA1MH0.bDu8LjiS12geCcjtjoQX0JcUXeTM4GZTkn3dEqxq1-w'
};