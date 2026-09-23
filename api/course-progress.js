/**
 * /api/course/progress
 *
 * متابعة تقدّم الكورسات (المقاطع والأجزاء) — Supabase via PostgREST + RLS.
 *
 * البنية (النموذج المعتمد):
 *   - كل الكورسات مفتوحة — لا تسلسل ولا قفل على مستوى الكورسات.
 *   - داخل الكورس: مقاطع (sections)، وكل مقطع أجزاء (parts) تُجتاز بأي ترتيب.
 *   - الجداول: course_progress (لكورس ككلي) + section_progress (لكل جزء).
 *
 * أجزاء المقطع:
 *   - إن وُجد deck شرائح للكورس (public/course/slides/<slug>/index.json) كان
 *     كل شريحة من مقاطعه جزءًا (slide id)، ويُكمل المقطع بتصفح كل الشرائح
 *     أو بتسجيل علامة إتمام («text» في وضع النص أو «slides.complete»).
 *   - وإن لم يوجد deck كان المقطع جزءًا واحدًا («text»).
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
const { requireUser, getSupabaseConfig } = require('./supabase-server');

const ROOT = path.join(__dirname, '..');
const COURSE_JSON_PATH = path.join(ROOT, 'public', 'course', 'course.json');
const SLIDES_DIR = path.join(ROOT, 'public', 'course', 'slides');

// علامات تدل على إتمام المقطع كاملًا في وضع النص أو الشرائح.
const COMPLETE_MARKERS = ['text', 'slides.complete'];

// مفتاح مقطع ثابت يطابق ما ترسله الواجهة (num رقمي بنص).
function sectionKey(section) {
  return String(section && section.num != null ? section.num : (section.title || ''));
}

function readCourses() {
  try {
    const data = JSON.parse(fs.readFileSync(COURSE_JSON_PATH, 'utf8'));
    return (data && Array.isArray(data.courses)) ? data.courses : [];
  } catch (err) {
    console.error('course-progress: failed to read course.json:', err.message);
    return [];
  }
}

// قراءة deck الشرائح (إن وُجد) لتحديد أجزاء كل مقطع.
function readDeck(course) {
  const slug = course && (course.slug || course.id);
  if (!slug) return null;
  try {
    const raw = fs.readFileSync(path.join(SLIDES_DIR, slug, 'index.json'), 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.sections)) return null;
    return parsed.sections.map(function (s) {
      return {
        num: s.num,
        slideIds: Array.isArray(s.slides)
          ? s.slides.map(function (sl) { return sl.id; }).filter(Boolean)
          : []
      };
    });
  } catch (err) {
    return null;
  }
}

// رأس PostgREST: apikey + توكن المستخدم الفعلي حتى تحترم RLS.
function postgrestHeaders(auth) {
  const { anonKey } = getSupabaseConfig();
  return {
    apikey: anonKey,
    Authorization: 'Bearer ' + auth.token
  };
}

function userQuery(auth) {
  return 'user_id=eq.' + encodeURIComponent(auth.userId);
}

// الأجزاء المطلوبة لإكمال مقطع: أجزاء الشرائح إن وُجدت، وإلا «text».
function sectionPartPlan(section, deckSection) {
  const required = (deckSection && deckSection.slideIds.length)
    ? deckSection.slideIds.slice()
    : ['text'];
  return { required: required, total: Math.max(1, required.length) };
}

function isSectionComplete(plan, recordedKeys) {
  const rec = new Set(recordedKeys);
  if (recordedKeys.some(function (k) { return COMPLETE_MARKERS.indexOf(k) !== -1; })) return true;
  return plan.required.every(function (k) { return rec.has(k); });
}

async function fetchCourseRows(auth) {
  const { url } = getSupabaseConfig();
  const qs = 'select=course_id,status,completed_at&' + userQuery(auth);
  const res = await fetch(url + '/rest/v1/course_progress?' + qs, {
    headers: postgrestHeaders(auth)
  });
  if (!res.ok) throw new Error('GET course_progress: ' + res.status);
  const rows = await res.json();
  return Array.isArray(rows) ? rows : [];
}

async function fetchPartRows(auth) {
  const { url } = getSupabaseConfig();
  const qs = 'select=course_id,section_id,part_key,completed_at&' + userQuery(auth);
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

async function markCourseComplete(auth, courseId) {
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

function buildState(courses, courseRows, partRows) {
  const flagged = {};
  courseRows.forEach(function (r) {
    if (r.status === 'completed') flagged[r.course_id] = true;
  });

  const byCourse = {};
  partRows.forEach(function (r) {
    if (!r.course_id) return;
    (byCourse[r.course_id] = byCourse[r.course_id] || []).push(r);
  });

  const decks = courses.map(readDeck);

  const result = courses.map(function (course, ci) {
    const courseId = String(course.id || course.slug);
    const rows = byCourse[courseId] || [];
    const deckSections = decks[ci] || [];

    const bySection = {};
    rows.forEach(function (r) {
      (bySection[r.section_id] = bySection[r.section_id] || []).push(r);
    });

    const sections = (course.sections || []).map(function (section) {
      const sid = sectionKey(section);
      const rec = bySection[sid] || [];
      const recorded = rec.map(function (r) { return r.part_key; });
      const deckSection = deckSections.find(function (d) { return String(d.num) === sid; });
      const plan = sectionPartPlan(section, deckSection);
      const completed = isSectionComplete(plan, recorded);
      const parts = rec.map(function (r) { return { key: r.part_key, completed: true }; });
      return {
        id: sid,
        title: section.title,
        parts: parts,
        parts_total: plan.total,
        completed: completed,
        status: completed ? 'completed' : (rec.length ? 'in_progress' : 'open')
      };
    });

    const completedSections = sections.filter(function (s) { return s.completed; }).length;
    const allDone = sections.length > 0 && completedSections === sections.length;

    return {
      id: courseId,
      title_ar: course.title_ar || course.title || '',
      completed: !!flagged[courseId] || allDone,
      sections: sections,
      completedSections: completedSections,
      totalSections: sections.length,
      opened: true
    };
  });

  return {
    courses: result,
    completedCount: result.filter(function (c) { return c.completed; }).length,
    total: result.length,
    coursesOpenedAt: null
  };
}

function sendJson(res, code, payload) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

async function readJsonBody(req) {
  return new Promise(function (resolve, reject) {
    let body = '';
    req.on('data', function (chunk) {
      body += chunk;
      if (body.length > 1e6) req.destroy();
    });
    req.on('end', function () {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
  });
}

// هل كل مقاطع الكورس مكتملة بعد تسجيل جزء جديد؟
function courseFullyComplete(courses, course, deck, partRows) {
  const courseId = String(course.id || course.slug);
  const all = partRows.filter(function (r) { return String(r.course_id) === courseId; });
  const bySection = {};
  all.forEach(function (r) {
    (bySection[r.section_id] = bySection[r.section_id] || []).push(r.part_key);
  });
  return (course.sections || []).every(function (section) {
    const sid = sectionKey(section);
    const deckSection = deck.find(function (d) { return String(d.num) === sid; });
    const plan = sectionPartPlan(section, deckSection);
    return isSectionComplete(plan, bySection[sid] || []);
  });
}

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
    let data;
    try {
      data = await readJsonBody(req);
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
      const courses = readCourses();
      const course = courses.find(function (c) {
        return String(c.id || c.slug) === courseId;
      });
      if (!course) {
        sendJson(res, 400, { error: 'كورس غير معروف.' });
        return;
      }
      const section = (course.sections || []).find(function (s) {
        return sectionKey(s) === sectionId;
      });
      if (!section) {
        sendJson(res, 400, { error: 'مقطع غير معروف.' });
        return;
      }

      await markPartCompleted(auth, { course_id: courseId, section_id: sectionId, part_key: partKey });

      const deck = readDeck(course) || [];
      const partRows = await fetchPartRows(auth);
      if (courseFullyComplete(courses, course, deck, partRows)) {
        await markCourseComplete(auth, courseId);
      }

      const courseRows = await fetchCourseRows(auth);
      sendJson(res, 200, buildState(courses, courseRows, partRows));
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