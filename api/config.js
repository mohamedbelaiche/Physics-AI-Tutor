// Public client configuration for Supabase.
// Serves only publishable values (URL + anon key). No service_role or secrets.

// Publishable fallbacks (same values as public/supabase-config.js)
const FALLBACK_SUPABASE_URL = 'https://utwhqgbotlejfhcupnny.supabase.co';
const FALLBACK_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0d2hxZ2JvdGxlamZoY3Vwbm55Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg4ODIwNTAsImV4cCI6MjEwNDQ1ODA1MH0.bDu8LjiS12geCcjtjoQX0JcUXeTM4GZTkn3dEqxq1-w';

const handler = function (req, res) {
  if (req.method !== 'GET') {
    res.writeHead(405, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  const url = process.env.SUPABASE_URL || FALLBACK_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY || FALLBACK_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(
      JSON.stringify({
        error:
          'SUPABASE_URL أو SUPABASE_ANON_KEY غير معرّفين. أضفهما إلى متغيرات البيئة.'
      })
    );
    return;
  }

  res.writeHead(200, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(JSON.stringify({ url: url, anonKey: anonKey }));
};

module.exports = handler;
module.exports.default = handler;