(function () {
  var api = function (path, opts) {
    opts = opts || {};
    var tokenPromise = (window.AppAuth && window.AppAuth.getSession)
      ? Promise.resolve(window.AppAuth.getSession())
      : Promise.resolve(null);
    return tokenPromise.then(function (session) {
      var token = session && session.access_token;
      var headers = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = 'Bearer ' + token;
      return fetch(path, {
        method: opts.method || 'GET',
        headers: headers,
        body: opts.body ? JSON.stringify(opts.body) : undefined
      });
    }).then(function (r) {
      return r.json().then(function (j) {
        if (!r.ok) throw new Error(j && j.error ? j.error : 'خطأ في الخادم');
        return j;
      });
    });
  };

  var els = {
    tabCourse: document.getElementById('tab-course'),
    tabSummaries: document.getElementById('tab-summaries'),
    dashboard: document.getElementById('course-dashboard'),
    lessonView: document.getElementById('course-lesson-view'),
    examView: document.getElementById('course-exam-view'),
    resultView: document.getElementById('course-result-view'),
    breadcrumb: document.getElementById('course-breadcrumb'),
    element: document.getElementById('course-element'),
    elementActions: document.getElementById('course-element-actions'),
    adaptCard: document.getElementById('course-adapt-card'),
    msg: document.getElementById('course-msg'),
    examHead: document.getElementById('course-exam-head'),
    examQ: document.getElementById('course-exam-q'),
    examActions: document.getElementById('course-exam-actions'),
    result: document.getElementById('course-result'),
    backLesson: document.getElementById('course-back-lesson')
  };

  var state = { snapshot: null, profile: null, element: null, exam: null, currentIndex: 0, answers: {} };

  function show(id, show) {
    var v = document.getElementById(id);
    if (v) v.classList.toggle('hidden', !show);
  }

  function setMsg(text, isError) {
    els.msg.textContent = text || '';
    els.msg.classList.toggle('hidden', !text);
    els.msg.classList.toggle('error', !!isError);
  }

  function renderMathInline(node) {
    if (!node) return;
    node.querySelectorAll('.math').forEach(function (el) {
      var tex = el.getAttribute('data-tex');
      if (window.katex && tex) {
        try { el.innerHTML = window.katex.renderToString(tex, { throwOnError: false, displayMode: false }); } catch (e) { /* keep */ }
      }
    });
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function renderDash() {
    var snap = state.snapshot;
    if (!snap) return;
    var doneUnits = snap.units.filter(function (u) { return u.status === 'passed'; }).length;
    var score = snap.units.length ? Math.round((doneUnits / snap.units.length) * 100) : 0;
    var profile = state.profile || {};
    var html = '';
    html += '<div class="course-overall">';
    html += '<div class="course-progress-bar"><div class="course-progress-fill" style="width:' + score + '%"></div></div>';
    html += '<p class="course-overall-label">تقدم الدورة: ' + doneUnits + ' من ' + snap.units.length + ' وحدات ناجحة (' + score + '%)</p>';
    if (profile.overall_level) html += '<p class="course-level">المستوى العام: <strong>' + esc(profile.overall_level) + '</strong></p>';
    if ((profile.strengths || []).length) html += '<p class="course-chip-row">نقاط قوة: ' + (profile.strengths || []).map(function (s) { return '<span class="chip chip-good">' + esc(s) + '</span>'; }).join(' ') + '</p>';
    if ((profile.weaknesses || []).length) html += '<p class="course-chip-row">نقاط ضعف: ' + (profile.weaknesses || []).map(function (s) { return '<span class="chip chip-warn">' + esc(s) + '</span>'; }).join(' ') + '</p>';
    html += '</div>';
    html += '<div class="course-units">';
    snap.units.forEach(function (u) {
      var icon = u.status === 'passed' ? '✔' : u.status === 'locked' ? '🔒' : '▶';
      html += '<div class="course-unit-card ' + (u.status === 'locked' ? 'locked' : '') + '">';
      html += '<div class="course-unit-head"><span class="course-unit-icon">' + icon + '</span>';
      html += '<div><h3>' + esc(u.title) + '</h3><p>' + esc(u.description || '') + '</p></div></div>';
      html += '<div class="course-lessons">';
      u.lessons.forEach(function (l) {
        var licon = l.status === 'passed' ? '✔' : l.status === 'exam_ready' ? '✍' : (l.status === 'open' ? '▶' : '🔒');
        var doneEl = l.elements.filter(function (e) { return e.status === 'completed'; }).length;
        html += '<div class="course-lesson ' + (l.status === 'locked' ? 'locked' : '') + '" data-lesson="' + esc(l.id) + '" data-locked="' + (l.status === 'locked') + '" data-exam-ready="' + (l.status === 'exam_ready' || l.status === 'passed') + '">';
        html += '<span class="course-lesson-icon">' + licon + '</span>';
        html += '<div class="course-lesson-body"><strong>' + esc(l.title) + '</strong>';
        html += '<div class="course-elements">';
        l.elements.forEach(function (e) {
          var eic = e.status === 'completed' ? '✔' : e.status === 'open' ? '◌' : '•';
          html += '<span class="course-dot ' + e.status + '" data-element="' + esc(e.id) + '">' + eic + ' ' + esc(e.title) + '</span>';
        });
        html += '</div>';
        html += '</div>';
        if (l.exam && l.exam.status === 'available') {
          html += '<button class="btn-exam" data-exam="lesson:' + esc(l.id) + '">' + (l.status === 'passed' ? 'إعادة إمتحان الدرس' : 'إمتحان الدرس') + '</button>';
        }
        html += '</div>';
      });
      html += '</div>';
      if (u.unit_exam.status === 'available') {
        html += '<button class="btn-exam btn-unit-exam" data-exam="unit:' + esc(u.id) + '">' + (u.status === 'passed' ? 'إعادة إختبار الوحدة' : 'إختبار الوحدة') + '</button>';
      }
      html += '</div>';
    });
    if (snap.final_exam.status === 'available') {
      html += '<button class="btn-exam btn-final" data-exam="final:final">الإمتحان الشامل</button>';
    }
    html += '</div>';
    els.dashboard.innerHTML = html;

    els.dashboard.querySelectorAll('[data-exam]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var parts = btn.getAttribute('data-exam').split(':');
        startExam(parts[0], parts[1]);
      });
    });
    els.dashboard.querySelectorAll('[data-lesson]').forEach(function (row) {
      row.addEventListener('click', function (ev) {
        if (ev.target.closest('[data-exam]') || ev.target.closest('[data-element]')) return;
        if (row.getAttribute('data-locked') === 'true') { setMsg('أكمل ما قبل هذا الدرس أولاً.', true); return; }
        openLesson(row.getAttribute('data-lesson'));
      });
    });
    els.dashboard.querySelectorAll('[data-element]').forEach(function (dot) {
      dot.addEventListener('click', function () {
        var stateEl = dot.getAttribute('data-element');
        openElement(stateEl);
      });
    });
  }

  function findLesson(lessonId) {
    var snap = state.snapshot;
    if (!snap) return null;
    for (var i = 0; i < snap.units.length; i++) {
      for (var j = 0; j < snap.units[i].lessons.length; j++) {
        if (snap.units[i].lessons[j].id === lessonId) return snap.units[i].lessons[j];
      }
    }
    return null;
  }

  function openLesson(lessonId) {
    var lesson = findLesson(lessonId);
    if (!lesson) return;
    var first = null;
    for (var i = 0; i < lesson.elements.length; i++) {
      if (lesson.elements[i].status === 'open' || lesson.elements[i].status === 'completed') { first = lesson.elements[i]; break; }
    }
    if (!first) { setMsg('لا يوجد عنصر متاح.'); return; }
    openElement(first.id, lessonId);
  }

  function openElement(elementId, lessonId) {
    setMsg('');
    return api('/api/course/progress').then(function (data) {
      state.snapshot = data.snapshot;
      state.profile = data.profile;
      var lesson = lessonId || findLessonForElement(elementId, data.snapshot);
      renderElement(elementId, lesson, data);
    }).catch(function (err) { setMsg(err.message, true); });
  }

  function findLessonForElement(elementId, snap) {
    for (var i = 0; i < snap.units.length; i++) {
      for (var j = 0; j < snap.units[i].lessons.length; j++) {
        var l = snap.units[i].lessons[j];
        if (l.elements.some(function (e) { return e.id === elementId; })) return l;
      }
    }
    return null;
  }

  function renderElement(elementId, lessonInfo, data) {
    var lesson = lessonInfo && typeof lessonInfo === 'object' ? lessonInfo : (lessonInfo ? findLesson(lessonInfo) : null);
    state.element = { elementId: elementId, lessonId: lesson ? lesson.id : null };
    show('course-dashboard', false);
    show('course-exam-view', false);
    show('course-result-view', false);
    show('course-lesson-view', true);

    var lsnap = lesson || {};
    els.breadcrumb.innerHTML = '<span>' + esc(lsnap.title || 'درس') + ' — ' + esc(lsnap.elements ? lsnap.elements.length : '') + ' عناصر</span>';

    fetch('course/course.json').then(function (r) { return r.json(); }).then(function (course) {
      var found = null;
      course.units.forEach(function (u) { u.lessons.forEach(function (l) { l.elements.forEach(function (e) {
        if (e.id === elementId) found = { course: course, unit: u, lesson: l, elem: e, index: l.elements.indexOf(e) };
      }); }); });
      if (!found) { setMsg('عنصر غير موجود.', true); return; }
      renderElementBody(found);
    });
  }

  function renderElementBody(found) {
    var e = found.elem;
    var lesson = found.lesson;
    var hasWeakness = (state.profile && state.profile.weaknesses || []).some(function (s) { return (e.skills || []).indexOf(s) >= 0; });

    var html = '';
    html += '<h2>' + esc(e.title) + '</h2>';
    html += '<p class="course-element-position">' + (found.index + 1) + ' / ' + found.lesson.elements.length + '</p>';
    html += '<div class="course-box course-explanation">' + esc(e.explanation) + '</div>';
    if ((e.formulas || []).length) {
      html += '<div class="course-box course-formulas">';
      e.formulas.forEach(function (f) { html += '<div class="math" data-tex="' + esc(f) + '">' + esc(f) + '</div>'; });
      html += '</div>';
    }
    var examples = (lesson.examples || []).concat(e.examples || []);
    if (examples.length) {
      html += '<div class="course-box"><h3>أمثلة</h3>';
      examples.forEach(function (ex) {
        html += '<div class="course-example"><strong>' + esc(ex.title) + '</strong><p>' + esc(ex.body) + '</p></div>';
      });
      html += '</div>';
    }

    var isLast = found.index === found.lesson.elements.length - 1;
    var currentLesson = state.snapshot && findLessonForElement(e.id, state.snapshot);
    var alreadyDone = currentLesson && currentLesson.elements.some(function (el) { return el.id === e.id && el.status === 'completed'; });
    els.element.innerHTML = html;
    renderMathInline(els.element);

    els.elementActions.innerHTML = '';
    if (!isLast) {
      var btnNext = document.createElement('button');
      btnNext.className = 'btn-primary';
      btnNext.textContent = alreadyDone ? 'العنصر التالي' : 'أتممت العنصر؟ (التالي)';
      btnNext.addEventListener('click', function () { completeAndAdvance(e.id, found.lesson.id, found.index); });
      els.elementActions.appendChild(btnNext);
    } else {
      var btnExam = document.createElement('button');
      btnExam.className = 'btn-primary';
      btnExam.textContent = alreadyDone ? 'إلى إمتحان الدرس' : 'أتممت العنصر؟ (إلى الإمتحان)';
      btnExam.addEventListener('click', function () { completeAndStartExam(e.id, found.lesson.id); });
      els.elementActions.appendChild(btnExam);
    }

    if (hasWeakness && !alreadyDone) {
      els.adaptCard.classList.remove('hidden');
      els.adaptCard.innerHTML = '<button id="course-adapt-btn" class="btn-link">اشرح لي بطريقة أبسط</button><div id="course-adapt-body" class="hidden"></div>';
      document.getElementById('course-adapt-btn').addEventListener('click', function () { loadAdapt(e.id); });
    } else {
      els.adaptCard.classList.add('hidden');
    }
  }

  function completeAndAdvance(elementId, lessonId, index) {
    api('/api/course/progress', { method: 'POST', body: { ref_type: 'element', ref_id: elementId } }).then(function (data) {
      state.snapshot = data.snapshot;
      state.profile = data.profile;
      var lesson = findLesson(lessonId);
      var nextEl = lesson && lesson.elements[index + 1];
      if (nextEl && nextEl.status === 'open') {
        renderElement(nextEl.id, lesson, data);
      } else {
        renderDash();
        show('course-lesson-view', false);
        show('course-dashboard', true);
      }
    }).catch(function (err) { setMsg(err.message, true); });
  }

  function completeAndStartExam(elementId, lessonId) {
    api('/api/course/progress', { method: 'POST', body: { ref_type: 'element', ref_id: elementId } })
      .then(function () { return startExam('lesson', lessonId); })
      .catch(function (err) { setMsg(err.message, true); });
  }

  function startExam(type, refId) {
    setMsg('');
    api('/api/course/exam?type=' + encodeURIComponent(type) + '&ref=' + encodeURIComponent(refId)).then(function (data) {
      state.exam = data;
      state.currentIndex = 0;
      state.answers = {};
      show('course-dashboard', false);
      show('course-lesson-view', false);
      show('course-result-view', false);
      show('course-exam-view', true);
      renderExamQuestion();
    }).catch(function (err) { setMsg(err.message, true); });
  }

  function renderExamQuestion() {
    var q = state.exam.questions[state.currentIndex];
    if (!q) return;
    els.examHead.innerHTML = '<p><strong>' + esc(state.exam.instructions.title) + '</strong> — السؤال ' + (state.currentIndex + 1) + ' من ' + state.exam.questions.length + ' — نسبة النجاح: ' + state.exam.pass_score + '%</p>';
    els.examQ.innerHTML = '<h3>' + esc(q.question) + '</h3><div class="course-options">' + q.options.map(function (opt, i) {
      var chosen = state.answers[q.question_id] === i;
      return '<label class="course-option ' + (chosen ? 'chosen' : '') + '"><input type="radio" name="course-ans" value="' + i + '" ' + (chosen ? 'checked' : '') + '> ' + esc(opt) + '</label>';
    }).join('') + '</div>';
    els.examQ.querySelectorAll('input[name=course-ans]').forEach(function (input) {
      input.addEventListener('change', function () {
        state.answers[q.question_id] = parseInt(input.value, 10);
        renderExamActions();
      });
    });
    els.examActions.innerHTML = '';
    if (state.currentIndex > 0) {
      var bPrev = document.createElement('button');
      bPrev.className = 'btn-secondary';
      bPrev.textContent = 'السابق';
      bPrev.addEventListener('click', function () { state.currentIndex--; renderExamQuestion(); });
      els.examActions.appendChild(bPrev);
    }
    var isAnswered = state.answers[q.question_id] !== undefined;
    var bNext = document.createElement('button');
    bNext.className = 'btn-primary';
    bNext.disabled = !isAnswered;
    bNext.textContent = state.currentIndex === state.exam.questions.length - 1 ? 'مراجعة وإرسال' : 'التالي';
    bNext.addEventListener('click', function () {
      if (state.currentIndex === state.exam.questions.length - 1) reviewExam();
      else { state.currentIndex++; renderExamQuestion(); }
    });
    els.examActions.appendChild(bNext);
  }

  function renderExamActions() { renderExamQuestion(); }

  function reviewExam() {
    var html = '<h3>مراجعة إجاباتك</h3><div class="course-options">';
    state.exam.questions.forEach(function (q, i) {
      var ans = state.answers[q.question_id];
      html += '<div class="course-review-row"><strong>' + (i + 1) + '-</strong> ' + esc(q.question) + '<br><em>' + (ans === undefined ? 'لم تُجب' : 'جوابك: ' + esc(q.options[ans])) + '</em></div>';
    });
    html += '</div><div class="course-actions"><button id="course-submit" class="btn-primary">تأكيد الإرسال</button><button id="course-back-review" class="btn-secondary">تعديل</button></div>';
    els.examQ.innerHTML = html;
    els.examActions.innerHTML = '';
    document.getElementById('course-submit').addEventListener('click', submitExam);
    document.getElementById('course-back-review').addEventListener('click', function () { state.currentIndex = 0; renderExamQuestion(); });
  }

  function submitExam() {
    var answers = Object.keys(state.answers).map(function (qid) {
      return { question_id: qid, selected_index: state.answers[qid], response_time_sec: 0 };
    });
    api('/api/course/exam/submit', { method: 'POST', body: { attempt_id: state.exam.attempt_id, answers: answers } })
      .then(function (data) {
        state.snapshot = data.snapshot;
        state.profile = { overall_mastery: data.result.overall_mastery, overall_level: data.result.overall_level, strengths: data.result.strengths, weaknesses: data.result.weaknesses, skills: {} };
        renderResult(data.result);
      })
      .catch(function (err) { setMsg(err.message, true); });
  }

  function renderResult(result) {
    show('course-exam-view', false);
    show('course-lesson-view', false);
    show('course-result-view', true);
    var pass = result.passed;
    var html = '';
    html += '<div class="course-result-box ' + (pass ? 'pass' : 'fail') + '">';
    html += '<h2>' + (pass ? 'ناجح!' : 'لم تنجح بعد') + '</h2>';
    html += '<p class="course-score">الدرجة: ' + result.score + '% (' + result.correct_count + '/' + result.total + ')</p>';
    html += '<p>حدود النجاح: ' + result.pass_score + '%</p>';
    html += '</div>';
    var skillsHtml = Object.keys(result.per_skill || {}).map(function (s) {
      var v = result.per_skill[s];
      return '<div class="course-skill-row"><span>' + esc(s) + '</span><div class="course-progress-bar small"><div class="course-progress-fill" style="width:' + Math.round(v.correct / v.total * 100) + '%"></div></div><span>' + v.correct + '/' + v.total + '</span></div>';
    }).join('');
    html += '<div class="course-box"><h3>أداء المهارات</h3>' + (skillsHtml || '<p>لا توجد بيانات</p>') + '</div>';
    html += '<div class="course-box"><h3>المستوى العام</h3><p><strong>' + esc(result.overall_level) + '</strong> — متوسط الإتقان ' + result.overall_mastery + '%</p></div>';
    if ((result.strengths || []).length) html += '<p class="course-chip-row">نقاط قوة: ' + result.strengths.map(function (s) { return '<span class="chip chip-good">' + esc(s) + '</span>'; }).join(' ') + '</p>';
    if ((result.weaknesses || []).length) html += '<p class="course-chip-row">نقاط ضعف: ' + result.weaknesses.map(function (s) { return '<span class="chip chip-warn">' + esc(s) + '</span>'; }).join(' ') + '</p>';

    html += '<div class="course-actions">';
    html += '<button id="course-result-dash" class="btn-primary">العودة للدورة</button>';
    if (!result.passed) {
      html += '<button id="course-result-retry" class="btn-secondary">إعادة الإمتحان</button>';
    }
    html += '</div>';
    els.result.innerHTML = html;

    document.getElementById('course-result-dash').addEventListener('click', function () {
      show('course-result-view', false); show('course-dashboard', true); renderDash();
    });
    var retry = document.getElementById('course-result-retry');
    if (retry) retry.addEventListener('click', function () {
      show('course-result-view', false);
      startExam(result.exam_type, result.exam_type === 'final' ? 'final' : result.ref_id);
    });
    if (result.passed && result.exam_type !== 'final') {
      var nextBtn = document.createElement('button');
      nextBtn.className = 'btn-primary';
      var lesson = findLesson(result.ref_id);
      var nextOpen = null;
      (state.snapshot && state.snapshot.units || []).forEach(function (u) { (u.lessons || []).forEach(function (l) {
        if (l.elements && l.elements.some(function (e) { return e.status === 'open'; }) && !nextOpen) nextOpen = l.id;
      }); });
      nextBtn.textContent = lesson && lesson.elements.some(function (e) { return e.status === 'completed'; }) ? 'المتابعة في الدروس' : 'متابعة الدروس';
      nextBtn.addEventListener('click', function () {
        show('course-result-view', false);
        if (nextOpen) openLesson(nextOpen);
        else { show('course-dashboard', true); renderDash(); }
      });
      els.result.appendChild(nextBtn);
    }
  }

  function loadAdapt(elementId) {
    api('/api/course/adapt', { method: 'POST', body: { lesson_id: state.element.lessonId, element_id: elementId } })
      .then(function (data) {
        var body = document.getElementById('course-adapt-body');
        body.classList.remove('hidden');
        body.innerHTML = '<div class="course-box course-adapt-box"><strong>شرح مبسّط</strong><p>' + esc(data.explanation) + '</p>' +
          (data.example ? '<strong>مثال إضافي</strong><p>' + esc(data.example) + '</p>' : '') + '</div>';
      })
      .catch(function (err) { setMsg(err.message, true); });
  }

  function loadProgress() {
    return api('/api/course/progress').then(function (data) {
      state.snapshot = data.snapshot;
      state.profile = data.profile;
      return data;
    });
  }

  function showTab(name) {
    var courseTab = name === 'course';
    show('course-tab', courseTab);
    var tCourse = document.getElementById('tab-course');
    var tSummaries = document.getElementById('tab-summaries');
    if (tCourse) tCourse.classList.toggle('active', courseTab);
    if (tSummaries) tSummaries.classList.toggle('active', !courseTab);
    if (courseTab) {
      show('home-view', false);
      show('reader-view', false);
      loadProgress().then(function () {
        renderDash();
        show('course-lesson-view', false);
        show('course-exam-view', false);
        show('course-result-view', false);
        show('course-dashboard', true);
      }).catch(function (err) {
        setMsg(err.message, true);
      });
    } else {
      show('home-view', true);
      show('reader-view', false);
    }
  }

  var tabsBound = false;
  function bindTabs() {
    if (tabsBound) return;
    tabsBound = true;
    els.tabCourse.addEventListener('click', function () { showTab('course'); });
    els.tabSummaries.addEventListener('click', function () { showTab('summaries'); });
    els.backLesson.addEventListener('click', function () {
      show('course-lesson-view', false); show('course-exam-view', false); show('course-result-view', false);
      show('course-dashboard', true); renderDash();
    });
  }

  function init() {
    bindTabs();
  }

  function isLoggedIn() {
    return !!(window.AppAuth && window.AppAuth.getUser());
  }

  window.CourseApp = {
    init: init,
    showTab: showTab,
    renderDash: renderDash,
    _state: state
  };
})();