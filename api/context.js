'use strict';
/**
 * api/context.js — builds the AI tutor's system context from the WIKI
 * (KNOWLEDGE_BASE/), not from the raw sources under api/data.
 *
 * This is the Query half of the LLM Wiki pattern (see AGENTS.md):
 *   - a compact catalog of the whole wiki (units + concepts + formulas),
 *   - the most relevant lesson page(s) for the student's question,
 *   - the most relevant concept/formula pages for that question.
 *
 * The wiki structure is parsed once and cached; each request recomposes a
 * context string tailored to the query. If the wiki is absent, we fall back
 * to the legacy behavior (raw lesson files under api/data).
 */

const fs = require('fs');
const path = require('path');

const KB_ROOT = path.join(__dirname, '..', 'KNOWLEDGE_BASE');
const DATA_ROOT = path.join(__dirname, 'data');

const MAX_CATALOG = 7000;
const MAX_LESSON_TOP = 16000;
const MAX_LESSON_CAPPED = 6000;
const MAX_EXTRA_PAGE = 2200;
const MAX_EXTRA_PAGES = 5;
const MAX_TOTAL = 60000;

let wikiPromise = null;

/* ---------- generic helpers ---------- */

function walk(dir, out) {
  out = out || [];
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (err) {
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, out);
    } else if (entry.isFile() && /\.md$/i.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

function parseFrontmatter(content) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(content);
  if (!m) return { fm: {}, body: content };
  const lines = m[1].split(/\r?\n/);
  const fm = {};
  let key = null;
  for (const line of lines) {
    const kv = /^([A-Za-z_][A-Za-z0-9_]*):\s*(.*)$/.exec(line);
    if (kv) {
      key = kv[1];
      let val = kv[2].trim();
      if (val === '') {
        fm[key] = [];
      } else if (val.startsWith('[') && val.endsWith(']')) {
        const inner = val.slice(1, -1).trim();
        fm[key] = inner === '' ? [] : inner.split(',').map((s) => s.trim().replace(/^["']|["']$/g, ''));
      } else {
        fm[key] = val.replace(/^"(.*)"$/, '$1').trim();
      }
    } else if (key && Array.isArray(fm[key]) && /^\s*-\s+/.test(line)) {
      fm[key].push(line.replace(/^\s*-\s+/, '').trim().replace(/^"(.*)"$/, '$1'));
    }
  }
  return { fm, body: content.slice(m[0][0].length).trim() };
}

function typeFromRel(rel) {
  if (rel.startsWith('lessons/')) return 'lesson';
  if (rel.startsWith('concepts/')) return 'concept';
  if (rel.startsWith('formulas/')) return 'formula';
  return null;
}

function tokens(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .split(' ')
    .filter((t) => t.length >= 2);
}

function scorePage(page, qTokens) {
  const hay =
    (page.fm.title_ar || '') + ' ' +
    (page.fm.title_en || '') + ' ' +
    (page.fm.id || '') + ' ' +
    page.body;
  const lower = hay.toLowerCase();
  let hit = 0;
  for (const t of qTokens) if (lower.includes(t)) hit++;
  return hit;
}

/* ---------- wiki loading ---------- */

function loadWiki() {
  const files = walk(KB_ROOT);
  const pages = [];
  const seen = new Set(['index.md', 'log.md', 'README.md', 'validation_report.md']);
  for (const f of files) {
    const rel = path.relative(KB_ROOT, f).split(path.sep).join('/');
    if (seen.has(rel) || rel.endsWith('/README.md')) continue;
    const type = typeFromRel(rel);
    if (!type) continue;
    let raw;
    try {
      raw = fs.readFileSync(f, 'utf8').replace(/^\uFEFF/, '');
    } catch (err) {
      continue;
    }
    const { fm, body } = parseFrontmatter(raw);
    if (!fm.id) continue;
    pages.push({ path: f, rel, type, fm, body });
  }
  return { pages, wikiUp: true };
}

/* ---------- catalog rendering ---------- */

function renderCatalog(pages) {
  const lessons = pages.filter((p) => p.type === 'lesson');
  const concepts = pages.filter((p) => p.type === 'concept');
  const formulas = pages.filter((p) => p.type === 'formula');
  const lines = [];

  lines.push(
    'هذه قاعدة المعرفة (الويكي) لمشروع "المدرس الشخصي للفيزياء" — ' +
    'العلوم الفيزيائية، بكالوريا الجزائر، السنة الثالثة ثانوي (علوم تجريبية، رياضيات، تقني رياضي).'
  );
  lines.push('الويكي يضم: ' + lessons.length + ' درسًا، ' + concepts.length + ' مفهومًا، ' +
    formulas.length + ' صيغة، وتمارين بكالوريا مع حلول موثقة.');
  lines.push('');

  lines.push('### الدروس (وحدات)');
  for (const p of lessons) {
    const conceptsList = (p.fm.concepts || []).join('، ');
    lines.push('- `' + p.fm.id + '` — ' + (p.fm.title_ar || p.rel) + (conceptsList ? ' — مفاهيم: ' + conceptsList : ''));
  }
  lines.push('');

  lines.push('### المفاهيم');
  for (const p of concepts) {
    lines.push('- `' + p.fm.id + '` — ' + (p.fm.title_ar || p.rel));
  }
  lines.push('');

  lines.push('### الصيغ');
  for (const p of formulas) {
    lines.push('- `' + p.fm.id + '` — ' + (p.fm.title_ar || p.rel) + (p.fm.symbol ? ' — ' + p.fm.symbol : ''));
  }

  return lines.join('\n');
}

function sliceTo(lines, head, max) {
  const block = head + '\n' + lines;
  return block.length > max ? block.slice(0, max) + '\n…' : block;
}

/* ---------- context composition ---------- */

function buildWikiContext(query) {
  const wiki = loadWiki();
  const qTokens = tokens(query);

  const lessons = wiki.pages.filter((p) => p.type === 'lesson');
  const concepts = wiki.pages.filter((p) => p.type === 'concept');
  const formulas = wiki.pages.filter((p) => p.type === 'formula');

  const rankedLessons = lessons
    .map((p) => ({ p, s: scorePage(p, qTokens) }))
    .sort((a, b) => b.s - a.s || a.p.fm.order - b.p.fm.order);
  const rankedConcepts = concepts
    .map((p) => ({ p, s: scorePage(p, qTokens) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s);
  const rankedFormulas = formulas
    .map((p) => ({ p, s: scorePage(p, qTokens) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s);

  // Choose lesson(s) to include in depth: the ones matching the query,
  // otherwise the first lesson. Relevant lessons are capped per budget.
  const hitLessons = rankedLessons.filter((x) => x.s > 0);
  const chosen = hitLessons.length ? hitLessons.slice(0, 2) : [rankedLessons[0]];

  const parts = [];
  parts.push('# قاعدة المعرفة (الويكي)\n');
  parts.push(sliceTo(renderCatalog(wiki.pages), '', MAX_CATALOG));

  let used = parts.join('\n').length;

  for (let i = 0; i < chosen.length && used < MAX_TOTAL; i++) {
    const page = chosen[i].p;
    const budget = i === 0 ? MAX_LESSON_TOP : MAX_LESSON_CAPPED;
    const block = '\n\n## ' + (page.fm.title_ar || page.rel) + '\n' + page.body;
    const cap = block.slice(0, budget);
    parts.push(cap);
    used += cap.length;
  }

  const extras = rankedConcepts
    .concat(rankedFormulas)
    .sort((a, b) => b.s - a.s)
    .slice(0, MAX_EXTRA_PAGES);
  for (const x of extras) {
    if (used >= MAX_TOTAL) break;
    const page = x.p;
    const block = '\n\n## ' + (page.fm.title_ar || page.rel) + '\n' + page.body;
    const cap = block.slice(0, MAX_EXTRA_PAGE);
    parts.push(cap);
    used += cap.length;
  }

  let ctx = parts.join('\n');
  if (ctx.length > MAX_TOTAL) {
    ctx = ctx.slice(0, MAX_TOTAL) + '\n…(مقتطع لضيق المساحة)';
  }
  return ctx;
}

/* ---------- legacy fallback (raw files) ---------- */

const MAX_TEXT_PER_FILE = 22000;

function listLegacyMarkdown(dir, out) {
  out = out || [];
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (err) {
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) listLegacyMarkdown(full, out);
    else if (entry.isFile() && /\.md$/i.test(entry.name)) out.push(full);
  }
  return out;
}

function buildLegacyContext() {
  const files = listLegacyMarkdown(DATA_ROOT);
  const parts = ['الوحدات الدراسية المتوفرة في المشروع وملخصاتها:'];
  for (const file of files) {
    let content;
    try {
      content = fs.readFileSync(file, 'utf8');
    } catch (err) {
      continue;
    }
    const rel = path.relative(DATA_ROOT, file);
    parts.push('## الوحدة: ' + rel);
    const body = content.trim();
    parts.push(body ? body.slice(0, MAX_TEXT_PER_FILE) : '(ملف فارغ)');
  }
  let ctx = parts.join('\n\n');
  if (ctx.length > MAX_TOTAL) ctx = ctx.slice(0, MAX_TOTAL) + '\n…(مقتطع لضيق المساحة)';
  return ctx;
}

/* ---------- public API ---------- */

// query: optional latest student question used to select the most relevant
// wiki pages. When omitted, the first lesson is loaded as fallback.
function getProjectContext(query) {
  const wikiUp = fs.existsSync(path.join(KB_ROOT, 'lessons'));
  if (!wikiUp) return buildLegacyContext();
  return buildWikiContext(query || '');
}

module.exports = { getProjectContext };