// smoke-course.js — تحقق بنيوي من المحتوى (الجزء البنيوي فقط؛ التدفق الكامل عبر HTTP في Task 6).
// الاستخدام:
//   node scripts/smoke-course.js            # تحقق بنيوي فقط
const assert = require('assert');

// ===== 1) التحقق البنيوي =====
const course = require('../public/course/course.json');
const bank = require('../public/course/questions.json');
const skills = require('../public/course/skills.json');

let checked = 0;
for (const u of course.units) {
  for (const l of u.lessons) {
    assert(l.elements && l.elements.length >= 1, 'درس بلا عناصر: ' + l.id);
    for (const e of l.elements) {
      const qs = bank.questions.filter((q) => q.element_id === e.id);
      assert(qs.length >= 1, 'عنصر بلا أسئلة: ' + e.id);
    }
  }
}

const seenQ = new Set();
for (const q of bank.questions) {
  assert(!seenQ.has(q.id), 'تكرار سؤال: ' + q.id); seenQ.add(q.id);
  assert(q.options.length === 4, 'خيارات غير 4: ' + q.id);
  assert(Number.isInteger(q.correct_index) && q.correct_index >= 0 && q.correct_index <= 3, 'correct_index خاطئ: ' + q.id);
  checked++;
}
assert(skills.version === 1, 'skills.json version');
console.log('smoke: binary OK — ' + checked + ' questions checked');

// ===== 2) التحقق من عدم تسريب الإجابة (فحص الحقول) =====
const sample = bank.questions[0];
assert(!('correct_answer' in sample) && !('correct_option' in sample), 'صيغة إجابة غير متوقعة');
assert('correct_index' in sample, 'correct_index مفقود');

console.log('smoke: structure OK');
process.exit(0);