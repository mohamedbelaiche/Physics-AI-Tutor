'use strict';
/**
 * scripts/build-course-content.js
 *
 * يبني public/course/course.json من الويكي (KNOWLEDGE_BASE/):
 *   - كل ملف درس (KNOWLEDGE_BASE/lessons/*.md) = كورس واحد.
 *   - كل فقرة «## N.» في الدرس = مقطع lesson في الكورس.
 *   - المفاهيم المرتبطة تُجلب مقاطع قصيرة (excerpt) من KNOWLEDGE_BASE/concepts/.
 *   - الصيغ المرتبطة تُجلب من KNOWLEDGE_BASE/formulas/ عبر related_formulas للمفاهيم.
 *
 * لا يلمس أي مصدر خام. يعيد كتابة course.json فقط.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const KB = path.join(ROOT, 'KNOWLEDGE_BASE');
const LESSONS_DIR = path.join(KB, 'lessons');
const CONCEPTS_DIR = path.join(KB, 'concepts');
const FORMULAS_DIR = path.join(KB, 'formulas');
const OUT_FILE = path.join(ROOT, 'public', 'course', 'course.json');
const UNITS_FILE = path.join(ROOT, 'public', 'units.json');

const EXCERPT_MAX = 400;

/* ---------- helpers ---------- */

function parseFrontmatter(content) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(content);
  if (!m) return { fm: {}, body: content.trim() };
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

function readDirMd(dir) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (err) {
    return [];
  }
  const out = [];
  for (const entry of entries) {
    if (entry.isFile() && /\.md$/i.test(entry.name)) out.push(entry.name);
  }
  return out;
}

function loadPage(file) {
  let raw;
  try {
    raw = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
  } catch (err) {
    return null;
  }
  const { fm, body } = parseFrontmatter(raw);
  return { fm, body, name: path.basename(file, '.md') };
}

