// Adaptive Learning Engine — determines the next learning action.
// Reads student state, applies rule engine (deterministic), calls AI only
// for edge cases (low confidence, conflicting signals).

const { classifySkills, deriveLevel, skillStatus } = require('./skill-mastery');

// Next-action constants (per spec §19).
const ACTIONS = [
  'continue',        // advance to next section (student is ready)
  'review',          // short review of weak concept
  'simplify',        // simpler explanation + easy quiz
  'extra_example',   // additional example before moving on
  'easy_quiz',       // easy questions to build confidence
  'medium_quiz',     // medium questions to test
  'hard_quiz',       // hard questions to challenge
  'prerequisite',    // go back to missing prerequisite
  'repeat_lesson',   // repeat lesson with different approach
  'advance'          // skip ahead (very strong student)
];

const LEVEL_ORDER = [
  'beginner', 'elementary', 'intermediate', 'good', 'advanced', 'mastery'
];

function levelAtLeast(l, target) {
  return LEVEL_ORDER.indexOf(l) >= LEVEL_ORDER.indexOf(target);
}

// Determine what to do after a quiz/assessment is completed.
// input:
//   { type, skillResults, masteryBefore, masteryAfter, prerequisites, completedLessons }
// Returns: { action, reason, details, skillFocus? }
function determineNextAction(input) {
  const {
    type,          // 'micro' | 'lesson' | 'unit'
    skillResults,  // { skillId: { correct, difficulty, n } }
    masteryAfter,  // { skillId: { mastery, confidence, ... } }
    prerequisites, // { [skillId]: [prereqSkillId, ...] }
    completedLessons, // ['u1l1', ...]
    currentLessonId,
    currentUnitId,
    courseData      // the full course.json
  } = input;

  // Overall stats
  const overallMastery = averageMastery(masteryAfter);
  const { strengths, weaknesses, critical } = classifySkills(masteryAfter);

  // Check if any critical prerequisite is below threshold.
  const prereqGap = [];
  for (const [skill, prereqs] of Object.entries(prerequisites || {})) {
    if (!masteryAfter[skill]) continue;
    const current = masteryAfter[skill];
    if (current.mastery >= 60 && current.confidence >= 0.4) {
      for (const p of prereqs) {
        const pMastery = masteryAfter[p];
        if (!pMastery || pMastery.mastery < 35) {
          prereqGap.push({ skill, prereq: p, prereqMastery: pMastery ? pMastery.mastery : 0 });
        }
      }
    }
  }

  // Low mastery on primary assessed skills
  const criticalSkills = critical.length;

  // Score distribution
  const allCorrect = Object.values(skillResults || {}).every((r) => r.correct);
  const allWrong = Object.values(skillResults || {}).every((r) => !r.correct);
  const overallCorrectRate = correctRate(skillResults);

  // ===== Decision tree =====

  // Case 1: Very strong → advance fast (spec §14 case 1)
  if (overallMastery > 85 && criticalSkills === 0 && prereqGap.length === 0) {
    return buildResult('advance', 'مستوى ممتاز - يمكن التقدم مباشرة', {
      overallMastery, strengths, weaknesses
    });
  }

  // Case 2: Weak → need review (spec §14 case 3)
  if (overallMastery < 40 || criticalSkills >= 2) {
    // Check if a prerequisite is the root cause.
    if (prereqGap.length) {
      return buildResult('prerequisite', 'يلزم مراجعة مكتسبات سبقتها', {
        prerequisiteGap: prereqGap,
        currentLevel: deriveLevel(overallMastery, criticalSkills, prereqGap.length)
      });
    }
    return buildResult('repeat_lesson', 'مستوى ضعيف - يلزم إعادة دراسة بمricula مختلفة', {
      overallMastery, criticalSkills, weaknesses
    });
  }

  // Case 3: Good overall but one weakness → targeted review (spec §14 case 3)
  if (overallMastery >= 60 && weaknesses.length === 1) {
    return buildResult('extra_example', 'مراجعة مركّزة في مهارة واحدة', {
      skillFocus: weaknesses[0],
      overallMastery
    });
  }

  // Case 4: Medium → continue with optional extra examples (spec §14 case 2)
  if (overallMastery >= 45 && overallMastery <= 60) {
    if (overallCorrectRate >= 0.7) {
      return buildResult('extra_example', 'أداؤه جيد لكنه يحتاج ثقة أكبر', {
        overallMastery
      });
    }
    return buildResult('review', 'مستوى متوسط - مراجعة مختصرة قبل الانتقال', {
      overallMastery
    });
  }

  // Case 5: Generally good, few errors
  if (overallMastery > 60 && overallCorrectRate >= 0.8) {
    return buildResult('continue', 'جاهز للانتقال إلى القسم التالي', {
      overallMastery, strengths
    });
  }

  // Default fallback
  if (overallCorrectRate >= 0.6) {
    return buildResult('continue', 'مستوى مقبول، يُنصح بمتابعة', { overallMastery });
  }

  // Unsure (AI should be consulted for this path)
  return buildResult('medium_quiz', 'مستوى م不确定 — يلزم تقييم أكثر', {
    overallMastery,
    recommendation: 'يُنصح بسؤال المدرّس الذكي للتوضيح'
  });
}

function buildResult(action, reason, details) {
  return {
    action: action || 'continue',
    reason: reason || '',
    details: details || {},
    skillFocus: (details && details.skillFocus) || null
  };
}

function averageMastery(masteryMap) {
  const entries = Object.values(masteryMap || {});
  if (!entries.length) return 0;
  let sum = 0;
  for (const e of entries) {
    const v = Number.isFinite(e.mastery) ? e.mastery : 50;
    sum += v;
  }
  return Math.round(sum / entries.length);
}

function correctRate(skillResults) {
  const entries = Object.values(skillResults || {});
  if (!entries.length) return 0;
  let correct = 0;
  let total = 0;
  for (const r of entries) {
    if (Number.isFinite(r.correct) && Number.isFinite(r.n)) {
      correct += r.correct ? r.n : 0;
      total += r.n;
    }
  }
  return total > 0 ? correct / total : 0;
}

// For lesson completion: aggregate per-skill results from assessment answers.
function aggregateSkillResults(answers) {
  // answers: [{ skill_id, correct, difficulty }]
  const map = {};
  for (const a of answers) {
    const s = a.skill_id || 'unknown';
    if (!map[s]) map[s] = { correct: 0, n: 0, difficultySum: 0 };
    map[s].n++;
    if (a.correct) map[s].correct++;
    map[s].difficultySum += Number.isFinite(a.difficulty) ? a.difficulty : 1;
  }
  return map;
}

module.exports = {
  ACTIONS,
  determineNextAction,
  aggregateSkillResults,
  averageMastery
};