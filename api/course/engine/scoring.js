// scoring.js — تصحيح محاولة امتحان وفق correct_index، حساب درجة كل مهارة وفحص النجاح.
const { examThreshold } = require('./sequence');

// questions: مصفوفة أسئلة الامتحان المُرسَل (بالميتاداتا فقط). answers: [{question_id, selected_index}]
function gradeAttempt(bank, questions, answers, type) {
  const byId = new Map(bank.questions.map((q) => [q.id, q]));
  const perSkill = {};
  let correctCount = 0;

  for (const item of questions) {
    const q = byId.get(item.id);
    if (!q) continue;
    const ans = (answers || []).find((a) => a.question_id === item.id);
    const correct = ans && ans.selected_index === q.correct_index;
    if (correct) correctCount++;
    if (!perSkill[q.skill]) perSkill[q.skill] = { correct: 0, total: 0 };
    perSkill[q.skill].total += 1;
    if (correct) perSkill[q.skill].correct += 1;
  }

  const total = questions.length || 1;
  const score = Math.round((correctCount / total) * 100);
  const threshold = type === 'final' ? 0 : examThreshold(type);
  const passed = type === 'final' ? true : score >= threshold;

  const skill_updates = {};
  Object.keys(perSkill).forEach((skill) => {
    const s = perSkill[skill];
    skill_updates[skill] = { attemptScore: Math.round((s.correct / s.total) * 100), n: s.total };
  });

  return {
    correct_count: correctCount, total: questions.length, score, passed, pass_score: threshold,
    per_skill: perSkill, skill_updates
  };
}

module.exports = { gradeAttempt };