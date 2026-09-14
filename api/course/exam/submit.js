const { requireUser } = require('../../supabase-server');
const helpers = require('../helpers');
const data = require('../engine/data');
const seq = require('../engine/sequence');
const skillsUtil = require('../engine/skills');
const scoring = require('../engine/scoring');

async function handler(req, res) {
  if (req.method !== 'POST') { helpers.send(res, 405, { error: 'Method not allowed' }); return; }
  const auth = await requireUser(req, res);
  if (!auth) return;

  helpers.readJsonBody(req, async function (body) {
    try {
      if (body.__invalid) { helpers.send(res, 400, { error: 'طلب غير صالح: ' + body.message }); return; }
      const attemptId = body.attempt_id;
      if (!attemptId) { helpers.send(res, 400, { error: 'attempt_id مطلوب.' }); return; }

      const supabase = auth.supabase;
      const { data: attempt, error } = await supabase.from('course_exam_attempts').select('*').eq('id', attemptId).single();
      if (error || !attempt) { helpers.send(res, 404, { error: 'محاولة غير موجودة.' }); return; }
      if (attempt.submitted_at) {
        const stored = await loadStoredAnswers(supabase, attemptId);
        const result = await buildResult(supabase, auth.userId, attempt, stored);
        helpers.send(res, 200, result);
        return;
      }

      const grade = scoring.gradeAttempt(data.getQuestionBank(), servedQuestions(attempt), body.answers || [], attempt.exam_type);
      const duration = Math.max(0, Math.round((Date.now() - new Date(attempt.started_at).getTime()) / 1000));

      // تحديث ملفات المهارات
      const { data: existingSkills } = await supabase.from('course_skill_profiles').select('skill,mastery,n').eq('user_id', auth.userId);
      const current = {};
      (existingSkills || []).forEach((r) => { current[r.skill] = { mastery: r.mastery, n: r.n }; });
      for (const skill of Object.keys(grade.skill_updates)) {
        const upd = grade.skill_updates[skill];
        const next = skillsUtil.updateSkill(current[skill], upd.attemptScore, upd.n);
        current[skill] = next;
        await supabase.from('course_skill_profiles').upsert(
          { user_id: auth.userId, skill, mastery: next.mastery, n: next.n },
          { onConflict: 'user_id,skill' }
        );
      }

      // إعادة حساب نبذة التعلم (الإتقان العام + نقاط القوة/الضعف) بعد تحديث المهارات
      const { data: stateProfileRow } = await supabase.from('student_learning_profile')
        .select('*').eq('user_id', auth.userId).maybeSingle();
      await helpers.saveLearningProfile(supabase, auth.userId, current, stateProfileRow);

      // حفظ النتيجة والأجوبة
      await supabase.from('course_exam_attempts').update({
        correct_count: grade.correct_count, score: grade.score, passed: grade.passed,
        submitted_at: new Date().toISOString(), duration_sec: duration
      }).eq('id', attemptId);

      const answersRows = (body.answers || []).map((a) => {
        const q = data.questionById(a.question_id);
        return {
          attempt_id: attemptId,
          question_id: a.question_id,
          skill: q ? q.skill : '',
          difficulty: q ? q.difficulty : 1,
          selected_index: typeof a.selected_index === 'number' ? a.selected_index : null,
          is_correct: q ? a.selected_index === q.correct_index : false,
          response_time_sec: Math.max(0, Math.round(a.response_time_sec || 0))
        };
      });
      if (answersRows.length) {
        const servedIds = Array.isArray(attempt.question_ids) ? attempt.question_ids : (attempt.question_ids || []);
        const kept = answersRows.filter((r) => servedIds.indexOf(r.question_id) !== -1);
        if (kept.length) await supabase.from('course_exam_answers').insert(kept);
      }

      // فتح المسار حسب نوع الامتحان
      await unlockAfterExam(supabase, auth.userId, attempt, grade);

      const result = await buildResult(supabase, auth.userId, attempt, body.answers || [], grade);
      helpers.send(res, 200, result);
    } catch (err) {
      console.error('exam submit error:', err);
      if (!res.headersSent) helpers.send(res, 500, { error: 'خطأ داخلي: ' + err.message });
    }
  });
}

