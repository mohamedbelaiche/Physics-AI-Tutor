// skills.js — تحديث إتقان المهارات وتصنيف القوة/الضعف والمستوى العام.
// معادلة المواصفة (قسم 8): mastery_جديد = coefficient×درجة_المحاولة + (1−coef)×mastery_سابق،
// مع تضاؤل أثر المحاولة كلما ازدادت العيّنات.

const STRENGTH_AT = 70;
const WEAKNESS_BELOW = 50;

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

// prev: {mastery, n} | null — attemptSkillScore: 0..100 — nAttempt: عدد أسئلة المهارة في هذه المحاولة
function updateSkill(prev, attemptSkillScore, nAttempt) {
  const prevN = (prev && prev.n) || 0;
  const prevMastery = (prev && Number.isFinite(prev.mastery)) ? prev.mastery : 0;
  const b = clamp(0.6 / Math.sqrt(prevN + 1), 0.2, 0.6);
  const mastery = Math.round(b * attemptSkillScore + (1 - b) * prevMastery);
  return { mastery, n: prevN + nAttempt };
}

function classifySkills(skillMap) {
  const strengths = [];
  const weaknesses = [];
  for (const skill of Object.keys(skillMap)) {
    const p = skillMap[skill];
    if (!p || p.n === 0 || !Number.isFinite(p.mastery)) continue;
    if (p.mastery >= STRENGTH_AT) strengths.push(skill);
    else if (p.mastery < WEAKNESS_BELOW) weaknesses.push(skill);
  }
  return { strengths, weaknesses };
}

function overallMastery(skillMap) {
  const vals = Object.keys(skillMap)
    .map((s) => skillMap[s])
    .filter((p) => p && p.n > 0 && Number.isFinite(p.mastery));
  if (!vals.length) return 0;
  return Math.round(vals.reduce((sum, p) => sum + p.mastery, 0) / vals.length);
}

function levelLabel(mastery) {
  if (mastery >= 85) return 'ممتاز';
  if (mastery >= 70) return 'متقدم';
  if (mastery >= 50) return 'جيّد';
  if (mastery >= 30) return 'متوسط';
  return 'مبتدئ';
}

module.exports = { updateSkill, classifySkills, overallMastery, levelLabel, STRENGTH_AT, WEAKNESS_BELOW };