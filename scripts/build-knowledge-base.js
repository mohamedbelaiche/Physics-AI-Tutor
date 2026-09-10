'use strict';
/**
 * build-knowledge-base.js
 *
 * Generates KNOWLEDGE_BASE/manifest.json and KNOWLEDGE_BASE/relationships/index.json
 * from the frontmatter of all .md records inside KNOWLEDGE_BASE.
 *
 * Principles (strict, per task spec):
 *  - Raw files under api/data/البيانات are immutable; this script never writes them.
 *  - Only facts present in record frontmatter are emitted as "explicit" links.
 *  - exercise->concept links derived from the exercise `topic` string via a
 *    conservative Arabic keyword map are tagged method: "derived_topic_keyword"
 *    and must be human-reviewed before full acceptance.
 *  - Nothing is fabricated: if a mapping is uncertain it is omitted.
 *
 * Usage: node scripts/build-knowledge-base.js
 */
const fs = require('fs');
const path = require('path');

const KB_ROOT = path.join(__dirname, '..', 'KNOWLEDGE_BASE');
const MANIFEST_PATH = path.join(KB_ROOT, 'manifest.json');
const RELATIONS_PATH = path.join(KB_ROOT, 'relationships', 'index.json');

/* ---------- file walking / frontmatter parsing ---------- */

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.isFile() && full.endsWith('.md')) out.push(full);
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
        fm[key] = val.replace(/^"(.*)"$/, '$1').replace(/'?(.*)'?\s*$/, '$1').trim();
        if (fm[key] === 'true') fm[key] = true;
        else if (fm[key] === 'false') fm[key] = false;
      }
    } else if (key && Array.isArray(fm[key]) && /^\s*-\s+/.test(line)) {
      fm[key].push(line.replace(/^\s*-\s+/, '').trim().replace(/^"(.*)"$/, '$1'));
    }
  }
  return { fm, body: content.slice(m[0][0].length) };
}

const relToKb = (p) => p.split(KB_ROOT + path.sep)[1].split(path.sep).join('/');

/* ---------- record model ---------- */

function classify(pathRel) {
  if (pathRel.startsWith('lessons/')) return 'lesson';
  if (pathRel.startsWith('concepts/')) return 'concept';
  if (pathRel.startsWith('formulas/')) return 'formula';
  if (pathRel.startsWith('exercises/')) return 'exercise';
  if (pathRel.startsWith('solutions/')) return 'solution';
  return null;
}

function unitFromPath(pathRel) {
  const m = /unit_(\d{2})/.exec(pathRel);
  // the segment after unit_ (e.g. unit_03) is the unit number
  return m ? 'unit' + String(Number(m[1])) : null;
}

function normalizeId(fm, pathRel, type) {
  if (fm.id) return fm.id;
  // fallback: nothing if id missing
  return null;
}

/* ---------- topic -> concept keyword mapper (conservative) ---------- */

function topicConceptsUnit3(topic) {
  const set = [];
  const add = (c) => { if (!set.includes(c)) set.push(c); };
  const t = topic || '';
  if (/RLC/.test(t)) {
    add('concept/capacitor'); add('concept/rc_dipole'); add('concept/time_constant_rc');
    add('concept/coil'); add('concept/rl_dipole'); add('concept/time_constant_rl');
  }
  if (/RC|مكثف/.test(t)) {
    add('concept/capacitor');
    add('concept/rc_dipole');
    add('concept/time_constant_rc');
  }
  if (/RL|وشيعة/.test(t)) {
    add('concept/coil');
    add('concept/rl_dipole');
    add('concept/time_constant_rl');
  }
  if (/طاقة/.test(t) && /RC|مكثف/.test(t)) add('concept/capacitor_energy');
  if (/طاقة/.test(t) && /RL|وشيعة/.test(t)) add('concept/coil_energy');
  if (/ومكثفة|وشيعة/.test(t) && /مكثف/.test(t)) {
    add('concept/capacitor'); add('concept/rc_dipole'); add('concept/coil'); add('concept/rl_dipole');
  }
  return set;
}

function topicConceptsUnit4(topic) {
  const set = [];
  const add = (c) => { if (!set.includes(c)) set.push(c); };
  const t = topic || '';
  if (/ناقلي/.test(t)) add('concept/conductivity');
  if (/معايرة|pH|قياس|تكافؤ/.test(t)) add('concept/ph_measurement');
  if (/pKa|Ka|K|ثابت التوازن/.test(t)) add('concept/equilibrium_constant');
  if (/τf|تقدم|Qr|محدود/.test(t)) add('concept/final_progress_ratio');
  if (/محدود/.test(t)) add('concept/limited_vs_complete_reaction');
  if (/قوة|ضعيف|مقارنة|قوي/.test(t)) add('concept/acid_base_strength');
  if (/الغالبة|مجال/.test(t)) add('concept/dominant_species');
  if (/أسترة|صابونة/.test(t) && /تقدم|K|Qr/.test(t)) add('concept/final_progress_ratio');
  return set;
}

