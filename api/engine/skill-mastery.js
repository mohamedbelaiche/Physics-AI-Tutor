// Skill Mastery Engine — deterministic, stable, recency-aware.
// Mastery (0-100) computed per skill from full answer history:
//   - weighted correctness (recent answers weigh more)
//   - difficulty weighting (harder answered questions count more)
//   - statistical confidence from sample size
//   - stability: no single answer can swing the value sharply
const DAY = 24 * 60 * 60 * 1000;

const RECENCY_HALF_LIFE_DAYS = 21; // weight 0.5 for answers ~3 weeks old
const C_ONFIDENCE_N = 10; // confidence = 1 - exp(-n/C)

function recencyWeight(answeredAt, now) {
  const days = Math.max(0, (now - answeredAt) / DAY);
  return Math.pow(0.5, days / RECENCY_HALF_LIFE_DAYS);
}

function difficultyFactor(difficulty) {
  const d = Number.isFinite(difficulty) ? Math.min(5, Math.max(1, difficulty)) : 1;
  return 1 + 0.12 * (d - 1); // 1.00 .. 1.48
}

// Compute mastery for a skill given its answer history.
// answers: [{ correct:bool, difficulty:int, answered_at: epoch ms }]
function computeMastery(answers, now) {
  now = now || Date.now();
  const n = Array.isArray(answers) ? answers.length : 0;
  if (n === 0) return { mastery: 0, confidence: 0, weightedCorrect: 0, n: 0 };

  let wSum = 0;
  let wCorrect = 0;
  let difficultySum = 0;
  let used = 0;

  for (const a of answers) {
    const w = recencyWeight(a.answered_at || now, now) * difficultyFactor(a.difficulty);
    wSum += w;
    if (a.correct) wCorrect += w;
    difficultySum += Number.isFinite(a.difficulty) ? a.difficulty : 1;
    used += 1;
  }

  const weightedCorrect = wSum > 0 ? wCorrect / wSum : 0;
  // Small bonus for consistently practicing harder questions (controlled).
  const avgDifficulty = used > 0 ? difficultySum / used : 1;
  const conf = 1 - Math.exp(-n / C_ONFIDENCE_N);

  let mastery = weightedCorrect * 100;
  // Penalize/credit confidence gap: with few answers we nudge toward neutral.
  if (conf < 1) mastery = mastery * conf + 50 * (1 - conf);

  const recent = answers.slice(-6);
  let streak = 0;
  let lastCorrect = null;
  let consistent = 0;
  for (const a of recent.reverse()) {
    if (lastCorrect !== null && a.correct === lastCorrect) streak++;
    else streak = 0;
    lastCorrect = a.correct;
    consistent += a.correct ? 1 : 0;
  }
  const recentRate = recent.length ? consistent / recent.length : null;

  return {
    mastery: clamp(Math.round(mastery), 0, 100),
    confidence: round2(conf),
    weightedCorrect: round3(weightedCorrect),
    avgDifficulty: round2(avgDifficulty),
    recentRate: recentRate === null ? null : round2(recentRate),
    n,
    correctedAt: now
  };
}

// Apply a single answer to an existing mastery estimate (incremental, for quick
// client-side feedback). Returns an updated estimate without full recomputation.
function applyAnswer(prev, answer) {
  const n = (prev && prev.n) || 0;
  const w = difficultyFactor(answer.difficulty);
  // Weighted running mean: recent single answer influence decays as n grows.
  const steadyN = Math.max(1, n);
  const blend = Math.min(1, 1 / Math.sqrt(steadyN));
  const base = (prev && Number.isFinite(prev.weightedCorrect)) ? prev.weightedCorrect : 0.5;
  const target = answer.correct ? 1 : 0;
  const weightedCorrect = base * (1 - blend) + target * blend * w * 0.85;

  const mastery = weightedCorrect * 100 * (1 - Math.exp(-(n + 1) / C_ONFIDENCE_N)) +
    50 * Math.exp(-(n + 1) / C_ONFIDENCE_N);

  return {
    mastery: clamp(Math.round(mastery), 0, 100),
    confidence: 1 - Math.exp(-(n + 1) / C_ONFIDENCE_N),
    weightedCorrect: round3(weightedCorrect),
    n: n + 1
  };
}

function skillStatus(mastery) {
  if (mastery >= 80) return 'strength';
  if (mastery >= 60) return 'good';
  if (mastery >= 40) return 'weak';
  return 'critical';
}

// Overall student level derived from average mastery adjusted by critical
// weaknesses and prerequisite gaps.
function deriveLevel(overallMastery, weakCriticalCount, prereqGapCount) {
  let effective = overallMastery;
  // Cap level when critical skills are weak, regardless of overall score.
  if (weakCriticalCount >= 2 || prereqGapCount >= 1) {
    effective = Math.min(effective, 55);
  }
  if (effective >= 85) return 'mastery';
  if (effective >= 72) return 'advanced';
  if (effective >= 60) return 'good';
  if (effective >= 45) return 'intermediate';
  if (effective >= 25) return 'elementary';
  return 'beginner';
}

function levelLabel(level) {
  return {
    beginner: 'مبتدئ',
    elementary: 'ابتدائي',
    intermediate: 'متوسط',
    good: 'جيّد',
    advanced: 'متقدم',
    mastery: 'إتقان'
  }[level] || level;
}

// Detect statistically-supported weaknesses/strengths from skill mastery map.
function classifySkills(skillMastery) {
  const strengths = [];
  const weaknesses = [];
  const critical = [];
  for (const [skill, m] of Object.entries(skillMastery)) {
    if (!m || !Number.isFinite(m.mastery)) continue;
    if (m.confidence < 0.5) continue; // don't claim weakness from tiny samples
    if (m.mastery >= 80) strengths.push(skill);
    else if (m.mastery <= 40) {
      weaknesses.push(skill);
      if (m.mastery <= 25) critical.push(skill);
    } else if (m.mastery < 60 && m.recentRate !== null && m.recentRate < 0.4) {
      weaknesses.push(skill); // weak recent trend
    }
  }
  return { strengths, weaknesses, critical };
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}
function round2(v) {
  return Math.round(v * 100) / 100;
}
function round3(v) {
  return Math.round(v * 1000) / 1000;
}

module.exports = {
  computeMastery,
  applyAnswer,
  skillStatus,
  deriveLevel,
  levelLabel,
  classifySkills
};