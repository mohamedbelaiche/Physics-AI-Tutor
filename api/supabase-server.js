// Server-side Supabase helpers shared by api/* handlers.
// Uses the anon key + user JWT to talk to the Data API, never service_role.

const { createClient } = require('@supabase/supabase-js');

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error('SUPABASE_URL أو SUPABASE_ANON_KEY غير معرّفين');
  }
  return createClient(url, anonKey, { auth: { persistSession: false } });
}

function extractBearer(req) {
  const header = req.headers.authorization || '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match ? match[1].trim() : null;
}

// Resolve the authenticated user from the Authorization header.
// Returns { userId } on success or throws { code, message }.
async function requireUser(req, res) {
  const token = extractBearer(req);
  if (!token) {
    res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'غير مصرّح. سجّل الدخول أولاً.' }));
    return null;
  }

  try {
    const supabase = getSupabase();
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) {
      res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'جلسة غير صالحة أو منتهية. سجّل الدخول مجدداً.' }));
      return null;
    }
    return { userId: data.user.id, user: data.user, supabase };
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'تعذر التحقق من الجلسة: ' + err.message }));
    return null;
  }
}

module.exports = { getSupabase, requireUser, extractBearer };