/**
 * /api/course/progress
 *
 * متابعة تقدّم الكورسات (المقاطع والأجزاء) — Supabase via PostgREST + RLS.
 *
 * البنية (النموذج الجديد المعتمد):
 *   - كل الكورسات مفتوحة — لا تسلسل ولا قفل على مستوى الكورسات.
 *   - داخل الكورس: مقاطع (sections)، وكل مقطع أجزاء (parts) تُجتاز بأي ترتيب.
 *   - الجداول: course_progress (للكورس ككل) + section_progress (لكل جزء).
 *
 * GET  /api/course/progress -> { courses: [ { id, title_ar, completed,
 *                              completedSections, totalSections,
 *                              sections: [ { id, title, parts: [...] } ] } ],
 *                              completedCount, total }
 * POST { course_id, section_id, part_key } -> يسجّل إتمام جزء.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { requireUser, getSupabaseConfig, postgrestHeaders } = require('./supabase-server');

const ROOT = path.join(__dirname, '..');
const COURSE_PATH = path.join(ROOT, 'public', 'courseData.json');

function readCourses() {
  try {
    const raw = fs.readFileSync(COURSE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return (parsed && Array.isArray(parsed.courses)) ? parsed.courses : [];
  } catch (err) {
    console.error('course-progress: failed to read courseData.json:', err.message);
    return [];
  }
}

function userQuery(auth) {
  return 'user_id=eq.' + encodeURIComponent(auth.userId);
}

function shortUserQuery(auth) {
  return userQuery(auth);
}

function countParts(section) {
  if (section && Array.isArray(section.parts)) return section.parts.length;
  const ids = (section && section.content_md || '')
    .split('\n')
    .filter(function (line) {
      return /^(#{2,4})\s/.test(line) || /\d+\.\s*(تمرين|مثال|نشاط|مسألة)/.test(line);
    });
  return Math.max(1, ids.length);
}

async function fetchCourseRows(auth) {
  const { url } = getSupabaseConfig();
  const qs = 'select=course_id,status,completed_at&' + shortUserQuery(auth);
  const res = await fetch(url + '/rest/v1/course_progress?' + qs, {
    headers: postgrestHeaders(auth)
  });
  if (!res.ok) throw new Error('GET course_progress: ' + res.status);
  const rows = await res.json();
  return Array.isArray(rows) ? rows : [];
}

async function fetchPartRows(auth) {
  const { url } = getSupabaseConfig();
  const qs = 'select=course_id,section_id,part_key,completed_at&' + shortUserQuery(auth);
  const res = await fetch(url + '/rest/v1/section_progress?' + qs, {
    headers: postgrestHeaders(auth)
  });
  if (!res.ok) throw new Error('GET section_progress: ' + res.status);
  const rows = await res.json();
  return Array.isArray(rows) ? rows : [];
}

async function markPartCompleted(auth, data) {
  const { url } = getSupabaseConfig();
  const body = {
    user_id: auth.userId,
    course_id: data.course_id,
    section_id: data.section_id,
    part_key: data.part_key,
    completed_at: new Date().toISOString()
  };
  const res = await fetch(
    url + '/rest/v1/section_progress?on_conflict=user_id,course_id,section_id,part_key',
    {
      method: 'POST',
      headers: Object.assign(postgrestHeaders(auth), {
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates'
      }),
      body: JSON.stringify(body)
    }
  );
  if (!res.ok) throw new Error('POST section_progress: ' + res.status);
}

async function copyCourseComplete(auth, courseId) {
  const { url } = getSupabaseConfig();
  const body = {
    user_id: auth.userId,
    course_id: courseId,
    status: 'completed',
    completed_at: new Date().toISOString()
  };
  const res = await fetch(
    url + '/rest/v1/course_progress?on_conflict=user_id,course_id',
    {
      method: 'POST',
      headers: Object.assign(postgrestHeaders(auth), {
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates'
      }),
      body: JSON.stringify(body)
    }
  );
  if (!res.ok) throw new Error('POST course_progress: ' + res.status);
}

function buildState(courses, courseRows, partRows, helper) {
  const flagged = {};
  courseRows.forEach(function (row) {
    if (row.status === 'completed') flagged[row.course_id] = true;
  });

  const byCourse = {};
  partRows.forEach(function (row) {
    if (!row.course_id) return;
    byCourse[row.course_id] = byCourse[row.course_id] || [];
    byCourse[row.course_id].push(row);
  });

  const result = courses.map(function (course) {
    const courseId = String(course.id || course.slug);
    const bySection = {};

    (byCourse[courseId] || []).forEach(function (row) {
      bySection[row.section_id] = bySection[row.section_id] || [];
      bySection[row.section_id].push(row.part_key);
    });

    const sections = (course.sections || []).map(function (section) {
      const sid = String(section.id != null ? section.id : section.title || section.num || '');
      const done = bySection[sid] || [];
      const keys = done.map(function (key) {
        return { key: key, completed: true };
      });
      const total = (section.parts && section.parts.length) || 1;
      const completed = done.length >= total;
      return {
        id: sid,
        title: section.title,
        parts: keys,
        parts_total: total,
        completed: !!completed,
        status: completed ? 'completed' : (done.length ? 'in_progress' : 'open')
      };
    });

    const completedSections = sections.filter(function (s) { return s.completed; }).length;
    const allDone = completedSections === sections.length;

    return {
      id: courseId,
      title_ar: course.title_ar || course.title_ar_ || course.title || '',
      completed: !!flagged[courseId] || allDone,
      sections: sections,
      completedSections: completedSections,
      totalSections: sections.length,
      opened: true
    };
  });

  const completedCourses = result.filter(function (c) { return c.completed; });
  return {
    courses: result,
    completedCount: completedCourses.length,
    total: result.length,
    coursesOpenedAt: null
  };
}

function sendJson(res, code, payload) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

/* ---------- ما ذكرناه عن الوصول: كل الكورسات مفيدة ---------- */

