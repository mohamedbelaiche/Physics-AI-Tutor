// Executes SQL migrations through the Supabase Management API using the
// OpenCode MCP token. Tracks applied files in a public.migrations_log table
// so re-runs only apply files that have not been applied yet.
const fs = require('fs');
const path = require('path');

const PROJECT_REF = 'utwhqgbotlejfhcupnny';
const TOKEN_FILE = path.join(
  process.env.USERPROFILE,
  '.local',
  'share',
  'opencode',
  'mcp-auth.json'
);

function getToken() {
  const raw = fs.readFileSync(TOKEN_FILE, 'utf8');
  return JSON.parse(raw).supabase.tokens.accessToken;
}

async function runQuery(token, query) {
  const headers = {
    Authorization: 'Bearer ' + token,
    'Content-Type': 'application/json'
  };
  const base = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`;
  const res = await fetch(base, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query })
  });
  const text = await res.text();
  if (!res.ok) {
    let parsed;
    try { parsed = JSON.parse(text); } catch { parsed = text; }
    throw new Error(JSON.stringify(parsed) || text);
  }
  let data;
  try { data = text ? JSON.parse(text) : []; } catch { data = text; }
  return data;
}

async function main() {
  const token = getToken();

  await runQuery(token, `
    create table if not exists public.migrations_log (
      name text primary key,
      applied_at timestamptz not null default now()
    );
  `);

  const applied = await runQuery(
    token,
    `select name from public.migrations_log order by name;`
  );
  const appliedSet = new Set(applied.map((r) => r.name));

  const migrationsDir = path.join(__dirname, '..', 'supabase', 'migrations');
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    if (appliedSet.has(file)) {
      console.log('SKIP (already applied):', file);
      continue;
    }
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    try {
      await runQuery(token, sql);
      await runQuery(token, `insert into public.migrations_log (name) values ('${file}') on conflict do nothing;`);
      console.log('APPLIED:', file);
    } catch (err) {
      console.error('FAILED:', file);
      console.error('   ', err.message.slice(0, 500));
      process.exitCode = 1;
    }
  }
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});