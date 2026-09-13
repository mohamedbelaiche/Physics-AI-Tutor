/* adaptive.js — الدورة التكيفية: شجرة المحتوى، الاختبارات المصغّرة، تقييمات
   الدروس والوحدات، ولوحة التقدم. يعمل جنبًا إلى جنب مع app.js دون كسره. */
(function () {
  // ------------------------------------------------ state
  var course = null;
  var skills = null;
  var bank = [];
  var quizState = null; // { mode, questions, idx, selections, answers, startedAt }

  var courseView = document.getElementById('course-view');
  var dashboardView = document.getElementById('dashboard-view');

  var SKILL_COLOR = {
    critical: '#e03131',
    weak: '#f59f00',
    good: '#74b816',
    strength: '#2f9e44'
  };

  // ------------------------------------------------ helpers
  function getSessionToken() {
    if (!window.AppAuth || !window.AppAuth.getSession) return Promise.resolve('');
    return window.AppAuth.getSession().then(function (s) {
      return (s && s.access_token) || '';
    });
  }

  function isLoggedIn() {
    return !!(window.AppAuth && window.AppAuth.getUser());
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function el(tag, cls, html) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (html != null) node.innerHTML = html;
    return node;
  }

  function loadingBox(text) {
    return el('p', 'load-note', esc(text || 'جاري التحميل...'));
  }

  function showView(name) {
    var home = document.getElementById('home-view');
    var reader = document.getElementById('reader-view');
    if (home) home.classList.toggle('hidden', name !== 'home');
    if (reader) reader.classList.toggle('hidden', name !== 'reader');
    if (courseView) courseView.classList.toggle('hidden', name !== 'course');
    if (dashboardView) dashboardView.classList.toggle('hidden', name !== 'dashboard');
    setActiveNav(name);
    window.scrollTo(0, 0);
  }

  function setActiveNav(name) {
    var navBtns = document.querySelectorAll('[data-nav]');
    [].forEach.call(navBtns, function (b) {
      b.classList.toggle('active', b.getAttribute('data-nav') === name);
    });
  }

  function requireAuthThen(cb) {
    if (isLoggedIn()) {
      cb();
      return;
    }
    var btn = document.getElementById('auth-btn');
    if (btn && btn.click) btn.click();
    else if (window.AppAuth) window.AppAuth.openLogin && window.AppAuth.openLogin('login');
  }

  function api(url, options) {
    return getSessionToken().then(function (token) {
      return fetch(url, {
        method: (options && options.method) || 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token
        },
        body: options && options.body ? JSON.stringify(options.body) : undefined
      }).then(function (r) {
        return r.json().then(function (data) {
          return { ok: r.ok, status: r.status, data: data };
        });
      });
    });
  }

  // ------------------------------------------------ data loading
  function loadCourseData() {
    if (course) return Promise.resolve();
    return Promise.all([
      fetch('course/course.json').then(function (r) { return r.json(); }),
      fetch('course/skills.json').then(function (r) { return r.json(); }),
      fetch('course/questions.json').then(function (r) { return r.json(); })
    ]).then(function (res) {
      course = res[0];
      skills = res[1].skills || [];
      bank = (res[2].questions || res[2]) || [];
      return course;
    });
  }

  function questionsForSection(sectionId) {
    return bank.filter(function (q) { return q.section_id === sectionId; });
  }
  function questionsForLesson(lessonId) {
    return bank.filter(function (q) { return q.lesson_id === lessonId; });
  }
  function questionsForUnit(unitId) {
    return bank.filter(function (q) { return q.unit_id === unitId; });
  }

  function pickQuestions(source, count) {
    // Prefer easy→medium first, then shuffle picks to avoid repetition.
    var sorted = source.slice().sort(function (a, b) {
      return (a.difficulty || 1) - (b.difficulty || 1);
    });
    var out = sorted.slice(0, count);
    if (count > out.length) out = sorted;
    return out;
  }

  // ------------------------------------------------ course tree
  function renderCourse() {
    requireAuthThen(function () {
      showView('course');
      courseView.innerHTML = '';
      var header = el('div', 'course-header');
      header.appendChild(el('h2', '', esc(course.title || 'الدورة التعليمية')));
      if (course.description) header.appendChild(el('p', 'muted', esc(course.description)));
      courseView.appendChild(header);

      var grid = el('div', 'units-grid');
      course.units.forEach(function (unit) {
        grid.appendChild(unitCard(unit));
      });
      courseView.appendChild(grid);
    });
  }

  function unitCard(unit) {
    var card = el('div', 'unit-card');
    var head = el('div', 'unit-card-head');
    head.appendChild(el('span', 'unit-badge', esc(unit.title)));
    head.appendChild(el('h3', '', esc(unit.description || '')));
    card.appendChild(head);

    var list = el('ul', 'unit-lessons');
    unit.lessons.forEach(function (lesson) {
      var li = el('li');
      var a = el('a', 'lesson-link', esc(lesson.title));
      a.href = '#';
      a.addEventListener('click', function (e) {
        e.preventDefault();
        renderLesson(unit.id, lesson.id);
      });
      li.appendChild(a);
      list.appendChild(li);
    });
    card.appendChild(list);

    var actions = el('div', 'unit-card-actions');
    var btn = el('button', 'btn btn-outline', 'تقييم الوحدة');
    btn.addEventListener('click', function () {
      startUnitAssessment(unit.id);
    });
    actions.appendChild(btn);
    card.appendChild(actions);
    return card;
  }

  // ------------------------------------------------ lesson view
  function renderLesson(unitId, lessonId) {
    showView('course');
    var unit = findUnit(unitId);
    var lesson = unit && findLesson(unit, lessonId);
    if (!lesson) {
      courseView.innerHTML = '';
      courseView.appendChild(el('p', 'load-note', 'الدرس غير موجود.'));
      return;
    }

    courseView.innerHTML = '';
    var top = el('div', 'course-header lesson-top');
    var back = el('button', 'btn btn-ghost', '→ العودة إلى الوحدة');
    back.addEventListener('click', function () {
      showView('course');
      renderCourse();
    });
    top.appendChild(back);
    top.appendChild(el('h2', '', esc(lesson.title)));
    if (lesson.source) top.appendChild(el('p', 'muted', 'المصدر: ' + esc(lesson.source)));
    courseView.appendChild(top);

    var wrapper = el('div', 'lesson-body');
    lesson.sections.forEach(function (section) {
      wrapper.appendChild(sectionBlock(lesson, section));
    });

    // Lesson assessment button
    var assessCard = el('div', 'card lesson-assessment-card');
    assessCard.appendChild(el('h3', '', 'تقييم الدرس'));
    assessCard.appendChild(el('p', 'muted', 'اختبر فهمك للدرس كلّه باختبار موجز (8–15 سؤالًا).'));
    var btn = el('button', 'btn btn-primary', 'بدء تقييم الدرس');
    btn.addEventListener('click', function () {
      startLessonAssessment(lesson);
    });
    assessCard.appendChild(btn);
    wrapper.appendChild(assessCard);

    courseView.appendChild(wrapper);
  }

  function sectionBlock(lesson, section) {
    var block = el('div', 'card section-block');
    block.appendChild(el('h3', 'section-title', esc(section.title)));
    if (section.explanation) block.appendChild(el('p', '', esc(section.explanation)));

    var skillTags = (section.skills || []).map(function (s) {
      return el('span', 'skill-tag', esc(s));
    });
    if (skillTags.length) {
      var tags = el('div', 'skill-tags');
      skillTags.forEach(function (t) { tags.appendChild(t); });
      block.appendChild(tags);
    }

    // Show linked PDF if available (lesson source is md, but unit has summary_pdf).
    var quizBtn = el('button', 'btn btn-primary btn-sm', 'اختبار مصغّر');
    quizBtn.addEventListener('click', function () {
      startMicroQuiz(lesson, section);
    });
    block.appendChild(quizBtn);
    return block;
  }

  function findUnit(unitId) {
    return course.units.find(function (u) { return u.id === unitId; });
  }
  function findLesson(unit, lessonId) {
    return unit.lessons.find(function (l) { return l.id === lessonId; });
  }

  // ------------------------------------------------ quiz engine
  function quizContainer() {
    var host = document.createElement('div');
    host.className = 'quiz-host';
    courseView.appendChild(host);
    return host;
  }

  function startMicroQuiz(lesson, section) {
    var unit = course.units.find(function (u) {
      return u.lessons.some(function (l) { return l.id === lesson.id; });
    });
    var qs = questionsForSection(section.id);
    if (!qs.length) {
      var fallback = questionsForLesson(lesson.id).filter(function (q) {
        return (section.skills || []).indexOf(q.skill_id) !== -1;
      });
      qs = fallback;
    }
    qs = pickQuestions(qs, 3);
    if (!qs.length) {
      alert('لا توجد أسئلة لهذا القسم بعد.');
      return;
    }
    beginQuiz({
      mode: 'micro',
      questions: qs,
      unitId: unit ? unit.id : '',
      lessonId: lesson.id,
      sectionId: section.id
    });
  }

  function startLessonAssessment(lesson) {
    var unit = course.units.find(function (u) { return u.lessons.some(function (l) { return l.id === lesson.id; }); });
    var qs = pickQuestions(questionsForLesson(lesson.id), 12);
    if (qs.length < 8) {
      // pad with same-skill questions from the unit
      var extra = questionsForUnit(unit.id).filter(function (q) { return qs.indexOf(q) === -1 && (lesson.skills || []).indexOf(q.skill_id) !== -1; });
      qs = qs.concat(extra.slice(0, 12 - qs.length));
    }
    if (qs.length < 8) qs = pickQuestions(questionsForUnit(unit.id), 12);
    if (!qs.length) { alert('لا توجد أسئلة كافية لهذا الدرس بعد.'); return; }
    beginQuiz({ mode: 'lesson', questions: qs, unitId: unit.id, lessonId: lesson.id });
  }

  function startUnitAssessment(unitId) {
    var unit = findUnit(unitId);
    var qs = pickQuestions(questionsForUnit(unitId), 12);
    if (!qs.length) { alert('لا توجد أسئلة كافية لهذه الوحدة بعد.'); return; }
    beginQuiz({ mode: 'unit', questions: qs, unitId: unitId, lessonId: '' });
  }

  function renderQuizIntro(quiz) {
    var host = quizContainer();
    var modeLabel = { micro: 'اختبار مصغّر', lesson: 'تقييم الدرس', unit: 'تقييم الوحدة' }[quiz.mode];
    var card = el('div', 'card quiz-intro');
    card.appendChild(el('h3', '', esc(modeLabel)));
    card.appendChild(el('p', 'muted', 'عدد الأسئلة: ' + quiz.questions.length + (quiz.mode === 'micro' ? ' • التصحيح فوري مع شرح' : ' • أجب على جميع الأسئلة ثم أرسل')));
    var startBtn = el('button', 'btn btn-primary', 'ابدأ الآن');
    startBtn.addEventListener('click', function () {
      renderQuizQuestion(quiz, 0);
    });
    card.appendChild(startBtn);
    host.appendChild(card);
    return host;
  }

  function beginQuiz(cfg) {
    quizState = {
      mode: cfg.mode,
      questions: cfg.questions,
      idx: 0,
      selections: {},
      startedAt: new Date().toISOString()
    };
    renderQuizIntro(quizState);
  }

  function renderQuizQuestion(quiz, idx) {
    var host = quizContainer();
    host.innerHTML = '';
    var q = quiz.questions[idx];
    var page = el('div', 'card quiz-page');
    page.appendChild(el('div', 'quiz-progress', 'السؤال ' + (idx + 1) + ' / ' + quiz.questions.length));
    page.appendChild(el('h3', 'quiz-question', esc(q.question)));

    var opts = el('div', 'quiz-options');
    var selected = quiz.selections[q.id];
    q.choices.forEach(function (choice, ci) {
      var label = el('label', 'quiz-option' + (selected === ci ? ' selected' : ''));
      var radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = 'q_' + q.id;
      radio.value = ci;
      if (selected === ci) radio.checked = true;
      radio.addEventListener('change', function () {
        quiz.selections[q.id] = ci;
        highlightSelection(q.id, ci);
      });
      label.appendChild(radio);
      label.appendChild(el('span', '', esc(choice)));
      opts.appendChild(label);
    });
    page.appendChild(opts);

    // Formative mode: immediate check button per question.
    if (quiz.mode === 'micro') {
      var check = el('button', 'btn btn-primary', 'تحقق');
      check.addEventListener('click', function () {
        var chosen = quiz.selections[q.id];
        if (chosen == null) {
          alert('اختر إجابة أولاً.');
          return;
        }
        showMicroFeedback(quiz, idx);
      });
      page.appendChild(check);
    } else {
      var next = el('button', 'btn btn-primary', idx < quiz.questions.length - 1 ? 'التالي' : 'إنهاء وإرسال');
      next.addEventListener('click', function () {
        if (idx < quiz.questions.length - 1) {
          quiz.idx = idx + 1;
          renderQuizQuestion(quiz, idx + 1);
        } else {
          submitQuiz(quiz);
        }
      });
      page.appendChild(next);
    }

    host.appendChild(page);
  }

  function highlightSelection(qid, ci) {
    var host = courseView.querySelector('.quiz-host');
    if (!host) return;
    [].forEach.call(host.querySelectorAll('.quiz-option'), function (opt) {
      opt.classList.toggle('selected', opt.querySelector('input').value === String(ci));
    });
    quizState.selections[qid] = ci;
  }

  function showMicroFeedback(quiz, idx) {
    var q = quiz.questions[idx];
    var chosen = quiz.selections[q.id];
    var isCorrect = chosen === q.correct_index;
    var host = courseView.querySelector('.quiz-host .quiz-page');
    if (!host) return;

    [].forEach.call(host.querySelectorAll('.quiz-option'), function (opt) {
      var v = parseInt(opt.querySelector('input').value, 10);
      if (v === q.correct_index) opt.classList.add('correct');
      else if (v === chosen) opt.classList.add('wrong');
    });

    var feedback = el('div', 'quiz-feedback ' + (isCorrect ? 'good' : 'bad'));
    feedback.appendChild(el('div', 'quiz-feedback-headline', isCorrect ? 'إجابة صحيحة' : 'إجابة خاطئة'));
    feedback.appendChild(el('p', '', esc(q.explanation)));
    if (!isCorrect && q.common_misconception) {
      feedback.appendChild(el('p', 'misconception', 'فكرة خاطئة شائعة: ' + esc(q.common_misconception)));
    }
    host.appendChild(feedback);

    // log the answered question
    quiz.answers = quiz.answers || [];
    quiz.answers.push({ question_id: q.id, selected_index: chosen, time_spent_seconds: null, answered_at: new Date().toISOString() });

    var next = el('button', 'btn btn-primary', idx < quiz.questions.length - 1 ? 'السؤال التالي' : 'إنهاء');
    next.addEventListener('click', function () {
      if (idx < quiz.questions.length - 1) renderQuizQuestion(quiz, idx + 1);
      else submitQuiz(quiz);
    });
    host.appendChild(next);
  }

  // ------------------------------------------------ submission
  function submitQuiz(quiz) {
    var answers = quiz.answers || [];
    if (quiz.mode !== 'micro') {
      quiz.questions.forEach(function (q) {
        var chosen = quiz.selections[q.id];
        if (chosen == null) return;
        answers.push({ question_id: q.id, selected_index: chosen, time_spent_seconds: null, answered_at: new Date().toISOString() });
      });
    }

    var host = courseView.querySelector('.quiz-host');
    if (!host) host = quizContainer();
    host.innerHTML = '';
    host.appendChild(el('p', 'load-note', 'جاري تصحيح الإجابات وحساب مستواك...'));

    var body = {
      type: quiz.mode,
      unit_id: quiz.unitId,
      lesson_id: quiz.lessonId || '',
      section_id: quiz.sectionId || '',
      started_at: quiz.startedAt,
      duration_seconds: Math.round((Date.now() - Date.parse(quiz.startedAt)) / 1000),
      answers: answers
    };

    api('/api/quiz', { method: 'POST', body: body })
      .then(function (res) {
        if (!res.ok) {
          host.innerHTML = '';
          host.appendChild(el('p', 'load-note', 'تعذر إرسال النتائج: ' + (res.data && res.data.error || 'خطأ')));
          return;
        }
        renderQuizResult(host, res.data);
      })
      .catch(function (err) {
        host.innerHTML = '';
        host.appendChild(el('p', 'load-note', 'خطأ في الاتصال: ' + err.message));
      });
  }

  function renderQuizResult(host, result) {
    host.innerHTML = '';
    var card = el('div', 'card quiz-result');
    card.appendChild(el('h3', '', 'انتهى التقييم'));
    card.appendChild(el('p', 'result-score', 'النقطة: ' + result.score + ' / 100'));
    card.appendChild(el('p', 'muted', 'المستوى العام: ' + esc(result.level_label || result.level) + ' — إتقان ' + result.score + '%'));
    var nextAction = result.next_action || {};
    card.appendChild(el('div', 'next-action', 'الخطوة التالية المقترحة: ' + esc(nextAction.reason || 'تابع')));
    if (result.weaknesses && result.weaknesses.length) {
      var w = el('div', 'result-section');
      w.appendChild(el('h4', '', 'نقاط ضعف'));
      result.weaknesses.forEach(function (s) { w.appendChild(el('p', '', '• ' + esc(s))); });
      card.appendChild(w);
    }
    if (result.misconceptions && result.misconceptions.length) {
      var m = el('div', 'result-section');
      m.appendChild(el('h4', '', 'مفاهيم خاطئة يتم تصحيحها'));
      result.misconceptions.forEach(function (x) {
        m.appendChild(el('p', '', '• ' + esc(x.skill_id) + ': ' + esc(x.misconception)));
      });
      card.appendChild(m);
    }
    var again = el('button', 'btn btn-outline', 'إعادة المحاولة');
    again.addEventListener('click', function () {
      beginQuiz({ mode: quizState.mode, questions: quizState.questions, unitId: quizState.unitId, lessonId: quizState.lessonId });
    });
    card.appendChild(again);
    host.appendChild(card);
  }

  // ------------------------------------------------ dashboard
  function renderDashboard() {
    requireAuthThen(function () {
      showView('dashboard');
      dashboardView.innerHTML = '';
      dashboardView.appendChild(loadingBox('جاري تحميل التقدم...'));
      Promise.all([
        api('/api/skills'),
        api('/api/progress')
      ]).then(function (res) {
        dashboardView.innerHTML = '';
        drawDashboard(res[0].data, res[1].data);
      }).catch(function (err) {
        dashboardView.innerHTML = '';
        dashboardView.appendChild(el('p', 'load-note', 'تعذر تحميل البيانات: ' + err.message));
      });
    });
  }

  function drawDashboard(skillsData, progressData) {
    var profile = skillsData.learning_profile;
    var skillRows = skillsData.skills || [];
    var taxonomy = skillsData.taxonomy || {};
    var stat = progressData.stats || {};

    var card = el('div', 'card');
    card.appendChild(el('h3', '', 'مستواك العام'));
    if (profile) {
      var level = profile.overall_level || 'beginner';
      var levelNames = {
        beginner: 'مبتدئ', elementary: 'ابتدائي', intermediate: 'متوسط',
        good: 'جيّد', advanced: 'متقدم', mastery: 'إتقان'
      };
      card.appendChild(el('p', 'level-name', 'المستوى: ' + esc(levelNames[level] || level)));
      card.appendChild(masteryBar('الإتقان العام', Number(profile.overall_mastery) || 0));
    } else {
      card.appendChild(el('p', 'muted', 'لم تجرِ أي تقييم بعد. ابدأ الدورة التعليمية لإظهار تقدمك.'));
    }
    if (profile && profile.next_action && profile.next_action.reason) {
      card.appendChild(el('div', 'next-action', 'الخطوة التالية: ' + esc(profile.next_action.reason)));
    }
    dashboardView.appendChild(card);

    var stats = el('div', 'stats-grid');
    stats.appendChild(statChip('أقسام مكتملة', stat.sections_completed || 0));
    stats.appendChild(statChip('دروس مكتملة', stat.lessons_completed || 0));
    stats.appendChild(statChip('تقييمات أجريت', stat.assessments_completed || 0));
    stats.appendChild(statChip('أسئلة أجابت عليها', stat.questions_answered || 0));
    dashboardView.appendChild(stats);

    // Skill map
    if (skillRows.length) {
      var mapCard = el('div', 'card');
      mapCard.appendChild(el('h3', '', 'خريطة المهارات'));
      var grid = el('div', 'skill-map');
      skillRows.forEach(function (row) {
        var color = SKILL_COLOR[row.status] || '#868e96';
        var bar = el('div', 'skill-map-item');
        bar.style.borderColor = color;
        bar.appendChild(el('span', 'skill-map-name', esc(row.skill)));
        bar.appendChild(masteryBar(row.skill, Number(row.score) || 0, color));
        bar.appendChild(el('span', 'skill-map-conf', 'ثقة: ' + Math.round((Number(row.confidence) || 0) * 100) + '%'));
        grid.appendChild(bar);
      });
      mapCard.appendChild(grid);
      dashboardView.appendChild(mapCard);
    }

    // Weaknesses recommendations
    var recs = (profile && profile.weaknesses) || [];
    if (recs.length) {
      var recCard = el('div', 'card');
      recCard.appendChild(el('h3', '', 'توصيات التركيز'));
      recs.forEach(function (s) { recCard.appendChild(el('p', '', '• ' + esc(s))); });
      dashboardView.appendChild(recCard);
    }
  }

  function statChip(label, value) {
    var chip = el('div', 'stat-chip');
    chip.appendChild(el('span', 'stat-value', String(value)));
    chip.appendChild(el('span', 'stat-label', esc(label)));
    return chip;
  }

  function masteryBar(label, value, color) {
    var wrap = el('div', 'mastery-wrap');
    var bar = el('div', 'mastery-bar');
    var fill = el('div', 'mastery-fill');
    fill.style.width = Math.max(0, Math.min(100, value)) + '%';
    if (color) fill.style.background = color;
    bar.appendChild(fill);
    wrap.appendChild(bar);
    wrap.appendChild(el('span', 'mastery-value', Math.round(value) + '%'));
    return wrap;
  }

  // ------------------------------------------------ nav wiring
  function initNav() {
    var nav = document.getElementById('top-nav');
    if (!nav) return;
    var btns = nav.querySelectorAll('[data-nav]');
    [].forEach.call(btns, function (b) {
      b.addEventListener('click', function () {
        var target = b.getAttribute('data-nav');
        if (target === 'course') renderCourse();
        else if (target === 'dashboard') renderDashboard();
        else if (target === 'home') showView('home');
        else if (target === 'reader') showView('reader');
      });
    });
  }

  // ------------------------------------------------ boot
  function boot() {
    initNav();
    loadCourseData().then(function () {
      // nothing rendered until user clicks; keep home working as-is.
    }).catch(function (err) {
      console.warn('course data failed to load:', err);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  window.AppAdaptive = {
    renderCourse: renderCourse,
    renderDashboard: renderDashboard,
    showView: showView,
    isLoggedIn: isLoggedIn
  };
})();