async function handler(req, res) {
  const auth = await requireUser(req, res);
  if (!auth) return;

  if (req.method === 'GET') {
    try {
      const courses = readCourses();
      const courseRows = await fetchCourseRows(auth);
      const partRows = await fetchPartRows(auth);
      sendJson(res, 200, buildState(courses, courseRows, partRows));
      return;
    } catch (err) {
      console.error('course-progress GET error:', err);
      sendJson(res, 500, { error: 'تعذر قراءة التقدم: ' + err.message });
      return;
    }
  }

  if (req.method === 'POST') {
    let data = {};
    try {
      const raw = await new Promise(function (resolve, reject) {
        let body = '';
        req.on('data', function (chunk) { body += chunk; });
        req.on('end', function () {
          try { resolve(body ? JSON.parse(body) : {}); }
          catch (err) { reject(err); }
        });
      });
      data = raw || {};
    } catch (err) {
      sendJson(res, 400, { error: 'جسم الطلب غير صالح: ' + err.message });
      return;
    }

    const courseId = data.course_id != null ? String(data.course_id) : '';
    const sectionId = data.section_id != null ? String(data.section_id) : '';
    const partKey = data.part_key != null ? String(data.part_key) : '';

    if (!courseId || !sectionId || !partKey) {
      sendJson(res, 400, { error: 'أرسل course_id و section_id و part_key.' });
      return;
    }

    try {
      await markPartCompleted(auth, { course_id: courseId, section_id: sectionId, part_key: partKey });

      const courses = readCourses();
      const course = courses.find(function (c) {
        return String(c.id || c.slug) === courseId;
      });
      let markCourse = false;
      if (course) {
        const section = (course.sections || []).find(function (s) {
          return String(s.id != null ? s.id : s.title || s.num || '') === sectionId;
        });
        if (section) {
          const total = (section.parts && section.parts.length) || 1;
          const partRows = await fetchPartRows(auth);
          const doneCount = partRows.filter(function (r) {
            return String(r.course_id) === courseId && String(r.section_id) === sectionId;
          }).length;
          const allSectionsDone = (course.sections || []).every(function (s) {
            const sid = String(s.id != null ? s.id : s.title || s.num || '');
            const sTotal = (s.parts && s.parts.length) || 1;
            const sDone = partRows.filter(function (r) {
              return String(r.course_id) === courseId && String(r.section_id) === sid;
            }).length;
            return sDone >= sTotal;
          });
          if (allSectionsDone) markCourse = true;
          void total; void doneCount;
        }
      }

      if (markCourse) {
        await copyCourseComplete(auth, courseId);
      }

      const courseRows = await fetchCourseRows(auth);
      const partRows = await fetchPartRows(auth);
      const allCourses = readCourses();
      sendJson(res, 200, buildState(allCourses, courseRows, partRows));
      return;
    } catch (err) {
      console.error('course-progress POST error:', err);
      sendJson(res, 500, { error: 'تعذر حفظ التقدم: ' + err.message });
      return;
    }
  }

  sendJson(res, 405, { error: 'Method not allowed' });
}

module.exports = handler;
module.exports.default = handler;
