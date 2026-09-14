// test-engine.js — اختبار وحدات للمحرك النقي (بدون شبكة). يعمل بسكربت node في كل بيئة.
const assert = require('assert');
const data = require('../api/course/engine/data');
const seq = require('../api/course/engine/sequence');
const skills = require('../api/course/engine/skills');
const examGen = require('../api/course/engine/exam-gen');
const scoring = require('../api/course/engine/scoring');

const course = data.getCourse();
const bank = data.getQuestionBank();

// 1) بنية المحتوى
assert(course.units.length === 5, '5 وحدات');
for (const u of course.units) {
  assert(u.lessons.length >= 2, 'كل وحدة ≥ درسين');
  for (const l of u.lessons) {
    assert(l.elements.length >= 2, 'كل درس ≥ عنصرين');
    for (const e of l.elements) {
      assert(data.questionsForElement(e.id).length >= 1, 'كل عنصر له سؤال: ' + e.id);
    }
  }
}

// 2) صحة الأسئلة
const seen = new Set();
for (const q of bank.questions) {
  assert(!seen.has(q.id), 'لا تكرار: ' + q.id); seen.add(q.id);
  assert(q.options instanceof Array && q.options.length === 4, '4 خيارات: ' + q.id);
  assert(Number.isInteger(q.correct_index) && q.correct_index >= 0 && q.correct_index <= 3, 'correct_index صالح: ' + q.id);
  if (q.element_id !== 'assessment' && q.element_id !== 'unit_assessment') {
    assert(data.getElementById(q.element_id), 'العنصر موجود: ' + q.element_id);
  }
}

// 3) التتابع: بداية فقط element الأول مفتوح
let snap = seq.computeSnapshot(course, []);
assert(seq.isElementOpen(snap, course.units[0].lessons[0].elements[0].id) === true, 'أول عنصر مفتوح');
const e2 = course.units[0].lessons[0].elements[1];
assert(seq.isElementOpen(snap, e2.id) === false, 'ثاني عنصر مقفول');

// 4) إتمام العناصر يفتح إمتحان الدرس
const lesson1 = course.units[0].lessons[0];
const completedList = lesson1.elements.map((e) => ({ ref_type: 'element', ref_id: e.id, status: 'completed', best_score: null }));
snap = seq.computeSnapshot(course, completedList);
assert(seq.isExamAvailable(snap, 'lesson', lesson1.id) === true, 'إمتحان الدرس متاح بعد إتمام العناصر');
assert(seq.isElementOpen(snap, e2.id) === false, 'العناصر بعد إتمامها لا تعود مفتوحة');

// 5) تسلسل الدروس: نجاح إمتحان درس يفتح أول عنصر من الدرس التالي
const lesson2 = course.units[0].lessons[1];
const passList = completedList.concat([{ ref_type: 'lesson', ref_id: lesson1.id, status: 'passed', best_score: 80 }]);
snap = seq.computeSnapshot(course, passList);
assert(seq.isElementOpen(snap, lesson2.elements[0].id) === true, 'أول عنصر من الدرس التالي مفتوح بعد النجاح');

// 6) عتبات النجاح
assert(seq.examThreshold('lesson') === 60 && seq.examThreshold('unit') === 50);

// 7) تحديث المهارات
const u = skills.updateSkill(null, 100, 4);
assert(u.mastery === 60 && u.n === 4, 'أول محاولة: 0.6×100 = 60');
const u2 = skills.updateSkill(u, 50, 4);
assert(u2.mastery > 50 && u2.mastery < 60, 'المحاولة التالية تؤثر بوزن أصغر');
const cls = skills.classifySkills({ 'dom-x': { mastery: 80, n: 5 }, 'dom-y': { mastery: 30, n: 5 } });
assert(cls.strengths.includes('dom-x') && cls.weaknesses.includes('dom-y'));
assert(skills.levelLabel(95) === 'ممتاز');

// 8) توليد امتحان درس يغطي كل عنصر ولا يكشف الإجابة
const exam = examGen.generateExam(course, bank, 'lesson', lesson1.id, {});
const examIds = new Set(exam.map((q) => q.id));
for (const e of lesson1.elements) {
  assert(data.questionsForElement(e.id).some((q) => examIds.has(q.id)), 'تغطية عنصر: ' + e.id);
}
assert(exam.every((q) => q.correct_index === undefined && q.explanation === undefined), 'لا تسريب للإجابة');

// 9) التصحيح
const q0 = bank.questions.find((x) => x.id === exam[0].id);
const result = scoring.gradeAttempt(bank, exam, [{ question_id: q0.id, selected_index: q0.correct_index }], 'lesson');
assert(result.total === exam.length && result.correct_count === 1, 'تصحيح صحيح');
assert(result.skill_updates[q0.skill], 'تحديث مهارة');

console.log('test-engine: ALL PASS');

// معالجة المتغير غير المستخدم (fill بحاجة masteryMap) — الحفظ
void data; void seq;