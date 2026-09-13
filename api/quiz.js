// POST /api/quiz
// Body: {
//   type: 'micro'|'lesson'|'unit',
//   unit_id?, lesson_id?, section_id?,
//   answers: [
//     { question_id, selected_index, time_spent_seconds?, answered_at? }
//   ]
// }
// Recomputes correctness server-side from the bank, records attempt + answers,
// updates skill mastery, writes learning events, computes the next action.
const { createClient } = require('@supabase/supabase-js');
const { readJsonBody } = require('./read-json-body');
const { requireUser, getSupabaseConfig } = require('./supabase-server');
const courseData = require('./engine/course-data');
const { computeMastery, deriveLevel, levelLabel, classifySkills, skillStatus } = require('./engine/skill-mastery');
const { classifyError } = require('./engine/mistake-analyzer');
const { determineNextAction, aggregateSkillResults } = require('./engine/adaptive-path');

const QUESTIONS_BY_ID = typeof courseData.buildQuestionIndex === 'function'
  ? courseData.buildQuestionIndex()
  : {};
const PREREQ_MAP = typeof courseData.getPrerequisiteMap === 'function'
  ? courseData.getPrerequisiteMap()
  : {};
const COURSE_DATA = courseData.getCourse ? courseData.getCourse() : null;

const MAX_ANSWERS = 50;
const SUBJECT = 'physics';

async function handler(req, res) {
  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }
  const auth = await requireUser(req, res);
  if (!auth) return;

  readJsonBody(req, async function (data) {
    try {
      const result = await handleQuiz(data, res, auth);
      if (result !== null) {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(result));
      }
    } catch (err) {
      console.error('Quiz error:', err);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: 'خطأ داخلي في الخادم.' }));
      }
    }
  });
}

function makeDb(auth) {
  const { url, anonKey } = getSupabaseConfig();
  const supabase = createClient(url, anonKey, {
    global: {
      headers: { apikey: anonKey, Authorization: 'Bearer ' + auth.token }
    },
    auth: { persistSession: false }
  });
  return supabase;
}

