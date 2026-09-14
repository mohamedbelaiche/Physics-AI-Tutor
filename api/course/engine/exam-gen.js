// exam-gen.js — توليد امتحانات QCM مع ضمان تغطية الأصناف وتدرّج الصعوبة حسب الإتقان.
// أحجام المواصفة (قسم 7): درس 5-8، وحدة 10-15، نهائي 20-30.
// المهارة الضعيفة (<70) تأخذ الأسئلة الأسهل أولاً (1→5)؛ المتقنة (>=70) تأخذ الأصعب (5→1).

const data = require('./data');

function shuffled(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = a[i]; a[i] = a[j]; a[j] = tmp;
  }
  return a;
}

function pickOne(arr) {
  return arr[Math.floor(Math.random() * arr.length)] || null;
}

function priorityScore(q, masteryMap) {
  const m = (masteryMap[q.skill] && masteryMap[q.skill].mastery) || 0;
  // الضعيف: الأسهل أولاً (صعوبة صغيرة = أولوية أعلى)؛ المتقن: الأصعب أولاً.
  return m >= 70 ? (6 - q.difficulty) : q.difficulty;
}

function fill(pool, usedIds, target) {
  const result = [];
  const remaining = pool.filter((q) => !usedIds.has(q.id)).sort((a, b) => priorityScore(a, {}) - priorityScore(b, {}));
  for (const q of remaining) {
    if (result.length >= target) break;
    if (usedIds.has(q.id)) continue;
    usedIds.add(q.id);
    result.push(q);
  }
  return result;
}

// type: lesson|unit|final — refId: lesson id / unit id / 'final'
function generateExam(course, bank, type, refId, masteryMap) {
  masteryMap = masteryMap || {};
  const used = new Set();
  const picked = [];

  if (type === 'lesson') {
    const elements = data.getElementsByLesson(refId);
    for (const e of elements) {
      const pool = data.questionsForElement(e.id).slice().sort((a, b) => priorityScore(a, masteryMap) - priorityScore(b, masteryMap));
      const q = pickOne(pool);
      if (q && !used.has(q.id)) { used.add(q.id); picked.push(q); }
    }
    while (picked.length < 8) {
      const extra = fill(data.questionsForLesson(refId), used, 8 - picked.length);
      picked.push(...extra);
      break;
    }
  } else if (type === 'unit') {
    const lessons = data.getLessonsByUnit(refId);
    for (const l of lessons) {
      const pool = data.questionsForLesson(l.id);
      if (pool.length) {
        const sorted = pool.slice().sort((a, b) => priorityScore(a, masteryMap) - priorityScore(b, masteryMap));
        pickUnused(sorted, used, picked);
      }
    }
    while (picked.length < 15) {
      const extra = fill(data.questionsForUnit(refId), used, 15 - picked.length);
      picked.push(...extra);
      break;
    }
  } else { // final
    for (const u of course.units) {
      const pool = data.questionsForUnit(u.id);
      if (pool.length) {
        const sorted = pool.slice().sort((a, b) => priorityScore(a, masteryMap) - priorityScore(b, masteryMap));
        pickUnused(sorted, used, picked);
      }
    }
    while (picked.length < 30) {
      const all = data.allQuestions();
      picked.push(...fill(all, used, 30 - picked.length));
      break;
    }
  }

  const maxSize = type === 'lesson' ? 8 : type === 'unit' ? 15 : 30;
  if (picked.length > maxSize) picked.length = maxSize;

  // لا تُرسل الإجابة الصحيحة ولا الشرح.
  return picked.map((q) => ({
    id: q.id, unit_id: q.unit_id, lesson_id: q.lesson_id, element_id: q.element_id,
    skill: q.skill, difficulty: q.difficulty, question: q.question, options: q.options
  }));
}

function pickUnused(sortedPool, used, picked) {
  for (const q of sortedPool) {
    if (!used.has(q.id)) { used.add(q.id); picked.push(q); break; }
  }
}

module.exports = { generateExam };