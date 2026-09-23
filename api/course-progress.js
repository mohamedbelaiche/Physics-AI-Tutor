// /api/course/progress — متابعة تقدم الكورسات (Supabase + RLS)
// GET  → حالة كل كورس للطالب (completed/opened/status/order) + عدادات
// POST → إتمام كورس مع فرض التسلسل: لا يُقبل إتمام إلا بعد إتمام الذي قبله
// يتبع نمط api/chat.js و api/supabase-server.js (requireUser).
//
// ملاحظة مهمة: لا نعتمد على auth.supabase.auth.setSession هنا لأنه يفشل
// بصمت في supabase-js v2 (refresh_token فارغ → الجلسة لا تُفعَّل) فتذهب
// الطلبات بدور anon فتُرفض من RLS. بدل ذلك نستدعي PostgREST مباشرةً
// بالتوكن الفعلي للمستخدم (Authorization: Bearer <JWT>) — تمامًا كـ chat.js.

const fs = require('fs');
const path = require('path');
const { requireUser, getSupabaseConfig } = require('./supabase-server');

const ROOT = path.join(__dirname, '..');
const COURSE_JSON_PATH = path.join(ROOT, 'public', 'course', 'course.json');

function readCourses() {
  try {
    const data = JSON.parse(fs.readFileSync(COURSE_JSON_PATH, 'utf8'));
    return (data && Array.isArray(data.courses)) ? data.courses : [];
  } catch (err) {
    console.error('course-progress: failed to read course.json:', err.message);
    return [];
  }
}

function sendJson(res, code, payload) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function readJsonBody(req, callback) {
  if (req.body && typeof req.body === 'object') {
    callback(req.body);
    return;
  }
  let body = '';
  req.on('data', function (chunk) {
    body += chunk;
    if (body.length > 1e6) req.destroy();
  });
  req.on('end', function () {
    try {
      callback(body ? JSON.parse(body) : {});
    } catch (err) {
      callback({ __invalid: true, message: err.message });
    }
  });
}

// جزء مشترك لرأس طلب PostgREST: apikey + توكن المستخدم الفعلي حتى تحترم RLS.
function postgrestHeaders(auth) {
  const { anonKey } = getSupabaseConfig();
  return {
    apikey: anonKey,
    Authorization: 'Bearer ' + auth.token
  };
}

async function fetchRows(auth) {
  const { url } = getSupabaseConfig();
  const qs =
    'select=course_id,status,completed_at' +
    '&user_id=eq.' + encodeURIComponent(auth.userId);
  const res = await fetch(url + '/rest/v1/course_progress?' + qs, {
    method: 'GET',
    headers: postgrestHeaders(auth)
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error('GET course_progress: ' + res.status + ' ' + text);
  }
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

async function upsertCompleted(auth, courseId) {
  const { url } = getSupabaseConfig();
  const res = await fetch(url + '/rest/v1/course_progress?on_conflict=user_id,course_id', {
    method: 'POST',
    headers: Object.assign(postgrestHeaders(auth), {
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates'
    }),
    body: JSON.stringify({
      user_id: auth.userId,
      course_id: courseId,
      status: 'completed',
      completed_at: new Date().toISOString()
    })
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error('POST course_progress: ' + res.status + ' ' + text);
  }
}

function buildState(courses, rows) {
  const completedIds = new Set(
    rows.filter(function (r) { return r.status === 'completed'; })
      .map(function (r) { return r.course_id; })
  );
  const result = courses.map(function (course, idx) {
    const prev = idx > 0 ? courses[idx - 1] : null;
    const opened = idx === 0 || (prev && completedIds.has(prev.id));
    const completed = completedIds.has(course.id);
    return {
      id: course.id,
      order: idx + 1,
      status: completed ? 'completed' : 'in_progress',
      completed: completed,
      opened: opened
    };
  });
  return {
    courses: result,
    completedCount: result.filter(function (c) { return c.completed; }).length,
    total: result.length
  };
}

async function handler(req, res) {
  const method = req.method;
  if (method !== 'GET' && method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  const auth = await requireUser(req, res);
  if (!auth) return;

  const courses = readCourses();
  const courseIds = new Set(courses.map(function (c) { return c.id; }));

  try {
    if (method === 'GET') {
      const rows = await fetchRows(auth);
      sendJson(res, 200, buildState(courses, rows));
      return;
    }

    // POST
    readJsonBody(req, async function (data) {
      try {
        if (data.__invalid) {
          sendJson(res, 400, { error: 'طلب غير صالح: ' + data.message });
          return;
        }
        const courseId = data.course_id;
        if (!courseId || !courseIds.has(courseId)) {
          sendJson(res, 400, { error: 'كورس غير معروف.' });
          return;
        }
        const idx = courses.findIndex(function (c) { return c.id === courseId; });
        if (idx > 0) {
          const prev = courses[idx - 1];
          const rows = await fetchRows(auth);
          const prevDone = rows.some(function (r) {
            return r.course_id === prev.id && r.status === 'completed';
          });
          if (!prevDone) {
            sendJson(res, 403, {
              error: 'أتمم الكورس السابق أولاً: ' + prev.title_ar
            });
            return;
          }
        }
        await upsertCompleted(auth, courseId);
        const rows = await fetchRows(auth);
        sendJson(res, 200, Object.assign({ status: 'completed' }, buildState(courses, rows)));
      } catch (err) {
        console.error('course-progress POST error:', err);
        sendJson(res, 500, { error: 'تعذر حفظ التقدم: ' + err.message });
      }
    });
  } catch (err) {
    console.error('course-progress error:', err);
    sendJson(res, 500, { error: 'تعذر الوصول إلى قاعدة البيانات.' });
  }
}

module.exports = handler;
module.exports.default = handler;