async function handleQuiz(data, res, auth) {
  if (data.__invalid) {
    res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'طلب غير صالح: ' + data.message }));
    return null;
  }

  const type = String(data.type || '');
  if (!['micro', 'lesson', 'unit'].includes(type)) {
    res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'نوع التقييم غير صالح. استعمل micro أو lesson أو unit.' }));
    return null;
  }

  const answers = Array.isArray(data.answers) ? data.answers : [];
  if (!answers.length) {
    res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'لا توجد إجابات.' }));
    return null;
  }
  if (answers.length > MAX_ANSWERS) {
    res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'عدد الإجابات كبير جداً.' }));
    return null;
  }

  const unitId = data.unit_id || '';
  const lessonId = data.lesson_id || '';
  const sectionId = data.section_id || '';
  const assessmentId =
    data.assessment_id ||
    [type, unitId, lessonId || sectionId].filter(Boolean).join(':') ||
    type;

  const now = new Date().toISOString();
  let correct = 0;
  let total = 0;
  const graded = [];
  const skillsTouched = {};

  for (const a of answers) {
    const q = QUESTIONS_BY_ID[a.question_id];
    const isCorrect = !!(q && Number.isInteger(a.selected_index) && a.selected_index === q.correct_index);
    const skillId = (q && q.skill_id) || a.skill_id || 'unknown';
    const difficulty = (q && q.difficulty) || Number(a.difficulty) || 1;
    if (isCorrect) correct++;
    total++;

    const cls = isCorrect ? null : classifyError(q, a.selected_index, q.correct_index);
    const errorType = cls && cls.error_type ? cls.error_type : null;

    graded.push({
      question_id: String(a.question_id),
      section_id: sectionId || (q && q.section_id) || null,
      skill_id: skillId,
      difficulty: Math.min(5, Math.max(1, difficulty)),
      selected_index: Number.isInteger(a.selected_index) ? a.selected_index : null,
      correct: isCorrect,
      response_time_ms: Number.isInteger(a.response_time_ms) ? a.response_time_ms : null,
      error_type: errorType,
      misconception: (q && q.common_misconception) || null,
      answered_at: isFinite(Date.parse(a.answered_at)) ? a.answered_at : now
    });

    if (!skillsTouched[skillId]) skillsTouched[skillId] = { n: 0, correctN: 0, errorTypes: {} };
    skillsTouched[skillId].n++;
    if (isCorrect) skillsTouched[skillId].correctN++;
    if (cls && cls.error_type) {
      skillsTouched[skillId].errorTypes[cls.error_type] =
        (skillsTouched[skillId].errorTypes[cls.error_type] || 0) + 1;
    }
  }

  const scorePct = Math.round((correct / total) * 100);
  const db = makeDb(auth);

  // ================= persist attempt =================
  const start = performanceStart(data);
  const attemptPayload = {
    student_id: auth.userId,
    assessment_type: type,
    assessment_id: assessmentId,
    status: 'completed',
    started_at: start,
    completed_at: now,
    duration_seconds: data.duration_seconds || null,
    total_questions: total,
    correct_count: correct,
    score: scorePct,
    skill_results: aggregateSkillResults(graded),
    recommendations: []
  };
  const attemptInsert = await db
    .from('assessment_attempts')
    .insert(attemptPayload)
    .select()
    .single();
  if (attemptInsert.error) throw new Error('failed to save attempt: ' + attemptInsert.error.message);
  const attempt = attemptInsert.data;

  // ================= persist answers =================
  const answerRows = graded.map((g) => ({
    attempt_id: attempt.id,
    question_id: g.question_id,
    section_id: g.section_id,
    skill_id: g.skill_id,
    difficulty: g.difficulty,
    selected_index: g.selected_index,
    correct: g.correct,
    response_time_ms: g.response_time_ms,
    error_type: g.error_type,
    misconception_key: g.misconception
  }));
  const ansInsert = await db.from('assessment_answers').insert(answerRows);
  if (ansInsert.error) console.warn('failed to save answers:', ansInsert.error.message);

  // ================= fetch existing skill profiles =================
  const pf = await db
    .from('student_skill_profiles')
    .select('skill,score,confidence,questions_answered,correct_answers,status,level')
    .eq('student_id', auth.userId);
  const existing = pf.error ? [] : pf.data || [];
  const existingBySkill = {};
  for (const e of existing) existingBySkill[e.skill] = e;

  // ================= fetch answer history per touched skill =================
  const historyRes = await db
    .from('assessment_answers')
    .select('skill_id,correct,difficulty,created_at')
    .in('skill_id', Object.keys(skillsTouched))
    .order('created_at', { ascending: true });
  const historyBySkill = {};
  if (!historyRes.error) {
    for (const r of historyRes.data || []) {
      if (!historyBySkill[r.skill_id]) historyBySkill[r.skill_id] = [];
      historyBySkill[r.skill_id].push({
        correct: r.correct,
        difficulty: r.difficulty || 1,
        answered_at: Date.parse(r.created_at) || Date.now()
      });
    }
  }

  // ================= recompute mastery =================
  const skillMastery = {}; // skillId -> { mastery, confidence, n, weightedCorrect, recentRate, avgDifficulty }
  for (const [skillId, touched] of Object.entries(skillsTouched)) {
    const stored = historyBySkill[skillId] || [];
    const newOnes = graded
      .filter((g) => g.skill_id === skillId)
      .map((g) => ({ correct: g.correct, difficulty: g.difficulty, answered_at: Date.parse(g.answered_at) }));
    const prevSample = stored.filter((s) => s.correct !== undefined).length;
    const all = stored.concat(newOnes);
    skillMastery[skillId] = computeMastery(all, Date.now());
    skillMastery[skillId].attemptsInThisAssessment = touched.n;
    skillMastery[skillId].correctInThisAssessment = touched.correctN;
    skillMastery[skillId].errorTypes = Object.keys(touched.errorTypes).length
      ? touched.errorTypes
      : null;
    skillMastery[skillId].prevSample = prevSample;
  }

  // ================= persist skill profiles (upsert on conflict) =================
  const skillRows = Object.entries(skillMastery).map(([skillId, m]) => {
    const e = existingBySkill[skillId];
    const status = skillStatus(m.mastery);
    const level1To5 = masteryToLevel(m.mastery);
    return {
      student_id: auth.userId,
      subject: SUBJECT,
      skill: skillId,
      score: m.mastery,
      level: level1To5,
      status: status,
      questions_answered: m.n,
      correct_answers: Math.round(m.n * (m.weightedCorrect || 0)),
      confidence: m.confidence,
      recent_performance: e && Array.isArray(e.recent_performance)
        ? e.recent_performance
        : [],
      skill_meta: {
        avg_difficulty: m.avgDifficulty || null,
        recent_rate: m.recentRate || null,
        last_updated: now
      },
      updated_at: now
    };
  });
  if (skillRows.length) {
    const up = await db
      .from('student_skill_profiles')
      .upsert(skillRows, { onConflict: 'student_id,subject,skill' });
    if (up.error) console.warn('skill profile upsert failed:', up.error.message);
  }

  // ================= learning events =================
  await recordLearningEvent(db, auth.userId, {
    event_type: 'assessment_completed',
    unit_id: unitId,
    lesson_id: lessonId,
    section_id: sectionId,
    skill_id: null,
    event_data: {
      assessment_type: type,
      assessment_id: assessmentId,
      score: scorePct,
      correct: correct,
      total: total,
      skill_deltas: Object.fromEntries(Object.entries(skillMastery).map(([k, v]) => [k, v.mastery]))
    }
  });

  // ================= student learning profile =================
  const classified = classifySkills(skillMastery);
  const overallValues = Object.values(skillMastery).map((m) => m.mastery);
  const overallMastery = overallValues.length
    ? Math.round(overallValues.reduce((s, v) => s + v, 0) / overallValues.length)
    : 0;
  const level = deriveLevel(
    overallMastery,
    classified.critical.length,
    prerequisiteGapCount(skillMastery, PREREQ_MAP)
  );

  const nextAction = determineNextAction({
    type,
    skillResults: skillMastery,
    masteryAfter: skillMastery,
    prerequisites: PREREQ_MAP,
    completedLessons: [],
    currentLessonId: lessonId,
    currentUnitId: unitId,
    courseData: COURSE_DATA
  });

  const misconceptions = [];
  for (const g of graded) {
    if (g.correct || !g.misconception) continue;
    if (!misconceptions.some((m) => m.skill_id === g.skill_id && m.misconception === g.misconception)) {
      misconceptions.push({ skill_id: g.skill_id, misconception: g.misconception });
    }
  }

  const recommendations = buildRecommendations(nextAction, classified.weaknesses, misconceptions);

  const prof = await db
    .from('student_learning_profile')
    .select('id')
    .eq('student_id', auth.userId);
  const hasProfile = prof.data && prof.data.length;
  const profilePatch = {
    student_id: auth.userId,
    subject: SUBJECT,
    overall_level: level,
    overall_mastery: overallMastery,
    skill_mastery: skillMastery,
    strengths: classified.strengths,
    weaknesses: classified.weaknesses,
    misconceptions: misconceptions,
    current_unit_id: unitId,
    current_lesson_id: lessonId,
    next_action: nextAction,
    last_activity: now,
    updated_at: now
  };
  if (hasProfile) {
    await db.from('student_learning_profile').update(profilePatch).eq('id', prof.data[0].id);
  } else {
    await db.from('student_learning_profile').insert(profilePatch);
  }

  return {
    attempt_id: attempt.id,
    score: scorePct,
    correct,
    total,
    level,
    level_label: levelLabel(level),
    skill_mastery: skillMastery,
    strengths: classified.strengths,
    weaknesses: classified.weaknesses,
    critical: classified.critical,
    misconceptions,
    next_action: nextAction,
    recommendations,
    attempt
  };
}