function topicConcepts(unit, topic) {
  if (unit === 'unit3') return topicConceptsUnit3(topic);
  if (unit === 'unit4') return topicConceptsUnit4(topic);
  return [];
}

/* ---------- collect records ---------- */

const mdFiles = walk(KB_ROOT)
  .map((p) => relToKb(p))
  .filter((p) => p !== 'README.md' && !p.endsWith('/README.md') && p !== 'validation_report.md');
const records = [];
const statusCounts = {};
const typeCounts = {};

for (const f of mdFiles) {
  const raw = fs.readFileSync(path.join(KB_ROOT, f), 'utf8').replace(/^\uFEFF/, '');
  const { fm } = parseFrontmatter(raw);
  const type = fm.type || classify(f) || 'unknown';
  const unit = fm.unit || unitFromPath(f);
  records.push({ path: f, type, unit, fm });
  typeCounts[type] = (typeCounts[type] || 0) + 1;
  const st = fm.status || 'unknown';
  statusCounts[st] = (statusCounts[st] || 0) + 1;
}

const ids = new Set(records.map((r) => r.fm.id).filter(Boolean));

/* ---------- manifest ---------- */

function entryFor(r) {
  const e = {
    id: r.fm.id || null,
    type: r.type,
    path: r.path,
    unit: r.unit,
    title_ar: r.fm.title_ar || null,
    status: r.fm.status || null,
  };
  if (r.type === 'lesson') {
    e.concepts = (r.fm.concepts || []).map((c) => (c.startsWith('concept/') ? c : 'concept/' + c));
    e.related_formulas = r.fm.related_formulas || [];
    e.skills = r.fm.skills || [];
  }
  if (r.type === 'concept') {
    e.related_concepts = r.fm.related_concepts || [];
    e.related_formulas = r.fm.related_formulas || [];
    e.related_exercises = r.fm.related_exercises || [];
  }
  if (r.type === 'formula') {
    e.symbol = r.fm.symbol || null;
    e.unit = r.fm.unit || null;
    e.related_concepts = r.fm.related_concepts || [];
    e.related_exercises = r.fm.related_exercises || [];
  }
  if (r.type === 'exercise') {
    e.year = r.fm.year || null;
    e.stream = r.fm.stream || null;
    e.topic = r.fm.topic || null;
    e.answers_set = r.fm.answers_set ?? null;
    e.solutions_ref = r.fm.solutions_ref || null;
    e.difficulty = r.fm.difficulty ?? null;
    e.concepts_derived = topicConcepts(r.unit, r.fm.topic);
    e.concepts_explicit = (r.fm.related || []).map((c) => (c.startsWith('concept/') ? c : 'concept/' + c));
  }
  if (r.type === 'solution') {
    e.exercise_ref = r.fm.exercise_ref || null;
    e.year = r.fm.year || null;
    e.stream = r.fm.stream || null;
    e.topic = r.fm.topic || null;
  }
  return e;
}

const lessons = records.filter((r) => r.type === 'lesson');
const concepts = records.filter((r) => r.type === 'concept');
const formulas = records.filter((r) => r.type === 'formula');
const exercises = records.filter((r) => r.type === 'exercise');
const solutions = records.filter((r) => r.type === 'solution');
const others = records.filter((r) => !['lesson', 'concept', 'formula', 'exercise', 'solution'].includes(r.type));

// bac exams grouping
const bacByYear = {};
for (const ex of exercises) {
  if (!ex.fm.year) continue;
  (bacByYear[ex.fm.year] = bacByYear[ex.fm.year] || []).push(ex.fm.id);
}

const manifest = {
  version: '1.0',
  generated_at: new Date().toISOString(),
  generator: 'scripts/build-knowledge-base.js',
  total_items: records.length,
  counts: {
    by_type: typeCounts,
    by_status: statusCounts,
    raw_files_total: 19,
    raw_files_unique_by_hash: 18,
    source_refs_unique: new Set(records.flatMap((r) => r.fm.source_refs || [])).size,
  },
  lessons: lessons.map(entryFor),
  concepts: concepts.map(entryFor),
  formulas: formulas.map(entryFor),
  exercises: exercises.map(entryFor),
  solutions: solutions.map(entryFor),
  other_records: others.map(entryFor),
  bac_exams: Object.keys(bacByYear).sort().map((y) => ({
    year: Number(y),
    exercise_count: bacByYear[y].length,
    exercise_ids: bacByYear[y].sort(),
  })),
};

