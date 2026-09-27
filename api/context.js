'use strict';
/**
 * api/context.js — builds the AI tutor's system context from the WIKI
 * (KNOWLEDGE_BASE/), not from the raw sources under api/data.
 *
 * This is the Query half of the LLM Wiki pattern (see AGENTS.md):
 *   - a compact catalog of the whole wiki (units + concepts + formulas +
 *     every archived baccalaureate exercise),
 *   - the most relevant lesson page(s) for the student's question,
 *   - the most relevant concept/formula pages for that question,
 *   - the full text of the baccalaureate exercises the student asked for,
 *     plus their solutions only when a solution is requested.
 *
 * The wiki structure is parsed once and cached; each request recomposes a
 * context string tailored to the query. If the wiki is absent, we fall back
 * to the legacy behavior (raw lesson files under api/data).
 */

const fs = require('fs');
const path = require('path');

const KB_ROOT = path.join(__dirname, '..', 'KNOWLEDGE_BASE');
const DATA_ROOT = path.join(__dirname, 'data');

const MAX_CATALOG = 18000;
const MAX_LESSON_TOP = 16000;
const MAX_LESSON_CAPPED = 6000;
const MAX_EXTRA_PAGE = 2200;
const MAX_EXTRA_PAGES = 5;
const MAX_TOTAL = 60000;

// Baccalaureate exams: the catalog lists them all, but their bodies are only
// injected when the student actually asks for an exam (a year, or a solution).
const MAX_EXERCISE_BUDGET = 12000;
const MAX_EXERCISES = 3;
const MAX_SOLUTIONS = 2;
const MAX_EXERCISE_PAGE = 3000;
const MAX_SOLUTION_PAGE = 2600;

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
  return { fm, body: content.slice(m[0].length).trim() };
}

function typeFromRel(rel) {
  if (rel.startsWith('lessons/')) return 'lesson';
  if (rel.startsWith('concepts/')) return 'concept';
  if (rel.startsWith('formulas/')) return 'formula';
  if (rel.startsWith('exercises/')) return 'exercise';
  if (rel.startsWith('solutions/')) return 'solution';
  return null;
}

// Arabic-Indic digits -> ASCII, so "بكالوريا ٢٠٠٨" resolves like "2008".
function normalizeDigits(text) {
  return String(text || '').replace(/[\u0660-\u0669\u06f0-\u06f9]/g, function (d) {
    const code = d.charCodeAt(0);
    const base = code >= 0x06f0 ? 0x06f0 : 0x0660;
    return String(code - base);
  });
}

const UNIT_LABELS = {
  unit1: 'الوحدة الأولى',
  unit2: 'الوحدة الثانية',
  unit3: 'الوحدة الثالثة',
  unit4: 'الوحدة الرابعة',
  unit5: 'الوحدة الخامسة'
};

// The ordinal stem carries no article of its own: the optional (?:ال)? before it
// has to be able to consume "ال", otherwise "الوحدة الثانية" cannot match.
const UNIT_ALIASES = [
  [/(?:ال)?وحدة\s*(?:ال)?(?:اولى|أولى|1)(?![0-9])/u, 'unit1'],
  [/(?:ال)?وحدة\s*(?:ال)?(?:ثانية|2)(?![0-9])/u, 'unit2'],
  [/(?:ال)?وحدة\s*(?:ال)?(?:ثالثة|3)(?![0-9])/u, 'unit3'],
  [/(?:ال)?وحدة\s*(?:ال)?(?:رابعة|4)(?![0-9])/u, 'unit4'],
  [/(?:ال)?وحدة\s*(?:ال)?(?:خامسة|5)(?![0-9])/u, 'unit5'],
  [/\bunit[_\s-]?0?([1-5])(?![0-9])/iu, function (m) { return 'unit' + m[1]; }]
];

// "حل" / "الحل" / "حلول" as a standalone word — must not match "تحليل".
const SOLUTION_INTENT = /(^|[\s،.:؛?!])(?:ال)?حل(?:و|ول)?(?:ه|ها|اً|ً)?(?=[\s،.:؛?!]|$)/u;

