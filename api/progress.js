// /api/progress
//   GET  → aggregated learning progress (completed content, event summary, profile)
//   POST → record a learning event / mark content completed
// Body: { event: 'section_completed'|'lesson_completed'|'unit_completed'|'lesson_started',
//         unit_id, lesson_id, section_id?, skill_id? }
const { requireUser, getSupabaseConfig } = require('./supabase-server');
const courseData = require('./engine/course-data');

const ALLOWED_EVENTS = [
  'lesson_started', 'section_completed', 'quiz_started', 'question_answered',
  'quiz_completed', 'lesson_completed', 'unit_completed',
  'ai_explanation_requested', 'extra_example_requested', 'review_started',
  'assessment_started', 'assessment_completed', 'lesson_assessment_completed',
  'unit_assessment_completed'
];

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
  const auth = await requireUser(req, res);
  if (!auth) return;

  if (req.method === 'GET') return getProgress(req, res, auth);
  if (req.method === 'POST') {
    readJsonBody(req, function (data) {
      postProgress(data, res, auth).catch(function (err) {
        console.error('progress error:', err);
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: 'خطأ داخلي في الخادم.' }));
        }
      });
    });
    return;
  }
  res.writeHead(405, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ error: 'Method not allowed' }));
}

async function getProgress(req, res, auth) {
  try {
    const { url, anonKey } = getSupabaseConfig();
    const headers = {
      'Content-Type': 'application/json',
      apikey: anonKey,
      Authorization: 'Bearer ' + auth.token
    };
    const [profileRes, eventsRes, attemptsRes] = await Promise.all([
      fetch(url + '/rest/v1/student_learning_profile?student_id=eq.' + auth.userId, { headers }),
      fetch(
        url +
          '/rest/v1/learning_events?student_id=eq.' + auth.userId +
          '&select=event_type,unit_id,lesson_id,section_id,skill_id,correct,event_data,created_at&order=created_at.desc&limit=50',
        { headers }
      ),
      fetch(
        url +
          '/rest/v1/assessment_attempts?student_id=eq.' + auth.userId +
          '&select=assessment_type,assessment_id,score,skill_results,started_at,completed_at&order=started_at.desc&limit=10',
        { headers }
      )
    ]);

    const profile = profileRes.ok ? await profileRes.json() : [];
    const events = eventsRes.ok ? await eventsRes.json() : [];
    const attempts = attemptsRes.ok ? await attemptsRes.json() : [];

    // Aggregate counts from events (recompute from full history if needed).
    const stats = summarizeEvents(events);
    const course = courseData.getCourse();

    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(
      JSON.stringify({
        profile: profile[0] || null,
        stats,
        recent_events: events,
        recent_assessments: attempts,
        course: course
      })
    );
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'خطأ داخلي في الخادم.' }));
  }
}

async function postProgress(data, res, auth) {
  if (data.__invalid) {
    res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'طلب غير صالح: ' + data.message }));
    return;
  }
  const eventType = String(data.event || '');
  if (!ALLOWED_EVENTS.includes(eventType)) {
    res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'نوع الحدث غير معروف: ' + eventType }));
    return;
  }

  const { url, anonKey } = getSupabaseConfig();
  const headers = {
    'Content-Type': 'application/json',
    apikey: anonKey,
    Authorization: 'Bearer ' + auth.token
  };

  const eventBody = {
    student_id: auth.userId,
    event_type: eventType,
    unit_id: data.unit_id || null,
    lesson_id: data.lesson_id || null,
    section_id: data.section_id || null,
    question_id: data.question_id || null,
    skill_id: data.skill_id || null,
    correct: data.correct === undefined ? null : !!data.correct,
    difficulty: data.difficulty || null,
    event_data: data.event_data || {}
  };
  const ev = await fetch(url + '/rest/v1/learning_events', {
    method: 'POST',
    headers: { ...headers, Prefer: 'return=minimal' },
    body: JSON.stringify(eventBody)
  });
  if (!ev.ok) {
    const txt = await ev.text();
    res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'تعذر تسجيل الحدث: ' + txt.slice(0, 200) }));
    return;
  }

  // Mark completed content in the learning profile.
  const isCompletion =
    eventType === 'section_completed' || eventType === 'lesson_completed' || eventType === 'unit_completed';
  if (isCompletion && data.unit_id) {
    const key = eventType === 'section_completed'
      ? (data.section_id || data.lesson_id)
      : eventType === 'lesson_completed'
        ? data.lesson_id
        : data.unit_id;
    if (key) {
      const pr = await fetch(url + '/rest/v1/student_learning_profile?student_id=eq.' + auth.userId, { headers });
      const rows = pr.ok ? await pr.json() : [];
      if (rows.length) {
        const completed = (rows[0].completed_content || []).slice();
        if (!completed.includes(key)) completed.push(key);
        await fetch(url + '/rest/v1/student_learning_profile?id=eq.' + rows[0].id, {
          method: 'PATCH',
          headers: { ...headers, Prefer: 'return=minimal' },
          body: JSON.stringify({ completed_content: completed, last_activity: new Date().toISOString() })
        });
      }
    }
  }

  res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ ok: true, event: eventType }));
}

function summarizeEvents(events) {
  const stats = {
    sections_completed: 0,
    lessons_completed: 0,
    units_completed: 0,
    quizzes_started: 0,
    quizzes_completed: 0,
    assessments_completed: 0,
    questions_answered: 0,
    correct_answers: 0,
    ai_explanations: 0
  };
  for (const e of events || []) {
    switch (e.event_type) {
      case 'section_completed': stats.sections_completed++; break;
      case 'lesson_completed': stats.lessons_completed++; break;
      case 'unit_completed': stats.units_completed++; break;
      case 'quiz_started': stats.quizzes_started++; break;
      case 'quiz_completed': stats.quizzes_completed++; break;
      case 'assessment_completed':
      case 'lesson_assessment_completed':
      case 'unit_assessment_completed':
        stats.assessments_completed++; break;
      case 'question_answered':
        stats.questions_answered++;
        if (e.correct) stats.correct_answers++;
        break;
      case 'ai_explanation_requested': stats.ai_explanations++; break;
    }
  }
  return stats;
}

module.exports = handler;
module.exports.default = handler;