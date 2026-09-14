const { requireUser } = require('../supabase-server');
const helpers = require('./helpers');
const data = require('./engine/data');
const seq = require('./engine/sequence');
const examGen = require('./engine/exam-gen');

async function handler(req, res) {
  if (req.method !== 'GET') { helpers.send(res, 405, { error: 'Method not allowed' }); return; }
  const auth = await requireUser(req, res);
  if (!auth) return;

  const url = new URL(req.url, 'http://localhost');
  const type = url.searchParams.get('type');
  const ref = url.searchParams.get('ref');
  if (!['lesson', 'unit', 'final'].includes(type) || helpers.isBlank(ref)) {
    helpers.send(res, 400, { error: 'type (lesson|unit|final) و ref مطلوبان.' });
    return;
  }
  if (type === 'lesson' && !data.getLessonById(ref)) { helpers.send(res, 404, { error: 'درس غير موجود.' }); return; }
  if (type === 'unit' && !data.getUnitById(ref)) { helpers.send(res, 404, { error: 'وحدة غير موجودة.' }); return; }

  try {
    const state = await helpers.getLearnerState(auth.supabase, auth.userId);
    const snap = seq.computeSnapshot(data.getCourse(), state.progress);
    if (!seq.isExamAvailable(snap, type, ref)) {
      helpers.send(res, 403, { error: 'هذا الإمتحان غير متاح بعد. أكمل ما قبله أولاً.' });
      return;
    }

    const course = data.getCourse();
    const bank = data.getQuestionBank();
    const masteryMap = state.skillMap;
    const questions = examGen.generateExam(course, bank, type, ref, masteryMap);
    if (!questions.length) {
      helpers.send(res, 409, { error: 'بنك الأسئلة فارغ أو غير كافٍ لهذا الامتحان.' });
      return;
    }

    const { data: attemptData, error } = await auth.supabase.from('course_exam_attempts').insert({
      user_id: auth.userId, exam_type: type, ref_id: ref,
      total_questions: questions.length, correct_count: 0, score: 0, passed: false,
      question_ids: questions.map((q) => q.id)
    }).select('id').single();
    if (error) throw error;

    helpers.send(res, 200, {
      attempt_id: attemptData.id,
      exam_type: type,
      ref_id: ref,
      pass_score: seq.examThreshold(type),
      instructions: {
        title: type === 'lesson' ? 'إمتحان الدرس' : type === 'unit' ? 'إختبار الوحدة' : 'الإمتحان الشامل',
        total: questions.length
      },
      questions: questions.map((q, i) => ({
        index: i, question_id: q.id, question: q.question, options: q.options, skill: q.skill
      }))
    });
  } catch (err) {
    console.error('exam error:', err);
    if (!res.headersSent) helpers.send(res, 500, { error: 'خطأ داخلي: ' + err.message });
  }
}

module.exports = handler;
module.exports.default = handler;