function unitOf(page) {
  if (page.fm.unit) return String(page.fm.unit);
  // No trailing \b: in "unit_02_bac2008" the digit is followed by "_", so there
  // is no word boundary there and \b would reject every exercise id.
  const m = /\bunit[_\s-]?0?([1-5])(?![0-9])/i.exec(page.fm.id || page.rel || '');
  return m ? 'unit' + m[1] : '';
}

function wantsSolutions(query) {
  return SOLUTION_INTENT.test(normalizeDigits(query));
}

function queryYears(query) {
  const found = normalizeDigits(query).match(/(?:19|20)\d{2}/g);
  return found ? Array.from(new Set(found)) : [];
}

function queryUnit(query) {
  const q = normalizeDigits(query);
  for (const [re, unit] of UNIT_ALIASES) {
    const m = re.exec(q);
    if (m) return typeof unit === 'function' ? unit(m) : unit;
  }
  return '';
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
  const exercises = pages
    .filter((p) => p.type === 'exercise')
    .sort((a, b) => exerciseSortKey(a) - exerciseSortKey(b) || String(a.fm.id).localeCompare(String(b.fm.id)));
  const withSolution = new Set(
    pages.filter((p) => p.type === 'solution' && p.fm.exercise_ref).map((p) => p.fm.exercise_ref)
  );
  const lines = [];

  lines.push(
    'هذه قاعدة المعرفة (الويكي) لمشروع "المدرس الشخصي للفيزياء" — ' +
    'العلوم الفيزيائية، بكالوريا الجزائر، السنة الثالثة ثانوي (علوم تجريبية، رياضيات، تقني رياضي).'
  );
  lines.push('الويكي يضم: ' + lessons.length + ' درسًا، ' + concepts.length + ' مفهومًا، ' +
    formulas.length + ' صيغة، و' + exercises.length + ' تمرين بكالوريا' +
    (withSolution.size ? ' (مع ' + withSolution.size + ' حلًا موثقًا).' : '.'));
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
  lines.push('');

  lines.push('### تمارين بكالوريا (مخزّنة كاملة — أَعِد نصَّ التمرين المطلوب منها حرفيًا، وحلّه فقط عند الطلب)');
  for (const p of exercises) {
    const unit = unitOf(p);
    const meta = [];
    if (p.fm.year) meta.push(String(p.fm.year));
    if (p.fm.stream) meta.push(String(p.fm.stream));
    if (unit) meta.push(UNIT_LABELS[unit] || unit);
    if (p.fm.topic) meta.push(String(p.fm.topic));
    const mark = withSolution.has(p.fm.id) ? ' ✓(له حل)' : '';
    lines.push(
      '- `' + p.fm.id + '` — ' + (meta.length ? meta.join(' · ') : (p.fm.title_ar || p.rel)) + mark
    );
  }

  return lines.join('\n');
}

function exerciseSortKey(page) {
  const y = parseInt(page.fm.year, 10);
  return Number.isFinite(y) ? y : 9999;
}

function sliceTo(lines, head, max) {
  const block = head + '\n' + lines;
  return block.length > max ? block.slice(0, max) + '\n…' : block;
}

/* ---------- context composition ---------- */

function buildWikiContext(query) {
  const wiki = loadWiki();
  const qTokens = tokens(normalizeDigits(query));

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

  // Baccalaureate exams. Their bodies stay out of the context until the
  // student asks for an exam, so a normal physics question keeps its budget
  // and an exam request gets the real archived text instead of a hallucination.
  const exam = buildExamContext(wiki.pages, query, qTokens, MAX_TOTAL - used);
  for (const block of [exam.header].concat(exam.blocks)) {
    if (!block || exam.budgetLeft < 400) break;
    const cap = block.slice(0, Math.min(block.length, exam.budgetLeft));
    exam.budgetLeft -= cap.length;
    parts.push(cap);
    used += cap.length;
  }

  let ctx = parts.join('\n');
  if (ctx.length > MAX_TOTAL) {
    ctx = ctx.slice(0, MAX_TOTAL) + '\n…(مقتطع لضيق المساحة)';
  }
  return ctx;
}

