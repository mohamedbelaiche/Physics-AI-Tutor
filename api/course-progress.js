// /api/course/progress — متابعة تقدم الكورسات (Supabase + RLS)
// GET  → حالة كل كورس للطالب (completed/opened/status/order) + عدادات
// POST → إتمام كورس مع فرض التسلسل: لا يُقبل إتمام إلا بعد إتمام الذي قبله
// يتبع نمط api/chat.js و api/supabase-server.js (requireUser).

const fs = require('fs');
const path = require('path');
const { requireUser } = require('./supabase-server');

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

// يحوّل عميل supabase إلى جلسة المستخدم الحقيقي حتى تحترم RLS (auth.uid() = user_id).
async function authedClient(auth) {
  await auth.supabase.auth.setSession({
    access_token: auth.token,
    refresh_token: ''
  });
  return auth.supabase;
}

async function fetchRows(server, userId) {
  const { data, error } = await server
    .from('course_progress')
    .select('course_id, status, completed_at')
    .eq('user_id', userId);
  if (error) throw error;
  return data || [];
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
    const server = await authedClient(auth);

    if (method === 'GET') {
      const rows = await fetchRows(server, auth.userId);
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
          const rows = await fetchRows(server, auth.userId);
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
        await server.from('course_progress').upsert(
          {
            user_id: auth.userId,
            course_id: courseId,
            status: 'completed',
            completed_at: new Date().toISOString()
          },
          { onConflict: 'user_id,course_id' }
        );
        const rows = await fetchRows(server, auth.userId);
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