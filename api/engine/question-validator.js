// Question Validator — rejects malformed, ambiguous, or out-of-curriculum
// questions before they reach a student.

function isPositiveNumber(v) {
  return Number.isFinite(v) && v > 0;
}

// Validate a candidate question object against the curriculum and quiz rules.
// Returns { ok: boolean, errors: string[] }
function validateQuestion(q, questionBank, curriculum) {
  const errors = [];

  if (!q || typeof q !== 'object') return { ok: false, errors: ['السؤال غير صالح'] };

  // Required fields
  for (const field of ['id', 'unit_id', 'lesson_id', 'skill_id', 'question']) {
    if (!q[field] || typeof q[field] !== 'string' || !q[field].trim()) {
      errors.push('الحقل المطلوب مفقود: ' + field);
    }
  }

  // Choices: at least 2, one and only one correct
  const choices = Array.isArray(q.choices) ? q.choices : [];
  if (choices.length < 2) errors.push('يجب وجود خيارين على الأقل');
  if (!Number.isInteger(q.correct_index) || q.correct_index < 0 || q.correct_index >= choices.length) {
    errors.push('correct_index خارج النطاق');
  }

  // Ambiguity check: any two identical/distractor choices that could both be valid
  const seen = new Set();
  let emptyCount = 0;
  for (const c of choices) {
    const s = String(c || '').trim();
    if (!s) emptyCount++;
    if (seen.has(s)) errors.push('خياران متطابقان في نفس السؤال');
    seen.add(s);
  }
  if (emptyCount) errors.push('يوجد خيار فارغ');

  // Difficulty range
  if (!Number.isInteger(q.difficulty) || q.difficulty < 1 || q.difficulty > 5) {
    errors.push('difficulty يجب أن يكون بين 1 و 5');
  }

  // Skill must exist in the skill taxonomy
  const skillId = q.skill_id;
  const skills = (curriculum && curriculum.skills) || [];
  if (skillId && skills.length && !skills.some((s) => s.id === skillId)) {
    errors.push('مهارة غير معروفة: ' + skillId);
  }

  // Unit/lesson must exist in the course structure
  const units = (curriculum && curriculum.units) || [];
  if (units.length) {
    const unit = units.find((u) => u.id === q.unit_id);
    if (!unit) {
      errors.push('وحدة غير موجودة: ' + q.unit_id);
    } else if (q.lesson_id && q.lesson_id !== 'unit_assessment') {
      const lesson = unit.lessons.find((l) => l.id === q.lesson_id);
      if (!lesson) errors.push('درس غير موجود في الوحدة: ' + q.lesson_id);
    }
  }

  // Explanation presence (educational requirement)
  if (!q.explanation || !String(q.explanation).trim()) {
    errors.push('يجب وجود تفسير (explanation) لكل سؤال');
  }

  // Duplicate id in bank
  if (questionBank && questionBank.some((bq) => bq.id === q.id)) {
    errors.push('معرّف السؤال مكرر في البنك: ' + q.id);
  }

  return { ok: errors.length === 0, errors };
}

// Batch-validate a full question bank.
function validateBank(questions, curriculum) {
  const seenIds = new Set();
  const errors = [];
  const valid = [];
  for (const q of questions) {
    if (seenIds.has(q.id)) errors.push('معرّف مكرر: ' + q.id);
    seenIds.add(q.id);
    const res = validateQuestion(q, questions, curriculum);
    if (res.ok) valid.push(q);
    else errors.push(q.id + ' → ' + res.errors.join(' ; '));
  }
  return { valid, errors, total: questions.length, passed: valid.length };
}

module.exports = { validateQuestion, validateBank };