async function recordLearningEvent(db, userId, payload) {
  const { error } = await db.from('learning_events').insert({
    student_id: userId,
    event_type: payload.event_type,
    unit_id: payload.unit_id || null,
    lesson_id: payload.lesson_id || null,
    section_id: payload.section_id || null,
    question_id: payload.question_id || null,
    skill_id: payload.skill_id || null,
    correct: payload.correct,
    difficulty: payload.difficulty,
    event_data: payload.event_data || {}
  });
  return error || null;
}

function buildRecommendations(nextAction, weaknesses, misconceptionList) {
  const recs = [];
  if (nextAction && nextAction.action) {
    recs.push({ type: 'action', text: nextAction.reason || 'تابع المسار الموصى به.' });
  }
  for (const w of weaknesses || []) {
    recs.push({ type: 'weakness', skill: w, text: 'مهارة ' + w + ' تحتاج تقوية.' });
  }
  for (const mc of misconceptionList || []) {
    recs.push({ type: 'misconception', skill: mc.skill_id, text: 'تصحيح فهم خاطئ: ' + mc.misconception });
  }
  return recs;
}

function masteryToLevel(mastery) {
  if (mastery >= 85) return 5;
  if (mastery >= 70) return 4;
  if (mastery >= 55) return 3;
  if (mastery >= 40) return 2;
  return 1;
}

function prerequisiteGapCount(skillMastery, prereqMap) {
  let count = 0;
  for (const [skill, prereqs] of Object.entries(prereqMap)) {
    const cur = skillMastery[skill];
    if (!cur || cur.mastery < 60) continue;
    for (const p of prereqs) {
      const pv = skillMastery[p];
      if (!pv || pv.mastery < 35) count++;
    }
  }
  return count;
}

function performanceStart(data) {
  if (data.started_at && isFinite(Date.parse(data.started_at))) return data.started_at;
  return new Date(Date.now() - (data.duration_seconds || 0) * 1000).toISOString();
}

module.exports = handler;
module.exports.default = handler;