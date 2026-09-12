// Verifies scripts/question-bank-v2.js against the approved blueprint:
//   * KNOWLEDGE_BASE/diagnostic/skill_map.json  (16 skills, planned counts)
//   * approved difficulty distribution  L1..L5 = 6/18/16/8/2  (total 50)
// Run: node scripts/check-question-bank-v2.js

const fs = require('fs');
const path = require('path');
const bank = require('./question-bank-v2');

const SKILL_MAP_PATH = path.join(__dirname, '..', 'KNOWLEDGE_BASE', 'diagnostic', 'skill_map.json');
const skillMap = JSON.parse(fs.readFileSync(SKILL_MAP_PATH, 'utf8'));

const errors = [];
const warnings = [];

const skillsById = new Map(skillMap.skills.map((s) => [s.skill_id, s]));
const validSkills = [...skillsById.keys()];
const validUnits = ['unit1', 'unit2', 'unit3', 'unit4', 'unit5'];
const BLUEPRINT_DIFFICULTY = { 1: 6, 2: 18, 3: 16, 4: 8, 5: 2 };

const { test, questions } = bank;

// ------------------------------------------------------------
// 1. Test metadata + declared total
// ------------------------------------------------------------
if (!test.id || !test.title || !test.description) {
  errors.push('معلومات الاختبار ناقصة (id/title/description)');
}
if (!test.subject || !test.grade || !test.version) {
  errors.push('معلومات الاختبار ناقصة (subject/grade/version)');
}
if (!Array.isArray(questions)) {
  errors.push('questions ليست مصفوفة');
} else if (questions.length !== test.total_questions) {
  errors.push(`عدد الأسئلة (${questions.length}) يخالف المعلن (${test.total_questions})`);
}
if (!test.time_limit_minutes || !test.difficulty_scale) {
  errors.push('زمن أو سلم صعوبات ناقص');
}

const countBySkill = {};
const countByDifficulty = {};
const countByCategory = {};
const skillDifficulties = {};