/* ---------- baccalaureate exams ---------- */

// Ranks exercises for a query. A stated year and a stated unit are both hard
// filters — "the 2015 exam of unit 2" must never return a 2016 paper — and
// free-text matches only order what is left.
function rankExercises(pages, qTokens, years, unit) {
  const byYear = new Set(years);
  return pages
    .filter(function (p) {
      if (unit && unitOf(p) !== unit) return false;
      if (byYear.size && !byYear.has(String(p.fm.year || ''))) return false;
      return true;
    })
    .map(function (p) {
      return { p: p, s: scorePage(p, qTokens) * 5, unit: unitOf(p) };
    })
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || String(a.p.fm.id).localeCompare(String(b.p.fm.id)));
}

// When the student names no unit, take one exercise per unit, walking the
// units in syllabus order, so a bare "exam 2008" spans the year instead of
// returning three exercises from whichever unit happened to score highest.
function pickExercises(ranked, limit, diversify) {
  const out = [];
  if (diversify) {
    const groups = new Map();
    for (const x of ranked) {
      const key = x.unit || '';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(x);
    }
    for (const key of Array.from(groups.keys()).sort()) {
      if (out.length >= limit) break;
      out.push(groups.get(key)[0]);
    }
  }
  for (const x of ranked) {
    if (out.length >= limit) break;
    if (out.indexOf(x) === -1) out.push(x);
  }
  return out;
}

function buildExamContext(pages, query, qTokens, budgetLeft) {
  const result = { header: null, blocks: [], budgetLeft: Math.min(budgetLeft, MAX_EXERCISE_BUDGET) };
  if (result.budgetLeft < 800) return result;

  const years = queryYears(query);
  const unit = queryUnit(query);
  const withSolution = wantsSolutions(query);
  // An exam is requested by naming a year, or by asking for a solution.
  if (!years.length && !withSolution) return result;

  const exercises = pages.filter((p) => p.type === 'exercise' && p.fm.year);
  if (!exercises.length) return result;

  const ranked = rankExercises(exercises, qTokens, years, unit);

  const solutionsByExercise = new Map();
  if (withSolution) {
    for (const s of pages) {
      if (s.type === 'solution' && s.fm.exercise_ref) {
        solutionsByExercise.set(String(s.fm.exercise_ref), s);
      }
    }
  }

  // Asking for a solution means the student expects one: prefer exercises whose
  // solution is archived, otherwise the model would answer "no solution" for an
  // exam that does have one under a different unit.
  const solved = ranked.filter((x) => solutionsByExercise.has(String(x.p.fm.id)));
  const pool = withSolution && solved.length ? solved : ranked;

  const chosen = pickExercises(pool, MAX_EXERCISES, !unit);
  if (!chosen.length) return result;

  result.header =
    '\n\n## تمارين بكالوريا المطلوبة\n' +
    'النصوص التالية من أرشيف المشروع verbatim. أَعِد نص التمرين كما هو، ولا تضف ولا تحذف. ' +
    'الحلول أدناه للطلب فقط — لا تعطِ الحل إن لم يُطلب.';

  let solutionsUsed = 0;
  for (const x of chosen) {
    const head = '`' + x.p.fm.id + '` — ' + (x.p.fm.title_ar || x.p.rel);
    result.blocks.push(('\n\n## تمرين: ' + head + '\n' + x.p.body).slice(0, MAX_EXERCISE_PAGE));

    const solution = solutionsByExercise.get(String(x.p.fm.id));
    if (solution && solutionsUsed < MAX_SOLUTIONS) {
      const sBlock = '\n\n## حل: `' + solution.fm.id + '`\n' + solution.body;
      result.blocks.push(sBlock.slice(0, MAX_SOLUTION_PAGE));
      solutionsUsed++;
    }
  }

  return result;
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