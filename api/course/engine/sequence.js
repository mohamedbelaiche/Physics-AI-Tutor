// sequence.js — التتابع الإجباري وحساب حالة كل عقدة من حالة الطالب.
// قواعد (المواصفة قسم 6):
//   - لا يُفتح عنصر إلا بعد إتمام الذي قبله (داخل نفس الدرس).
//   - أول عنصر من درس يُفتح بعد نجاح إمتحان الدرس السابق (أو للدرس الأول من الوحدة الأولى).
//   - «إمتحان الدرس» متاح بعد إتمام كل عناصر الدرس؛ الدرس التالي بعد نجاحه.
//   - «إختبار الوحدة» متاح بعد نجاح كل دروسها؛ الوحدة التالية بعد نجاحه.
//   - «الإمتحان الشامل» متاح بعد نجاح إختبارات الوحدات الخمس.
// الحالة لكل نوع: content node -> locked|open|completed | lesson/unit -> locked|open|exam_ready|passed

function examThreshold(type) {
  if (type === 'lesson') return 60;
  if (type === 'unit') return 50;
  return 60;
}

// progressList: [{ ref_type, ref_id, status, best_score }]
function asMap(progressList) {
  const m = new Map();
  (progressList || []).forEach((p) => m.set(p.ref_type + ':' + p.ref_id, p));
  return m;
}

