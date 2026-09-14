const { requireUser } = require('../supabase-server');
const helpers = require('./helpers');
const data = require('./engine/data');
const seq = require('./engine/sequence');

function snapshotFrom(state) {
  const course = data.getCourse();
  const snap = seq.computeSnapshot(course, state.progress);
  return snap;
}

function responseOf(state) {
  const course = data.getCourse();
  return {
    course: { title: course.title, version: course.version },
    snapshot: snapshotFrom(state),
    profile: state.profile
  };
}

async function handleGet(req, res, auth) {
  const state = await helpers.getLearnerState(auth.supabase, auth.userId);
  helpers.send(res, 200, responseOf(state));
}

async function handlePost(req, res, auth, body) {
  if (body.__invalid) { helpers.send(res, 400, { error: 'طلب غير صالح: ' + body.message }); return; }
  const refType = body.ref_type;
  const refId = body.ref_id;
  if (refType !== 'element' || helpers.isBlank(refId) || !data.getElementById(refId)) {
    helpers.send(res, 400, { error: 'ref غير صالح. أكمل عنصراً موجوداً فقط (ref_type=element).' });
    return;
  }
  const state = await helpers.getLearnerState(auth.supabase, auth.userId);
  const snap = seq.computeSnapshot(data.getCourse(), state.progress);
  if (!seq.isElementOpen(snap, refId)) {
    helpers.send(res, 403, { error: 'هذا العنصر مقفول. أكمل ما قبله أولاً.' });
    return;
  }
  await auth.supabase.from('course_progress').upsert(
    { user_id: auth.userId, ref_type: 'element', ref_id: refId, status: 'completed', completed_at: new Date().toISOString() },
    { onConflict: 'user_id,ref_type,ref_id' }
  );
  const fresh = await helpers.getLearnerState(auth.supabase, auth.userId);
  helpers.send(res, 200, responseOf(fresh));
}

async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    helpers.send(res, 405, { error: 'Method not allowed' });
    return;
  }
  const auth = await requireUser(req, res);
  if (!auth) return;
  try {
    if (req.method === 'GET') await handleGet(req, res, auth);
    else helpers.readJsonBody(req, (body) => handlePost(req, res, auth, body).catch((err) => {
      console.error('progress POST error:', err);
      if (!res.headersSent) helpers.send(res, 500, { error: 'خطأ داخلي: ' + err.message });
    }));
  } catch (err) {
    console.error('progress error:', err);
    if (!res.headersSent) helpers.send(res, 500, { error: 'خطأ داخلي: ' + err.message });
  }
}

module.exports = handler;
module.exports.default = handler;