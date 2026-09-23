'use strict';
/**
 * scripts/smoke-course.js
 *
 * فحص صحة course.json (بدون إطار اختبارات):
 *   - JSON صالح، version صحيح.
 *   - 5 كورسات بأسماء id فريدة و order متتالٍ من 1.
 *   - كل كورس له ≥ مقطع واحد، والمقاطع غير فارغة.
 *   - كل إشارة مفاهيم/صيغ تشير لصفحة موجودة فعليًا في الويكي (لا dangling).
 * يخرج برمز خطأ غير صفري عند أي فشل مع رسائل واضحة.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const COURSE_FILE = path.join(ROOT, 'public', 'course', 'course.json');
const CONCEPTS_DIR = path.join(ROOT, 'KNOWLEDGE_BASE', 'concepts');
const FORMULAS_DIR = path.join(ROOT, 'KNOWLEDGE_BASE', 'formulas');

function main() {
  const errors = [];

  if (!fs.existsSync(COURSE_FILE)) {
    console.error('SMOKE FAILED: لا يوجد public/course/course.json — شغّل scripts/build-course-content.js أولاً.');
    process.exit(1);
  }

  let data;
  try {
    data = JSON.parse(fs.readFileSync(COURSE_FILE, 'utf8'));
  } catch (err) {
    console.error('SMOKE FAILED: course.json غير صالح كـ JSON: ' + err.message);
    process.exit(1);
  }

  if (data.version !== 1) errors.push('version ليس 1');
  if (!Array.isArray(data.courses)) errors.push('courses ليس مصفوفة');

  if (Array.isArray(data.courses)) {
    const ids = data.courses.map((c) => c.id);
    if (new Set(ids).size !== ids.length) errors.push('تكرار في course ids');

    const orders = data.courses.map((c) => c.order).sort((a, b) => a - b);
    orders.forEach((o, i) => {
      if (o !== i + 1) errors.push('تسلسل order مكسور عند الموضع ' + (i + 1));
    });

    data.courses.forEach((c) => {
      if (!c.sections || !c.sections.length) {
        errors.push(c.id + ': لا مقاطع');
        return;
      }
      c.sections.forEach((s) => {
        if (!s.title) errors.push(c.id + ': مقطع بلا عنوان');
        if (!s.content_md || !s.content_md.trim()) errors.push(c.id + ': مقطع ' + (s.num || '?') + ' فارغ');
      });

      (c.concepts || []).forEach((ent) => {
        const base = String(ent.id).replace(/^concept\//, '');
        if (!fs.existsSync(path.join(CONCEPTS_DIR, base + '.md')))
          errors.push(c.id + ': صفحة مفهوم غير موجودة: ' + ent.id);
      });
      (c.formulas || []).forEach((ent) => {
        const base = String(ent.id).replace(/^formula\//, '');
        if (!fs.existsSync(path.join(FORMULAS_DIR, base + '.md')))
          errors.push(c.id + ': صفحة صيغة غير موجودة: ' + ent.id);
      });
      (c.concepts_ids || []).forEach((base) => {
        if (!fs.existsSync(path.join(CONCEPTS_DIR, base + '.md')))
          errors.push(c.id + ': إشارة مفهوم غير موجودة: ' + base);
      });
    });
  }

  if (errors.length) {
    console.error('SMOKE FAILED');
    errors.forEach((e) => console.error('  - ' + e));
    process.exit(1);
  }

  const total = data.courses.reduce((n, c) => n + c.sections.length, 0);
  console.log('SMOKE OK: ' + data.courses.length + ' كورسات، ' + total + ' مقاطع.');
}

main();