if (Array.isArray(questions)) {
  // ------------------------------------------------------------
  // 2. IDs unique & sequential
  // ------------------------------------------------------------
  const ids = new Set();
  questions.forEach((q, i) => {
    const expectedId = `PHYV2-${String(i + 1).padStart(3, '0')}`;
    if (q.id !== expectedId) {
      errors.push(`[${i + 1}] id «${q.id}» غير تسلسلي (المتوقع ${expectedId})`);
    }
    if (ids.has(q.id)) errors.push(`تكرار id: ${q.id}`);
    ids.add(q.id);
  });

  // ------------------------------------------------------------
  // Aggregators
  // ------------------------------------------------------------
  for (const q of questions) {
    // 3. skill valid + category matches skill_map
    if (!validSkills.includes(q.skill)) {
      errors.push(`[${q.id}] مهارة غير معروفة: ${q.skill}`);
    } else {
      const expectedCat = skillsById.get(q.skill).category;
      if (q.category !== expectedCat) {
        errors.push(`[${q.id}] فئة ${q.category} تخالف خريطة المهارات (${expectedCat})`);
      }
    }
    countBySkill[q.skill] = (countBySkill[q.skill] || 0) + 1;

    // 6. difficulty validity + per-skill allowed range
    if (![1, 2, 3, 4, 5].includes(q.difficulty)) {
      errors.push(`[${q.id}] صعوبة غير صالحة: ${q.difficulty}`);
    } else {
      countByDifficulty[q.difficulty] = (countByDifficulty[q.difficulty] || 0) + 1;
      skillDifficulties[q.skill] = (skillDifficulties[q.skill] || []).concat(q.difficulty);
      const allowed = skillsById.get(q.skill)?.difficulty_levels || [];
      if (allowed.length && !allowed.includes(q.difficulty)) {
        errors.push(`[${q.id}] صعوبة ${q.difficulty} خارج مدى المهارة ${q.skill} ${JSON.stringify(allowed)}`);
      }
    }

    countByCategory[q.category] = (countByCategory[q.category] || 0) + 1;

    // 8/9. options structure + only-correct has diagnostic_error null
    if (!Array.isArray(q.options) || q.options.length !== 4) {
      errors.push(`[${q.id}] يجب أن تكون الخيارات 4 بالضبط`);
    } else {
      const optionIds = q.options.map((o) => o.id);
      const expectedIds = ['A', 'B', 'C', 'D'];
      if (JSON.stringify([...optionIds].sort()) !== JSON.stringify([...expectedIds].sort())) {
        errors.push(`[${q.id}] معرّفات الخيارات ليست A,B,C,D: ${optionIds.join(',')}`);
      }
      if (!q.correct || !optionIds.includes(q.correct)) {
        errors.push(`[${q.id}] الإجابة الصحيحة «${q.correct}» غير موجودة في الخيارات`);
      }
      const nullErrorOptions = q.options.filter((o) => o.diagnostic_error === null);
      if (nullErrorOptions.length !== 1) {
        errors.push(`[${q.id}] يجب أن يكون خيار واحد فقط بـ diagnostic_error === null (وجد ${nullErrorOptions.length}): ${nullErrorOptions.map((o) => o.id).join(',')}`);
      }
      if (q.correct && q.options.find((o) => o.id === q.correct)?.diagnostic_error !== null) {
        errors.push(`[${q.id}] الخيار الصحيح ${q.correct} يجب أن يحمل diagnostic_error === null`);
      }
      for (const o of q.options) {
        if (!o.id || !o.text) errors.push(`[${q.id}] خيار ناقص (id أو نص)`);
        if (o.id !== q.correct && (typeof o.diagnostic_error !== 'string' || !o.diagnostic_error.trim())) {
          errors.push(`[${q.id}] الخيار الخاطئ ${o.id} بدون diagnostic_error`);
        }
      }
    }

    // 10. required fields
    if (!q.question || !q.question.trim()) errors.push(`[${q.id}] نص السؤال فارغ`);
    if (!q.explanation || !q.explanation.trim()) errors.push(`[${q.id}] بدون تفسير`);
    if (!q.estimated_time) errors.push(`[${q.id}] بدون estimated_time`);
    if (!q.weight) errors.push(`[${q.id}] بدون weight`);
    if (!q.secondary_skill !== null && q.secondary_skill && !validSkills.includes(q.secondary_skill)) {
      errors.push(`[${q.id}] secondary_skill غير صالح: ${q.secondary_skill}`);
    }
    if (!Array.isArray(q.diagnostic_tags) || q.diagnostic_tags.length === 0) {
      errors.push(`[${q.id}] diagnostic_tags فارغة`);
    }

    // 11. prerequisite_lessons subset of skill_map.prerequisite_for
    if (!Array.isArray(q.prerequisite_lessons) || q.prerequisite_lessons.length === 0) {
      errors.push(`[${q.id}] prerequisite_lessons فارغة`);
    } else {
      for (const u of q.prerequisite_lessons) {
        if (!validUnits.includes(u)) {
          errors.push(`[${q.id}] وحدة غير صالحة: ${u}`);
        }
      }
      const allowedFor = new Set(skillsById.get(q.skill)?.prerequisite_for || []);
      for (const u of q.prerequisite_lessons) {
        if (allowedFor.size && !allowedFor.has(u)) {
          warnings.push(`[${q.id}] وحدة ${u} غير مذكورة في prerequisite_for للمهارة ${q.skill}`);
        }
      }
    }
  }

  // 4. per-skill planned counts
  for (const s of validSkills) {
    const planned = skillsById.get(s).planned_questions;
    const got = countBySkill[s] || 0;
    if (got !== planned) {
      errors.push(`المهارة ${s}: لدينا ${got} والمخطط ${planned}`);
    }
  }

  // 5. every skill >= 2 questions
  for (const s of validSkills) {
    if ((countBySkill[s] || 0) < 2) {
      errors.push(`المهارة ${s} بأقل من سؤالين`);
    }
  }

  // 6. aggregate difficulty distribution
  for (const d of [1, 2, 3, 4, 5]) {
    const got = countByDifficulty[d] || 0;
    const planned = BLUEPRINT_DIFFICULTY[d];
    if (got !== planned) {
      errors.push(`المستوى L${d}: لدينا ${got} والمخطط ${planned}`);
    }
  }

  // 7. category counts
  const plannedCat = { A: 26, B: 14, C: 10 };
  for (const c of ['A', 'B', 'C']) {
    if ((countByCategory[c] || 0) !== plannedCat[c]) {
      errors.push(`الفئة ${c}: لدينا ${countByCategory[c] || 0} والمخطط ${plannedCat[c]}`);
    }
  }
}

// ------------------------------------------------------------
// Report
// ------------------------------------------------------------
console.log(`✅ الاختبار: ${test.id} (${questions.length} سؤالاً)`);
console.log('');
console.log('توزيع الأسئلة حسب المهارة:');
for (const s of validSkills) {
  const cat = skillsById.get(s).category;
  const got = countBySkill[s] || 0;
  const planned = skillsById.get(s).planned_questions;
  const diffs = [...new Set(skillDifficulties[s] || [])].sort();
  const ok = got === planned;
  console.log(`  ${ok ? '✅' : '❌'} ${s} [${cat}] = ${got}/${planned} (صعوبات: ${diffs.join(',')})`);
}
console.log('');
console.log('توزيع الصعوبة L1..L5:');
for (const d of [1, 2, 3, 4, 5]) {
  const ok = (countByDifficulty[d] || 0) === BLUEPRINT_DIFFICULTY[d];
  console.log(`  ${ok ? '✅' : '❌'} L${d} = ${countByDifficulty[d] || 0} (المخطط ${BLUEPRINT_DIFFICULTY[d]})`);
}
console.log('');
console.log('توزيع الفئات A/B/C:');
for (const c of ['A', 'B', 'C']) {
  const ok = (countByCategory[c] || 0) === { A: 26, B: 14, C: 10 }[c];
  console.log(`  ${ok ? '✅' : '❌'} ${c} = ${countByCategory[c] || 0}`);
}
console.log('');

if (warnings.length) {
  console.log('تحذيرات (غير حاسمة):');
  warnings.forEach((w) => console.log('  ⚠️', w));
  console.log('');
}
if (errors.length) {
  console.log(`❌ ${errors.length} مشكلة يجب معالجتها:`);
  errors.forEach((e) => console.log('  -', e));
  process.exit(1);
}
console.log('🎉 البنك مستوفٍ لكل فحوصات الجودة وفق المخطط المعتمد.');