function computeSnapshot(course, progressList) {
  const rows = asMap(progressList);
  const statuses = new Map(); // 'element:ID' | 'lesson:ID' | 'unit:ID'
  const units = course.units.map((u, ui) => {
    const unitPassed = rows.get('unit:' + u.id) && rows.get('unit:' + u.id).status === 'passed';
    const lessons = u.lessons.map((l, li) => {
      const lessonPassed = rows.get('lesson:' + l.id) && rows.get('lesson:' + l.id).status === 'passed';
      const elements = l.elements.map((e, ei) => {
        const done = rows.get('element:' + e.id) && rows.get('element:' + e.id).status === 'completed';
        return { id: e.id, title: e.title, order: ei + 1, status: done ? 'completed' : 'unknown' };
      });
      return { id: l.id, title: l.title, order: li + 1, lessonPassed, elements };
    });
    return { id: u.id, title: u.title, order: ui + 1, unitPassed, lessons };
  });

  // Pass 1a: أول عنصر من أول درس في الوحدة الأولى مفتوح (إلا إذا كان مكتملاً).
  const firstUnit = units[0];
  if (firstUnit) {
    const firstLesson = firstUnit.lessons[0];
    if (firstLesson && firstLesson.elements[0]) {
      const fe = firstLesson.elements[0];
      const feDone = rows.get('element:' + fe.id) && rows.get('element:' + fe.id).status === 'completed';
      if (!feDone) statuses.set('element:' + fe.id, 'open');
    }
  }

  // Pass 1b: قاعدة فتح كل عنصر (قاعدة الحاكم 1: التتابع الإجباري الصحيح).
  for (let ui = 0; ui < units.length; ui++) {
    const unit = units[ui];
    for (let li = 0; li < unit.lessons.length; li++) {
      const lesson = unit.lessons[li];
      for (const e of lesson.elements) {
        const blockKey = 'element:' + e.id;
        const rowDone = rows.get('element:' + e.id) && rows.get('element:' + e.id).status === 'completed';
        if (rowDone) { statuses.set(blockKey, 'completed'); continue; }
        if (statuses.has(blockKey)) continue;
        const idx = lesson.elements.findIndex((x) => x.id === e.id);
        const prev = lesson.elements[idx - 1];
        const isFirst = idx === 0;
        const prevDone = prev && rows.get('element:' + prev.id) && rows.get('element:' + prev.id).status === 'completed';
        const prevLesson = li > 0 ? unit.lessons[li - 1] : null;
        const prevLessonPassed = prevLesson && rows.get('lesson:' + prevLesson.id) && rows.get('lesson:' + prevLesson.id).status === 'passed';
        const unitPrev = units[ui - 1];
        const unitPrevPassed = unitPrev && rows.get('unit:' + unitPrev.id) && rows.get('unit:' + unitPrev.id).status === 'passed';
        if (isFirst) {
          // أول عنصر من درس يُفتح: بعد نجاح إمتحان الدرس السابق (نفس الوحدة)،
          // أو إذا كان أول درس في وحدة لاحقة ونجح إختبار الوحدة السابقة.
          if (prevLessonPassed) statuses.set(blockKey, 'open');
          else if (li === 0 && unitPrevPassed) statuses.set(blockKey, 'open');
          else statuses.set(blockKey, 'locked');
        } else if (prevDone) {
          statuses.set(blockKey, 'open');
        } else {
          statuses.set(blockKey, 'locked');
        }
      }
    }
  }

  // Pass 2: حالة الدروس والوحدات والامتحانات.
  const unitsOut = [];
  for (const u of course.units) {
    const unitRow = rows.get('unit:' + u.id);
    const unitPassed = !!(unitRow && unitRow.status === 'passed');
    const lessonsOut = u.lessons.map((l) => {
      const lessonRow = rows.get('lesson:' + l.id);
      const lessonPassed = !!(lessonRow && lessonRow.status === 'passed');
      const allElementsDone = l.elements.every((e) => {
        const r = rows.get('element:' + e.id);
        return r && r.status === 'completed';
      });
      let lessonStatus = 'locked';
      if (lessonPassed) lessonStatus = 'passed';
      else if (allElementsDone) lessonStatus = 'exam_ready';
      else if (['open', 'completed'].indexOf(statuses.get('element:' + (l.elements[0] || {}).id)) !== -1) lessonStatus = 'open';
      return {
        id: l.id, title: l.title, order: l.order, status: lessonStatus,
        best_score: lessonRow && Number.isFinite(lessonRow.best_score) ? lessonRow.best_score : null,
        exam: { status: (allElementsDone ? 'available' : 'locked') },
        elements: l.elements.map((e) => ({ id: e.id, title: e.title, order: e.order, status: statuses.get('element:' + e.id) || 'locked' }))
      };
    });
    const allLessonsPassed = lessonsOut.every((ls) => ls.status === 'passed');
    let unitStatus = 'locked';
    if (unitPassed) unitStatus = 'passed';
    else if (allLessonsPassed) unitStatus = 'exam_ready';
    else if (u.id === course.units[0].id && lessonsOut[0] && lessonsOut[0].status !== 'locked') unitStatus = 'open';
    else {
      const prevUnitObj = course.units[course.units.indexOf(u) - 1];
      const prevPassed = prevUnitObj && rows.get('unit:' + prevUnitObj.id) && rows.get('unit:' + prevUnitObj.id).status === 'passed';
      if (prevPassed) unitStatus = 'open';
    }
    unitsOut.push({
      id: u.id, title: u.title, order: u.order, status: unitStatus,
      best_score: unitRow && Number.isFinite(unitRow.best_score) ? unitRow.best_score : null,
      lessons: lessonsOut,
      unit_exam: { status: allLessonsPassed ? 'available' : 'locked' }
    });
  }

  // قاعدة الحاكم 2: الإمتحان النهائي يُفتح فقط بعد نجاح كل وحدات الدورة (status === 'passed').
  const allUnitsPassed = unitsOut.every((u) => u.status === 'passed');
  const finalExam = { status: allUnitsPassed ? 'available' : 'locked' };

  // current_position: أول عنصر مفتوح غير مكتمل بعد.
  let current = null;
  outer:
  for (const u of course.units) {
    for (const l of u.lessons) {
      for (const e of l.elements) {
        const st = statuses.get('element:' + e.id);
        if (st === 'open') { current = { unit_id: u.id, lesson_id: l.id, element_id: e.id }; break outer; }
      }
    }
  }

  return { statuses, units: unitsOut, final_exam: finalExam, current_position: current };
}

function isElementOpen(snapshot, elementId) {
  return snapshot.statuses.get('element:' + elementId) === 'open';
}

function isExamAvailable(snapshot, type, refId) {
  if (type === 'lesson') {
    const u = snapshot.units.find((x) => x.lessons.some((l) => l.id === refId));
    const l = u && u.lessons.find((x) => x.id === refId);
    return !!(l && l.exam.status === 'available');
  }
  if (type === 'unit') {
    const u = snapshot.units.find((x) => x.id === refId);
    return !!(u && u.unit_exam.status === 'available');
  }
  if (type === 'final') return snapshot.final_exam.status === 'available';
  return false;
}

module.exports = { examThreshold, computeSnapshot, isElementOpen, isExamAvailable };