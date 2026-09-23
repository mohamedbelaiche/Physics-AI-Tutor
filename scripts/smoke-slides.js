'use strict';
/**
 * scripts/smoke-slides.js
 *
 * فحص صحة decks الشرائح التفاعلية (بدون إطار اختبارات):
 *   - لكل مجلد داخل public/course/slides/ يجب أن يوجد index.json صالح (version 1).
 *   - الأقسام تطابق مقاطع course.json (num متتالٍ وعناوين مطابقة).
 *   - لكل قسم على الأقل شريحة واحدة، ومعرّفات شرائح فريدة.
 *   - type/layout ضمن القيم المقررة (title|text|formula|table|scene|mixed) و(full|two-col).
 *   - كل scene.svg تشير لملف موجود فعليًا داخل نفس مجلد الأصول.
 *   - صفر إشارات معلّقة: كل script.json في KNOWLEDGE_BASE/slides/<slug>/scenes/ له svg منجزة
 *     ومستشهَدًا بها في index.json.
 *
 * يخرج برمز خطأ غير صفري عند أي فشل مع رسائل واضحة.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const COURSE_FILE = path.join(ROOT, 'public', 'course', 'course.json');
const SLIDES_DIR = path.join(ROOT, 'public', 'course', 'slides');
const KB_SLIDES_DIR = path.join(ROOT, 'KNOWLEDGE_BASE', 'slides');

const TYPES = new Set(['title', 'text', 'formula', 'table', 'scene', 'mixed']);
const LAYOUTS = new Set(['full', 'two-col']);

function dirNames(dir) {
  try {
    return fs.readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
  } catch (err) {
    return [];
  }
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function listMd(dir, ext) {
  try {
    return fs.readdirSync(dir).filter((n) => n.endsWith(ext));
  } catch (err) {
    return [];
  }
}

function main() {
  const errors = [];

  if (!fs.existsSync(COURSE_FILE)) {
    console.error('SMOKE FAILED: لا يوجد public/course/course.json — شغّل scripts/build-course-content.js أولاً.');
    process.exit(1);
  }
  const courseData = readJson(COURSE_FILE);
  const coursesById = {};
  (courseData.courses || []).forEach((c) => { coursesById[c.slug] = c; });

  const slugs = dirNames(SLIDES_DIR);
  if (slugs.length === 0) {
    console.log('SMOKE OK: لا توجد decks شرائح بعد (public/course/slides فارغ).');
    return;
  }

  // جمع كل scene.svg منتجًا ومستشهَدًا به لفحص الترابط العكسي.
  const producedSvg = new Set();   // كل assets/*.svg على القرص
  const referencedSvg = new Set(); // كل scene.svg في index.json

  slugs.forEach((slug) => {
    const deckDir = path.join(SLIDES_DIR, slug);
    const indexFile = path.join(deckDir, 'index.json');
    if (!fs.existsSync(indexFile)) {
      errors.push(`${slug}: لا يوجد index.json`);
      return;
    }
    let data;
    try {
      data = readJson(indexFile);
    } catch (err) {
      errors.push(`${slug}: index.json غير صالح كـ JSON: ${err.message}`);
      return;
    }

    if (data.version !== 1) errors.push(`${slug}: version ليس 1`);
    if (data.course_slug !== slug) errors.push(`${slug}: course_slug لا يطابق اسم المجلد`);
    if (!Array.isArray(data.sections)) { errors.push(`${slug}: sections ليس مصفوفة`); return; }

    // مطابقة مع course.json
    const refCourse = coursesById[slug];
    if (refCourse) {
      const refSections = refCourse.sections || [];
      if (data.sections.length !== refSections.length) {
        errors.push(`${slug}: عدد الأقسام ${data.sections.length} لا يطابق course.json (${refSections.length})`);
      }
      data.sections.forEach((s, i) => {
        const ref = refSections[i];
        if (!ref) return;
        if (s.num !== ref.num) errors.push(`${slug}: num عند الموضع ${i} = ${s.num} والمرجع ${ref.num}`);
        if (s.title !== ref.title) errors.push(`${slug}: عنوان القسم ${s.num} لا يطابق المرجع`);
      });
    } else {
      errors.push(`${slug}: لا يوجد كورس مطابق في course.json (slug غير موجود)`);
    }

    const seenSlideIds = new Set();
    data.sections.forEach((sec) => {
      if (!sec.num && sec.num !== 0) errors.push(`${slug}: قسم بلا num`);
      if (!sec.title) errors.push(`${slug}: قسم ${sec.num} بلا عنوان`);
      if (!Array.isArray(sec.slides) || !sec.slides.length) {
        errors.push(`${slug}: قسم ${sec.num} بلا شرائح`);
        return;
      }
      sec.slides.forEach((sl) => {
        if (!sl.id) { errors.push(`${slug}: شريحة بلا id في قسم ${sec.num}`); return; }
        if (seenSlideIds.has(sl.id)) errors.push(`${slug}: تكرار في id الشريحة: ${sl.id}`);
        seenSlideIds.add(sl.id);
        if (!sl.title) errors.push(`${slug}: شريحة ${sl.id} بلا عنوان`);
        if (TYPES.has(sl.type) === false) errors.push(`${slug}: شريحة ${sl.id}: type غير معروف (${sl.type})`);
        if (LAYOUTS.has(sl.layout) === false) errors.push(`${slug}: شريحة ${sl.id}: layout غير معروف (${sl.layout})`);
        if (sl.scene && sl.scene.svg) {
          const rel = sl.scene.svg.replace(/^assets\//, '');
          const abs = path.join(deckDir, 'assets', rel);
          referencedSvg.add(`${slug}/assets/${rel}`);
          if (!fs.existsSync(abs)) errors.push(`${slug}: شريحة ${sl.id}: scene.svg غير موجود: ${sl.scene.svg}`);
        }
      });
    });
  });

  // أصول SVG على القرص
  slugs.forEach((slug) => {
    const assetsDir = path.join(SLIDES_DIR, slug, 'assets');
    listMd(assetsDir, '.svg').forEach((n) => producedSvg.add(`${slug}/assets/${n}`));
  });

  // صفر إشارات معلّقة: كل SVG منتج يجب أن يُستشهد به، وكل script.json له SVG منجز.
  producedSvg.forEach((key) => {
    if (!referencedSvg.has(key)) errors.push(`SVG غير مستشهَد به في index.json: ${key}`);
  });

  slugs.forEach((slug) => {
    const scenesDir = path.join(KB_SLIDES_DIR, slug, 'scenes');
    listMd(scenesDir, '.json').forEach((n) => {
      const id = n.replace(/\.script\.json$/, '');
      const key = `${slug}/assets/${id}.svg`;
      if (!producedSvg.has(key)) errors.push(`scene.script بلا SVG منجز: KNOWLEDGE_BASE/slides/${slug}/scenes/${n}`);
      if (!referencedSvg.has(key)) errors.push(`scene.script بلا استشهاد في index.json: ${slug}/scenes/${n}`);
    });
  });

  if (errors.length) {
    console.error('SMOKE FAILED');
    errors.forEach((e) => console.error('  - ' + e));
    process.exit(1);
  }

  let slideTotal = 0;
  slugs.forEach((slug) => {
    const data = readJson(path.join(SLIDES_DIR, slug, 'index.json'));
    data.sections.forEach((s) => { slideTotal += (s.slides || []).length; });
  });
  console.log('SMOKE OK: ' + slugs.length + ' decks، ' + slideTotal + ' شريحة، ' + producedSvg.size + ' مشهد SVG.');
}

main();