/* ---------- relationships ---------- */

const edges = [];
function edge(from, to, type, method, source) {
  if (!from || !to) return;
  edges.push({ from, to, type, method, source });
}

for (const l of lessons) {
  for (const c of (l.fm.concepts || [])) edge(l.fm.id, c.startsWith('concept/') ? c : 'concept/' + c, 'lesson_has_concept', 'explicit', l.path);
  for (const f of (l.fm.related_formulas || [])) edge(l.fm.id, f, 'lesson_has_formula', 'explicit', l.path);
}
for (const c of concepts) {
  for (const rc of (c.fm.related_concepts || [])) edge(c.fm.id, rc, 'concept_related_concept', 'explicit', c.path);
  for (const rf of (c.fm.related_formulas || [])) edge(c.fm.id, rf, 'concept_has_formula', 'explicit', c.path);
  for (const re of (c.fm.related_exercises || [])) edge(c.fm.id, re, 'concept_used_in_exercise', 'explicit', c.path);
}
for (const f of formulas) {
  for (const rc of (f.fm.related_concepts || [])) edge(f.fm.id, rc, 'formula_uses_concept', 'explicit', f.path);
  for (const re of (f.fm.related_exercises || [])) edge(f.fm.id, re, 'formula_used_in_exercise', 'explicit', f.path);
}
for (const ex of exercises) {
  for (const c of (ex.fm.related || [])) edge(ex.fm.id, c.startsWith('concept/') ? c : 'concept/' + c, 'exercise_uses_concept', 'explicit', ex.path);
  for (const c of topicConcepts(ex.unit, ex.fm.topic)) edge(ex.fm.id, c, 'exercise_uses_concept', 'derived_topic_keyword', ex.path);
  if (ex.fm.solutions_ref) edge(ex.fm.id, ex.fm.solutions_ref, 'exercise_has_solution', 'explicit', ex.path);
}
for (const s of solutions) {
  if (s.fm.exercise_ref) edge(s.fm.id, s.fm.exercise_ref, 'solution_solves_exercise', 'explicit', s.path);
}

// sanity: dangling references
const dangling = [];
for (const e of edges) {
  if (!ids.has(e.to)) dangling.push(e);
}

const relationships = {
  version: '1.0',
  generated_at: new Date().toISOString(),
  generator: 'scripts/build-knowledge-base.js',
  hierarchy: ['lesson', 'concept', 'formula', 'skill', 'exercise', 'question', 'solution'],
  edge_counts: {
    lesson_has_concept: edges.filter((e) => e.type === 'lesson_has_concept').length,
    lesson_has_formula: edges.filter((e) => e.type === 'lesson_has_formula').length,
    concept_related_concept: edges.filter((e) => e.type === 'concept_related_concept').length,
    concept_has_formula: edges.filter((e) => e.type === 'concept_has_formula').length,
    concept_used_in_exercise: edges.filter((e) => e.type === 'concept_used_in_exercise').length,
    formula_uses_concept: edges.filter((e) => e.type === 'formula_uses_concept').length,
    formula_used_in_exercise: edges.filter((e) => e.type === 'formula_used_in_exercise').length,
    exercise_uses_concept: edges.filter((e) => e.type === 'exercise_uses_concept').length,
    exercise_has_solution: edges.filter((e) => e.type === 'exercise_has_solution').length,
    solution_solves_exercise: edges.filter((e) => e.type === 'solution_solves_exercise').length,
  },
  edges,
  derived_topic_notes: {
    method: 'derived_topic_keyword',
    description: 'exercise_uses_concept بمنهجية topic_keyword: مبنية فقط من حقل topic (نص التمرين) عبر مطابقة مصطلحات محافظة — يجب مراجعتها مع نص التمرين قبل اعتمادها نهائيًا.',
    status: 'needs_review',
  },
  dangling_references: dangling,
};

/* ---------- write ---------- */

fs.mkdirSync(path.dirname(RELATIONS_PATH), { recursive: true });
fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf8');
fs.writeFileSync(RELATIONS_PATH, JSON.stringify(relationships, null, 2), 'utf8');

console.log(JSON.stringify({
  manifest_written: MANIFEST_PATH,
  relationships_written: RELATIONS_PATH,
  counts: { by_type: typeCounts, by_status: statusCounts, total: records.length },
  edges_total: edges.length,
  dangling: dangling.length,
  bac_exams: manifest.bac_exams,
}, null, 2));