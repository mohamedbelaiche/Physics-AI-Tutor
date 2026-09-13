// /api/adaptive
//   GET  /api/adaptive/next   → current stored next_action + recommendations
//   POST /api/adaptive/next   → recompute next action from current mastery state
// Body: { unit_id?, lesson_id? } — recompute from stored student_learning_profile.
// Implemented as /api/adaptive with a ?next=1 or body; this endpoint is called by
// the frontend wherever the recommended action should be refreshed.
const { requireUser, getSupabaseConfig } = require('./supabase-server');
const courseData = require('./engine/course-data');
const { classifySkills, deriveLevel, levelLabel } = require('./engine/skill-mastery');
const { determineNextAction } = require('./engine/adaptive-path');

const PREREQ_MAP = courseData.getPrerequisiteMap();
const COURSE_DATA = courseData.getCourse() || { units: [] };

function readJsonBody(req, callback) {
  if (req.body && typeof req.body === 'object') {
    callback(req.body);
    return;
  }
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    try {
      callback(body ? JSON.parse(body) : {});
    } catch (e) {
      callback({ __invalid: true, message: e.message });
    }
  });
}

async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }
  const auth = await requireUser(req, res);
  if (!auth) return;

  if (req.method === 'GET') {
    return getNext(req, res, auth);
  }
  readJsonBody(req, function (data) {
    postNext(data, res, auth).catch(function (err) {
      console.error('adaptive error:', err);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: 'خطأ داخلي في الخادم.' }));
      }
    });
  });
}

async function getNext(req, res, auth) {
  try {
    const { url, anonKey } = getSupabaseConfig();
    const headers = {
      'Content-Type': 'application/json',
      apikey: anonKey,
      Authorization: 'Bearer ' + auth.token
    };
    const pr = await fetch(url + '/rest/v1/student_learning_profile?student_id=eq.' + auth.userId, { headers });
    const rows = pr.ok ? await pr.json() : [];
    const profile = rows[0] || null;
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(
      JSON.stringify({
        next_action: (profile && profile.next_action) || null,
        overall_level: (profile && profile.overall_level) || null,
        overall_mastery: (profile && profile.overall_mastery) || 0,
        weaknesses: (profile && profile.weaknesses) || [],
        recommended_content: (profile && profile.recommended_content) || []
      })
    );
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'خطأ داخلي في الخادم.' }));
  }
}

async function postNext(data, res, auth) {
  if (data.__invalid) {
    res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'طلب غير صالح: ' + data.message }));
    return;
  }
  try {
    const { url, anonKey } = getSupabaseConfig();
    const headers = {
      'Content-Type': 'application/json',
      apikey: anonKey,
      Authorization: 'Bearer ' + auth.token
    };
    const pr = await fetch(url + '/rest/v1/student_learning_profile?student_id=eq.' + auth.userId, { headers });
    const rows = pr.ok ? await pr.json() : [];
    const profile = rows[0] || null;
    const masteryAfter = (profile && profile.skill_mastery) || {};
    const lessonId = data.lesson_id || (profile && profile.current_lesson_id) || '';
    const unitId = data.unit_id || (profile && profile.current_unit_id) || '';

    const nextAction = determineNextAction({
      type: data.type || 'lesson',
      skillResults: masteryAfter,
      masteryAfter,
      prerequisites: PREREQ_MAP,
      completedLessons: (profile && profile.completed_content) || [],
      currentLessonId: lessonId,
      currentUnitId: unitId,
      courseData: COURSE_DATA
    });

    // Persist the recomputed action.
    const updateBody = { next_action: nextAction, updated_at: new Date().toISOString() };
    if (lessonId) updateBody.current_lesson_id = lessonId;
    if (unitId) updateBody.current_unit_id = unitId;
    if (profile) {
      await fetch(url + '/rest/v1/student_learning_profile?id=eq.' + profile.id, {
        method: 'PATCH',
        headers: { ...headers, Prefer: 'return=minimal' },
        body: JSON.stringify(updateBody)
      });
    }

    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ next_action: nextAction }));
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'خطأ داخلي في الخادم.' }));
  }
}

module.exports = handler;
module.exports.default = handler;