async function loadStoredAnswers(supabase, attemptId) {
  const { data: rows } = await supabase.from('course_exam_answers').select('question_id,selected_index').eq('attempt_id', attemptId);
  return (rows || []).map((r) => ({ question_id: r.question_id, selected_index: r.selected_index }));
}

function servedQuestions(attempt) {
  const ids = Array.isArray(attempt.question_ids) ? attempt.question_ids : (attempt.question_ids || []);
  return ids.map((id) => data.questionById(id)).filter(Boolean);
}

async function unlockAfterExam(supabase, userId, attempt, grade) {
  if (attempt.exam_type === 'lesson' && grade.passed) {
    // الإمتحان مرّ: نُثبت نجاح الدرس (لا يفتح غيره؛ أول عنصر من الدرس التالي يفتحه computeSnapshot).
    await supabase.from('course_progress').upsert(
      { user_id: userId, ref_type: 'lesson', ref_id: attempt.ref_id, status: 'passed', best_score: grade.score },
      { onConflict: 'user_id,ref_type,ref_id' }
    );
  } else if (attempt.exam_type === 'unit' && grade.passed) {
    await supabase.from('course_progress').upsert(
      { user_id: userId, ref_type: 'unit', ref_id: attempt.ref_id, status: 'passed', best_score: grade.score },
      { onConflict: 'user_id,ref_type,ref_id' }
    );
  } else if (attempt.exam_type === 'final') {
    await supabase.from('course_progress').upsert(
      { user_id: userId, ref_type: 'exam_final', ref_id: 'final', status: 'completed', best_score: grade.score },
      { onConflict: 'user_id,ref_type,ref_id' }
    );
  }
  // أفضل درجة تُحفظ دائماً حتى عند الرسوب
  const { data: row } = await supabase.from('course_progress')
    .select('best_score').eq('user_id', userId).eq('ref_type', attempt.exam_type === 'lesson' ? 'lesson' : attempt.exam_type === 'unit' ? 'unit' : 'exam_final')
    .eq('ref_id', attempt.exam_type === 'final' ? 'final' : attempt.ref_id).maybeSingle();
  const best = Math.max((row && row.best_score) || 0, grade.score);
  await supabase.from('course_progress').upsert(
    { user_id: userId, ref_type: attempt.exam_type === 'lesson' ? 'lesson' : attempt.exam_type === 'unit' ? 'unit' : 'exam_final',
      ref_id: attempt.exam_type === 'final' ? 'final' : attempt.ref_id,
      status: grade.passed ? (attempt.exam_type === 'final' ? 'completed' : 'passed') : (row && row.status) || 'locked',
      best_score: best },
    { onConflict: 'user_id,ref_type,ref_id' }
  );
}

async function buildResult(supabase, userId, attempt, answers, forcedGrade) {
  const grade = forcedGrade || scoring.gradeAttempt(data.getQuestionBank(), servedQuestions(attempt), answers || [], attempt.exam_type);
  const state = await helpers.getLearnerState(supabase, userId);
  const snap = seq.computeSnapshot(data.getCourse(), state.progress);
  return {
    result: {
      exam_type: attempt.exam_type, ref_id: attempt.ref_id,
      total: grade.total, correct_count: grade.correct_count, score: grade.score, passed: grade.passed,
      pass_score: seq.examThreshold(attempt.exam_type),
      per_skill: grade.per_skill,
      strengths: state.profile.strengths, weaknesses: state.profile.weaknesses,
      overall_mastery: state.profile.overall_mastery, overall_level: state.profile.overall_level
    },
    snapshot: snap
  };
}

module.exports = handler;
module.exports.default = handler;