/* يقطع جسم الدرس إلى مقاطع: كل «## » فقرة = مقطع. يتجاهل h1 العليا. */
function splitSections(body) {
  const lines = body.split(/\r?\n/);
  const sections = [];
  let current = null;

  for (const line of lines) {
    if (/^##\s+/.test(line)) {
      if (current && current.contentBuf.length) {
        current.content = current.contentBuf.join('\n').trim();
        sections.push(current);
      }
      current = {
        title: line.replace(/^##\s+/, '').trim(),
        num: sections.length + 1,
        contentBuf: []
      };
      continue;
    }
    if (!current) continue; // يتجاوز h1 والمقدمة
    current.contentBuf.push(line);
  }
  if (current && current.contentBuf.length) {
    current.content = current.contentBuf.join('\n').trim();
    sections.push(current);
  }
  return sections.map((s) => ({ num: s.num, title: s.title, content_md: s.content }));
}

/* مقتطف من صفحة مفهوم/صيغة: أول فقرة نثرية بعد العناوين (يتجاهل h1..h6). */
function excerptOf(page) {
  const body = page.body.replace(/^#{1,6}\s+.*$/gm, '').trim();
  const paragraphs = body
    .split(/\n\s*\n/)
    .map((b) => b.replace(/\s*\n\s*/g, ' ').trim())
    .filter((b) => b.length > 0);
  let text = paragraphs[0] || '';
  if (text.length > EXCERPT_MAX) text = text.slice(0, EXCERPT_MAX).replace(/[^\s]+$/, '') + '…';
  return text;
}

function loadUnitDescriptions() {
  let raw;
  try {
    raw = fs.readFileSync(UNITS_FILE, 'utf8');
  } catch (err) {
    return {};
  }
  const data = JSON.parse(raw);
  const map = {};
  (data.units || []).forEach((u) => {
    map[u.id] = u.description || '';
  });
  return map;
}

/* ---------- main ---------- */

function build() {
  if (!fs.existsSync(LESSONS_DIR)) {
    console.error('لم يُعثر على KNOWLEDGE_BASE/lessons — شغّل بعد التأكد من وجود الويكي.');
    process.exit(1);
  }

  // فهرس الصفحات حسب الاسم المختصر و المعرّف الكامل.
  const conceptMap = {};
  for (const name of readDirMd(CONCEPTS_DIR)) {
    const page = loadPage(path.join(CONCEPTS_DIR, name));
    if (!page) continue;
    const full = (page.fm.id || 'concept/' + page.name).replace(/^concept\//, '');
    conceptMap[page.name] = page;
    conceptMap[full] = conceptMap[full] || page;
  }
  const formulaMap = {};
  for (const name of readDirMd(FORMULAS_DIR)) {
    const page = loadPage(path.join(FORMULAS_DIR, name));
    if (!page) continue;
    const full = (page.fm.id || 'formula/' + page.name).replace(/^formula\//, '');
    formulaMap[page.name] = page;
    formulaMap[full] = formulaMap[full] || page;
  }

  const unitDescs = loadUnitDescriptions();

  const lessons = readDirMd(LESSONS_DIR)
    .map((name) => loadPage(path.join(LESSONS_DIR, name)))
    .filter(Boolean)
    .filter((p) => p.fm.type === 'lesson' && p.fm.id)
    .sort((a, b) => Number(a.fm.order || 99) - Number(b.fm.order || 99));

  const courses = lessons.map((lesson) => {
    const baseId = String(lesson.fm.unit || lesson.name);
    const conceptsIds = Array.isArray(lesson.fm.concepts) ? lesson.fm.concepts : [];

    const concepts = conceptsIds
      .map((id) => conceptMap[id])
      .filter(Boolean)
      .map((p) => ({
        id: p.fm.id || 'concept/' + p.name,
        title_ar: p.fm.title_ar || p.name,
        excerpt: excerptOf(p)
      }));

    // صيغ مرتبطة عبر related_formulas لمفاهيم الكورس.
    const formulaIds = new Set();
    concepts.forEach((c) => {
      const pg = conceptMap[c.id.replace(/^concept\//, '')];
      (pg && Array.isArray(pg.fm.related_formulas) ? pg.fm.related_formulas : []).forEach((f) => {
        formulaIds.add(f.replace(/^formula\//, ''));
      });
    });
    const formulas = Array.from(formulaIds)
      .map((id) => formulaMap[id])
      .filter(Boolean)
      .map((p) => ({
        id: p.fm.id || 'formula/' + p.name,
        title_ar: p.fm.title_ar || p.name,
        symbol: p.fm.symbol || ''
      }));

    return {
      id: baseId,
      slug: lesson.name,
      title_ar: lesson.fm.title_ar || lesson.name,
      description: unitDescs[baseId] || '',
      order: Number(lesson.fm.order || 0),
      status: lesson.fm.status || 'needs_review',
      prerequisites: Array.isArray(lesson.fm.prerequisites) ? lesson.fm.prerequisites : [],
      skills: Array.isArray(lesson.fm.skills) ? lesson.fm.skills : [],
      concepts_ids: conceptsIds,
      concepts,
      formulas,
      sections: splitSections(lesson.body)
    };
  });

  const out = {
    version: 1,
    generatedAt: new Date().toISOString(),
    courses
  };

  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(out, null, 2), 'utf8');

  let sectionCount = 0;
  courses.forEach((c) => (sectionCount += c.sections.length));
  console.log('تم توليد ' + OUT_FILE);
  console.log('  الكورسات: ' + courses.length);
  console.log('  المقاطع: ' + sectionCount);
  console.log('  المفاهيم المرتبطة: ' + courses.reduce((n, c) => n + c.concepts.length, 0));
  console.log('  الصيغ المرتبطة: ' + courses.reduce((n, c) => n + c.formulas.length, 0));
}

if (require.main === module) build();
module.exports = { build };