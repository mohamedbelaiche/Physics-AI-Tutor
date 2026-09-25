(function () {
  'use strict';

  var courseData = null;
  var progress = null;
  var currentCourseId = null;
  var currentSectionIdx = 0;

  var summariesGroup = document.getElementById('summaries-group');
  var coursesGroup = document.getElementById('courses-group');
  var tabSummaries = document.getElementById('tab-summaries');
  var tabCourses = document.getElementById('tab-courses');
  var dashView = document.getElementById('course-dashboard-view');
  var lessonView = document.getElementById('course-lesson-view');
  var cardsContainer = document.getElementById('course-cards');
  var overallWrap = document.getElementById('course-overall-wrap');
  var overallCount = document.getElementById('course-overall-count');
  var overallFill = document.getElementById('course-overall-fill');
  var courseGate = document.getElementById('course-gate');
  var backBtn = document.getElementById('course-lesson-back');
  var lessonHead = document.getElementById('course-lesson-head');
  var lessonBody = document.getElementById('course-lesson-body');
  var lessonNav = document.getElementById('course-lesson-nav');
  var modeSwitch = document.getElementById('course-lesson-mode');
  var lessonPresentationControls = document.getElementById('lesson-presentation-controls');
  var modeTextBtn = document.getElementById('mode-text');
  var modeSlidesBtn = document.getElementById('mode-slides');
  var slidesFullscreenBtn = document.getElementById('slides-fullscreen-btn');
  var slidesView = document.getElementById('slides-view');
  var currentMode = 'text';
  var sectionsBar = document.getElementById('course-sections-bar');
  var currentSlideIdx = 0;   // فهرس شريحة المقطع الحالي (لحفظ موقع الاستئناف)
  var pendingSlide = null;   // شريحة البداية عند فتح الكورس (الاستئناف)
  var lastServerPosTs = 0;   // تخفيف طلبات الخادم عند حفظ الموقع
  var POS_STORAGE_KEY = 'course_positions.v1';

  function isLoggedIn() {
    return !!(window.AppAuth && window.AppAuth.getUser());
  }

  function getToken() {
    return window.AppAuth.getSession().then(function (session) {
      return session && session.access_token ? session.access_token : '';
    });
  }

  function escapeHtml(text) {
    return String(text == null ? '' : text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ---------- مفاتيح المقاطع وتسجيل الأجزاء ---------- */

  // مفتاح مقطع ثابت (num) يطابق ما يتوقعه الخادم.
  function sectionKey(section) {
    return String(section && section.num != null ? section.num : (section.title || ''));
  }

  // جزء الإتمام حسب الوضع: «text» للنص، «slides.complete» للشرائح.
  function currentPartKey() {
    return currentMode === 'slides' ? 'slides.complete' : 'text';
  }

  // يسجّل إتمام جزء عند الخادم (بدون حظر). الزائر بدون حساب لا يسجّل شيئًا.
  function postPart(course, sectionIdx, partKey) {
    if (!course || !course.sections[sectionIdx]) return Promise.resolve();
    markLocalProgress(course, sectionIdx, partKey);
    if (!isLoggedIn()) return Promise.resolve();
    return getToken().then(function (token) {
      return fetch('/api/course/progress', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token
        },
        body: JSON.stringify({
          course_id: course.id,
          section_id: sectionKey(course.sections[sectionIdx]),
          part_key: partKey
        })
      });
    }).catch(function () { /* التقدم ثانوي — نفشل بصمت */ });
  }

  // تحديث متفائل محلي: يعلّم المقطع مكتملًا ويسجّل الجزء في شريط الأقسام فورًا.
  function markLocalProgress(course, sectionIdx, partKey) {
    if (!progress || !progress.courses) return;
    var rec = progress.courses.find(function (c) { return c.id === course.id; });
    if (!rec || !rec.sections[sectionIdx]) return;
    var sec = rec.sections[sectionIdx];
    if (partKey === 'text' || partKey === 'slides.complete') sec.completed = true;
    var has = (sec.parts || []).some(function (p) { return p.key === partKey; });
    if (!has) sec.parts.push({ key: partKey, completed: true });
  }

  /* ---------- موقع الاستئناف (خادم للمسجّل + localStorage للزوار) ---------- */

  function readLocalPositions() {
    try {
      return JSON.parse(localStorage.getItem(POS_STORAGE_KEY) || '{}');
    } catch (e) { return {}; }
  }

  // موقع محفوظ للكورس: من الخادم للمسجّل، وإلا من localStorage للزوار.
  function storedPosition(course) {
    if (course && progress && progress.positions && progress.positions[course.id]) {
      return progress.positions[course.id];
    }
    return course ? (readLocalPositions()[course.id] || null) : null;
  }

  function buildPosition(course) {
    var secIdx = currentSectionIdx;
    var slIdx = 0;
    if (currentMode === 'slides' && window.SlidesPlayer && window.SlidesPlayer.getPos) {
      var p = window.SlidesPlayer.getPos();
      secIdx = p.sectionIdx != null ? p.sectionIdx : secIdx;
      slIdx = p.slideIdx != null ? p.slideIdx : 0;
    }
    var section = course.sections[secIdx];
    return {
      course_id: course.id,
      section_id: section ? sectionKey(section) : '',
      slide_index: slIdx,
      mode: currentMode
    };
  }

  // يحفظ الموقع محليًا دائمًا، وللمسجّل يرسله للخادم (مخفّفًا كل ثانيتين).
  // force: تجاوز التخفيف لتصحيح حالة يجب أن تصل الخادم فورًا (مثل الرجوع من الشرائح).
  function savePosition(force) {
    var course = getCourse(currentCourseId);
    if (!course || !course.sections.length) return;
    var pos = buildPosition(course);
    var local = readLocalPositions();
    local[course.id] = { section_id: pos.section_id, slide_index: pos.slide_index, mode: pos.mode };
    try { localStorage.setItem(POS_STORAGE_KEY, JSON.stringify(local)); } catch (e) {}
    if (!isLoggedIn() || !pos.section_id) return;
    var now = Date.now();
    if (!force && now - lastServerPosTs < 2000) return;
    lastServerPosTs = now;
    postPosition(pos);
  }

  function postPosition(pos) {
    getToken().then(function (token) {
      if (!token) return;
      return fetch('/api/course/progress', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token
        },
        body: JSON.stringify({
          course_id: pos.course_id,
          section_id: pos.section_id,
          position: { section_id: pos.section_id, slide_index: pos.slide_index, mode: pos.mode }
        })
      });
    }).catch(function () { /* الموقع ثانوي — نفشل بصمت */ });
  }

  /* ---------- التبويبات ---------- */

  function setTab(active) {
    var showCourses = active === 'courses';
    // مغادرة تبويب الكورسات تُنهي ملء الشاشة فقط: نُبقي وضع الشرائح وموضعه عند العودة.
    if (!showCourses) {
      exitLessonFullscreen().catch(function () {
        showLessonNote('تعذر إنهاء ملء الشاشة.', 'error');
      });
    }
    tabSummaries.classList.toggle('active', !showCourses);
    tabCourses.classList.toggle('active', showCourses);
    summariesGroup.classList.toggle('hidden', showCourses);
    coursesGroup.classList.toggle('hidden', !showCourses);
    window.scrollTo(0, 0);
    if (showCourses) renderDashboard();
  }

  tabSummaries.addEventListener('click', function () { setTab('summaries'); });
  tabCourses.addEventListener('click', function () { setTab('courses'); });

  /* ---------- عرض المحتوى (Markdown + KaTeX) ---------- */

  function renderMath(tex, isDisplay) {
    try {
      return window.katex.renderToString(tex, { throwOnError: false, displayMode: !!isDisplay });
    } catch (err) {
      return (isDisplay ? '$$' : '\\(') + tex + (isDisplay ? '$$' : '\\)');
    }
  }

  function renderMarkdownContent(md) {
    if (typeof md !== 'string' || !md) return '';
    var math = [];
    function protect(re, isDisplay) {
      md = md.replace(re, function (match, tex) {
        var token = '\u0001KX' + math.length + '\u0001';
        math.push(renderMath(tex, isDisplay));
        return token;
      });
    }
    // العرض أولاً ثم السطر الواحد، حتى لا يلتقط $ النصي بقايا صيغ العرض.
    protect(/\$\$([\s\S]+?)\$\$/g, true);
    protect(/\\\[([\s\S]+?)\\\]/g, true);
    protect(/\\\(([\s\S]+?)\\\)/g, false);
    protect(/\$([\s\S]+?)\$/g, false);

    var html;
    if (window.marked && typeof window.marked.parse === 'function') {
      html = window.marked.parse(md, { gfm: true, breaks: true });
    } else {
      html = md.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\n/g, '<br>');
    }
    html = html.replace(/\u0001KX(\d+)\u0001/g, function (m, i) {
      return math[+i] || '';
    });
    return html;
  }

  /* ---------- تحميل البيانات ---------- */

  function loadCourseData() {
    return fetch('course/course.json')
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        courseData = data.courses || [];
      })
      .catch(function (err) {
        cardsContainer.innerHTML = '<p>تعذر تحميل ملف الكورسات: ' + escapeHtml(err.message) + '</p>';
      });
  }

  function loadProgress() {
    progress = null;
    if (!isLoggedIn()) return Promise.resolve();
    return getToken()
      .then(function (token) {
        return fetch('/api/course/progress', {
          headers: { Authorization: 'Bearer ' + token }
        });
      })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data && Array.isArray(data.courses)) progress = data;
      })
      .catch(function () { progress = null; });
  }

  /* ---------- لوحة الكورسات ---------- */

  function courseState(idx, course) {
    if (progress && progress.courses) {
      var rec = progress.courses.find(function (c) { return c.id === course.id; });
      if (rec && rec.completed) return 'completed';
    }
    // كل الكورسات مفتوحة — يمكن اجتياز المقاطع والأجزاء بأي ترتيب.
    return 'available';
  }

  function renderOverall() {
    if (!progress || !courseData.length) {
      overallWrap.classList.add('hidden');
      return;
    }
    var count = progress.completedCount || 0;
    var total = progress.total || courseData.length;
    var pct = total ? Math.round((count / total) * 100) : 0;
    overallCount.textContent = count + ' من ' + total + ' (٪' + pct + ')';
    overallFill.style.width = pct + '%';
    overallWrap.classList.remove('hidden');
  }

  function skillLabel(code) {
    var map = {
      sk_modelize: 'نمذجة',
      sk_apply_law: 'تطبيق قانون',
      sk_graph: 'رسم بياني',
      sk_protocol: 'بروتوكول',
      sk_justify: 'تعليل',
      sk_units: 'وحدات',
      sk_calculate: 'حساب'
    };
    return map[code] || code.replace(/^sk_/, '');
  }

  function buildCard(course, idx) {
    var card = document.createElement('div');
    var state = courseState(idx, course);
    card.className = 'course-card ' + state;

    var top = document.createElement('div');
    top.className = 'course-card-top';

    var order = document.createElement('span');
    order.className = 'course-order';
    order.textContent = 'الكورس ' + String(course.order || idx + 1);

    var stateLabel = document.createElement('span');
    stateLabel.className = 'course-state ' + state;
    if (state === 'completed') stateLabel.textContent = '✓ مكتمل';
    else if (state === 'available') stateLabel.textContent = 'متاح';
    else stateLabel.textContent = '🔒 مقفول';
    top.appendChild(order);
    top.appendChild(stateLabel);
    card.appendChild(top);

    var title = document.createElement('h3');
    title.textContent = course.title_ar;
    card.appendChild(title);

    if (course.description) {
      var desc = document.createElement('p');
      desc.className = 'course-desc';
      desc.textContent = course.description;
      card.appendChild(desc);
    }

    var meta = document.createElement('div');
    meta.className = 'course-meta';
    meta.appendChild(textSpan((course.sections || []).length + ' مقاطع'));
    (course.skills || []).slice(0, 4).forEach(function (sk) {
      var tag = document.createElement('span');
      tag.className = 'skill-tag';
      tag.textContent = skillLabel(sk);
      meta.appendChild(tag);
    });
    card.appendChild(meta);

    var cta = document.createElement('button');
    cta.className = 'course-cta';
    cta.setAttribute('type', 'button');
    if (state === 'completed') {
      cta.textContent = 'مراجعة الكورس';
    } else if (state === 'available') {
      cta.textContent = 'ابدأ الدرس';
    } else {
      cta.textContent = 'أتمم الكورس السابق';
      cta.disabled = true;
      card.setAttribute('role', 'note');
      card.setAttribute('aria-disabled', 'true');
      card.title = 'هذا الكورس مقفول حتى إتمام الكورس السابق';
    }
    card.appendChild(cta);

    var open = function () {
      openCourse(course, idx);
    };
    if (state !== 'locked') {
      cta.addEventListener('click', open);
      card.addEventListener('click', open);
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');
      card.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
      });
    } else {
      cta.addEventListener('click', function () {
        showDashboardNote('أتمم الكورس السابق أولاً ليُفتح هذا الكورس.', 'info');
      });
    }
    return card;
  }

  function textSpan(text) {
    var s = document.createElement('span');
    s.textContent = text;
    return s;
  }

  function renderDashboard() {
    if (!courseData) {
      cardsContainer.innerHTML = '<p>جاري تحميل الكورسات...</p>';
      return;
    }
    courseGate.classList.toggle('hidden', isLoggedIn());
    if (!isLoggedIn() && progress) progress = null;
    renderOverall();
    cardsContainer.innerHTML = '';
    displayNoteEl = null;
    courseData.forEach(function (course, idx) {
      cardsContainer.appendChild(buildCard(course, idx));
    });
  }

  var displayNoteEl = null;
  function showDashboardNote(msg, kind) {
    if (!displayNoteEl) {
      displayNoteEl = document.createElement('div');
      displayNoteEl.className = 'course-note ' + (kind || 'info');
      cardsContainer.insertBefore(displayNoteEl, cardsContainer.firstChild);
    }
    displayNoteEl.textContent = msg;
  }

  /* ---------- وضع الشرائح التفاعلية ---------- */

  function courseHasSlides(slug) {
    if (!window.SlidesPlayer) return Promise.resolve(false);
    return window.SlidesPlayer.loadDeck(slug).then(function (deck) {
      return deck ? true : false;
    });
  }

  function updateSlidesFullscreenUI() {
    if (!slidesFullscreenBtn) return;
    var active = document.fullscreenElement === lessonView;
    // اسم واحد ثابت + aria-pressed: القارئ الشاشةي يقرأ "ملء الشاشة: مضغوط/غير مضغوط".
    slidesFullscreenBtn.setAttribute('aria-pressed', active ? 'true' : 'false');
  }

  function exitLessonFullscreen() {
    if (document.fullscreenElement !== lessonView || typeof document.exitFullscreen !== 'function') {
      return Promise.resolve();
    }
    try {
      return Promise.resolve(document.exitFullscreen());
    } catch (err) {
      return Promise.reject(err);
    }
  }

  function leaveLessonSlides() {
    currentMode = 'text';
    currentSlideIdx = 0;
    pendingSlide = null;
    lessonBody.classList.remove('slides-mode');
    document.body.classList.remove('slides-focus');
    if (lessonPresentationControls) lessonPresentationControls.classList.add('hidden');
    if (slidesFullscreenBtn) slidesFullscreenBtn.classList.add('hidden');
    updateSlidesFullscreenUI();
    return exitLessonFullscreen().catch(function () {
      showLessonNote('تعذر إنهاء ملء الشاشة.', 'error');
    });
  }

  function toggleSlidesFullscreen() {
    if (!slidesFullscreenBtn || currentMode !== 'slides') return;
    var action;
    try {
      if (document.fullscreenElement === lessonView) {
        action = exitLessonFullscreen();
      } else if (supportsLessonFullscreen()) {
        action = lessonView.requestFullscreen();
      } else {
        showLessonNote('ملء الشاشة غير مدعوم في هذا المتصفح.', 'error');
        return;
      }
    } catch (err) {
      showLessonNote('تعذر تغيير ملء الشاشة.', 'error');
      return;
    }
    if (action && typeof action.catch === 'function') {
      action.catch(function () {
        showLessonNote('تعذر تغيير ملء الشاشة.', 'error');
      });
    }
  }

  function supportsLessonFullscreen() {
    return typeof lessonView.requestFullscreen === 'function' &&
      typeof document.exitFullscreen === 'function';
  }

  function setModeUI(available) {
    modeSwitch.classList.toggle('hidden', !available);
    if (lessonPresentationControls) {
      lessonPresentationControls.classList.toggle('hidden', !available);
    }
    var slides = currentMode === 'slides';
    modeTextBtn.classList.toggle('active', !slides);
    modeSlidesBtn.classList.toggle('active', slides);
    modeTextBtn.setAttribute('aria-selected', slides ? 'false' : 'true');
    modeSlidesBtn.setAttribute('aria-selected', slides ? 'true' : 'false');
    lessonBody.classList.toggle('slides-mode', slides);
    document.body.classList.toggle('slides-focus', slides && available);
    if (slidesFullscreenBtn) {
      slidesFullscreenBtn.classList.toggle(
        'hidden',
        !slides || !available || !supportsLessonFullscreen()
      );
    }
    updateSlidesFullscreenUI();
  }

  function switchMode(mode) {
    if (mode === currentMode) return;
    currentMode = mode;
    currentSlideIdx = 0;
    pendingSlide = 0;
    if (mode === 'text') {
      exitLessonFullscreen().catch(function () {
        showLessonNote('تعذر إنهاء ملء الشاشة.', 'error');
      });
      setModeUI(true);
      renderLesson();
      savePosition();
      return;
    }
    var courseId = currentCourseId;
    var course = getCourse(courseId);
    courseHasSlides(course && course.slug || '').then(function (available) {
      if (currentMode !== mode || currentCourseId !== courseId) return;
      if (!available) currentMode = 'text';
      setModeUI(available);
      renderLesson();
      savePosition();
    }).catch(function () {
      // فشل تحميل الـ deck: نعود للنص حتى لا يعلق مبدّل الوضع.
      if (currentCourseId !== courseId) return;
      currentMode = 'text';
      setModeUI(true);
      renderLesson();
      savePosition();
    });
  }

  modeTextBtn.addEventListener('click', function () { switchMode('text'); });
  modeSlidesBtn.addEventListener('click', function () { switchMode('slides'); });
  if (slidesFullscreenBtn) {
    slidesFullscreenBtn.addEventListener('click', toggleSlidesFullscreen);
  }
  document.addEventListener('fullscreenchange', updateSlidesFullscreenUI);
  document.addEventListener('fullscreenerror', function (event) {
    if (event.target && event.target !== lessonView) return;
    showLessonNote('تعذر تغيير ملء الشاشة.', 'error');
  });

  /* ---------- درس الكورس ---------- */

  function getCourse(id) {
    return (courseData || []).find(function (c) { return c.id === id; });
  }

  function openCourse(course, idx) {
    var state = courseState(idx, course);
    if (state === 'locked') return;
    currentCourseId = course.id;
    currentSectionIdx = 0;
    currentSlideIdx = 0;
    currentMode = 'text';
    pendingSlide = null;

    // استئناف من آخر موقع محفوظ (الخادم للمسجّل أو localStorage للزوار).
    var saved = storedPosition(course);
    if (saved) {
      var si = course.sections.findIndex(function (s) {
        return sectionKey(s) === String(saved.section_id || '');
      });
      if (si >= 0) currentSectionIdx = si;
      currentSlideIdx = Math.max(0, Number(saved.slide_index) || 0);
      pendingSlide = currentSlideIdx;
      if (saved.mode === 'slides') currentMode = 'slides';
    }

    setModeUI(false);
    courseHasSlides(course.slug).then(function (available) {
      if (currentCourseId !== course.id) return;
      if (!available && currentMode === 'slides') currentMode = 'text';
      setModeUI(available);
    });
    dashView.classList.add('hidden');
    lessonView.classList.remove('hidden');
    renderLesson();
    savePosition();
    window.scrollTo(0, 0);
  }

  backBtn.addEventListener('click', function () { showDashboard(); });

  function showDashboard() {
    leaveLessonSlides();
    dashView.classList.remove('hidden');
    lessonView.classList.add('hidden');
    currentCourseId = null;
    renderDashboard();
    window.scrollTo(0, 0);
  }

  function renderLesson() {
    var course = getCourse(currentCourseId);
    if (!course) return;
    var section = course.sections[currentSectionIdx];
    renderSectionsBar(course);

    lessonHead.innerHTML =
      '<span class="course-lesson-crumb">' + escapeHtml(course.title_ar) + '</span>' +
      '<h2 class="lesson-title">' + escapeHtml(section.title) + '</h2>' +
      '<span class="lesson-counter">الجزء ' + (currentSectionIdx + 1) + ' من ' + course.sections.length + '</span>';

    if (currentMode === 'slides' && window.SlidesPlayer) {
      var slug = course.slug;
      window.SlidesPlayer.loadDeck(slug).then(function (deck) {
        if (currentMode !== 'slides' || currentCourseId !== course.id) return;
        if (deck) {
          lessonBody.classList.add('slides-mode');
          var initial = pendingSlide;
          pendingSlide = 0;
          window.SlidesPlayer.playSection(lessonBody, slug, currentSectionIdx, initial);
          renderSectionsBar(course);
        } else {
          currentMode = 'text';
          pendingSlide = null;
          setModeUI(false);
          lessonBody.innerHTML = renderMarkdownContent(section.content_md);
          savePosition(true);
        }
      });
    } else {
      lessonBody.classList.remove('slides-mode');
      // لا يوجد مشغّل شرائح أصلًا: نصحّح الوضع المحفوظ حتى لا نعيد المحاولة كل فتح.
      if (currentMode === 'slides') {
        currentMode = 'text';
        pendingSlide = null;
        setModeUI(false);
        savePosition(true);
      }
      lessonBody.innerHTML = renderMarkdownContent(section.content_md);
    }
    renderLessonNav(course);
    window.scrollTo(0, 0);
  }

  function makeNavBtn(label, opts) {
    var btn = document.createElement('button');
    btn.setAttribute('type', 'button');
    btn.textContent = label;
    btn.disabled = !!opts.disabled;
    btn.className = 'nav-btn' + (opts.primary ? ' primary' : '');
    if (opts.onClick) btn.addEventListener('click', opts.onClick);
    return btn;
  }

  function renderLessonNav(course) {
    lessonNav.innerHTML = '';
    var isLast = currentSectionIdx >= course.sections.length - 1;
    var isComplete = getCourseProgressState(course.id) === 'completed';

    var prev = makeNavBtn('→ السابق', {
      disabled: currentSectionIdx === 0,
      onClick: function () {
        currentSectionIdx--;
        currentSlideIdx = 0;
        renderLesson();
        savePosition();
      }
    });
    lessonNav.appendChild(prev);

    var spacer = document.createElement('div');
    spacer.style.flex = '1';
    lessonNav.appendChild(spacer);

    var next;
    if (isLast) {
      next = makeNavBtn(isComplete ? 'إنهاء الكورس ✓' : 'إنهاء الكورس', {
        primary: true,
        onClick: function () { completeCourse(course); }
      });
    } else {
      next = makeNavBtn('التالي ←', {
        primary: true,
        onClick: function () {
          // يُسجَّل الجزء الحالي عندما يتركه التلميذ إلى المقطع التالي.
          postPart(course, currentSectionIdx, currentPartKey());
          currentSectionIdx++;
          currentSlideIdx = 0;
          renderLesson();
          savePosition();
        }
      });
    }
    lessonNav.appendChild(next);
  }

  /* ---------- لوحة التقدم الداخلية (شريط الأقسام) ---------- */

  function sectionRec(course, i) {
    if (!progress || !progress.courses) return null;
    var rec = progress.courses.find(function (c) { return c.id === course.id; });
    return rec && rec.sections[i] ? rec.sections[i] : null;
  }

  function renderSectionsBar(course) {
    if (!sectionsBar) return;
    if (!course || !course.sections || !course.sections.length) {
      sectionsBar.classList.add('hidden');
      sectionsBar.innerHTML = '';
      return;
    }
    sectionsBar.classList.remove('hidden');
    sectionsBar.innerHTML = '';

    var currentSlidesSection = null;
    if (currentMode === 'slides' && window.SlidesPlayer && window.SlidesPlayer.getPos) {
      currentSlidesSection = window.SlidesPlayer.getPos().sectionIdx;
    }

    course.sections.forEach(function (section, i) {
      var chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'course-section-chip';
      chip.title = section.title;

      var rec = sectionRec(course, i);
      var isCurrent = (currentMode === 'slides' && currentSlidesSection === i) ||
                      (currentMode !== 'slides' && currentSectionIdx === i);
      var done = !!(rec && rec.completed);
      if (done) chip.classList.add('done');
      if (isCurrent) chip.classList.add('current');

      var num = String(section.num != null ? section.num : (i + 1));
      var inner = '<span class="chip-num">' + escapeHtml(num) + '</span>';
      if (done) {
        inner += '<span class="chip-state">✓</span>';
      } else if (rec) {
        var doneParts = (rec.parts || []).length;
        var total = rec.parts_total || 0;
        if (doneParts && total) {
          inner += '<span class="chip-state">' + doneParts + '/' + total + '</span>';
        }
      }
      chip.innerHTML = inner;
      chip.setAttribute('aria-label', section.title + (done ? ' — مكتمل' : ''));
      chip.addEventListener('click', function () {
        jumpToSection(course, i);
      });
      sectionsBar.appendChild(chip);
    });
  }

  function jumpToSection(course, idx) {
    if (idx === currentSectionIdx) {
      if (currentMode === 'slides') window.SlidesPlayer.reset();
      renderLesson();
      savePosition();
      return;
    }
    currentSectionIdx = idx;
    currentSlideIdx = 0;
    pendingSlide = 0;
    renderLesson();
    savePosition();
  }

  function getCourseProgressState(courseId) {
    if (!progress || !progress.courses) return null;
    var rec = progress.courses.find(function (c) { return c.id === courseId; });
    return rec && rec.completed ? 'completed' : null;
  }

  function completeCourse(course) {
    if (!isLoggedIn()) {
      showLessonNote('سجّل الدخول أولاً لحفظ تقدمك وإتمام الكورسات.', 'error');
      return;
    }
    // يسجّل الجزء الأخير، وقد يرد الخادم بإتمام الكورس إذا اكتملت كل المقاطع.
    postPart(course, currentSectionIdx, currentPartKey())
      .then(function (res) { return res.json(); })
      .then(function (data) {
        var rec = data && data.courses
          ? data.courses.find(function (c) { return String(c.id) === String(course.id); })
          : null;
        if (rec && rec.completed) {
          return loadProgress().then(function () { showSuccess(course); });
        }
        var done = rec ? rec.completedSections : 0;
        var total = rec ? rec.totalSections : 0;
        showLessonNote(
          (data && data.error) ||
            'ما تزال بعض المقاطع غير مكتملة (' + done + ' من ' + total + '). أتمم كل مقاطع الكورس.',
          'error'
        );
      })
      .catch(function (err) {
        showLessonNote('تعذر الاتصال بالخادم: ' + err.message, 'error');
      });
  }

  function showLessonNote(msg, kind) {
    var existing = lessonNav.querySelector('.course-note');
    if (existing) existing.remove();
    var note = document.createElement('div');
    note.className = 'course-note ' + (kind || 'info');
    note.setAttribute('role', 'alert');
    note.textContent = msg;
    lessonNav.insertBefore(note, lessonNav.firstChild);
  }

  function showSuccess(course) {
    var idx = courseData.findIndex(function (c) { return c.id === course.id; });
    var nextCourse = courseData[idx + 1] || null;

    // شاشة الإتمام تحلّ محل الدرس: ننهي أي وضع شرائح أو ملء شاشة قبل عرضها.
    leaveLessonSlides();
    setModeUI(false);

    lessonHead.innerHTML =
      '<h2 class="lesson-title">🎉 مبارك! أتممتَ الكورس: ' + escapeHtml(course.title_ar) + '</h2>' +
      '<span class="lesson-counter">رائع — تقدمك محفوظ.</span>';

    var box = document.createElement('div');
    box.className = 'course-complete-card';
    box.innerHTML =
      '<span class="big-check">✓</span>' +
      '<h3>' + (nextCourse ? 'الكورس التالي أصبح متاحاً الآن' : 'أتممتَ كل مسار الكورسات') + '</h3>' +
      '<p>' + (nextCourse ? escapeHtml(nextCourse.title_ar) : 'تهانينا على إتمام كل وحدات البرنامج.') + '</p>';

    lessonBody.innerHTML = '';
    lessonBody.appendChild(box);

    lessonNav.innerHTML = '';
    var back = makeNavBtn('العودة إلى اللوحة', {
      onClick: function () { showDashboard(); }
    });
    var spacer = document.createElement('div');
    spacer.style.flex = '1';
    lessonNav.appendChild(back);
    lessonNav.appendChild(spacer);
    if (nextCourse) {
      var nxt = makeNavBtn('افتح الكورس التالي ←', {
        primary: true,
        onClick: function () {
          openCourse(nextCourse, idx + 1);
        }
      });
      lessonNav.appendChild(nxt);
    }
    window.scrollTo(0, 0);
  }

  /* ---------- Boot ---------- */

  function init() {
    // في وضع الشرائح: كل شريحة تُعرض = جزء مكتمل (part_key = slide.id)،
    // ويُحدَّث موقع الاستئناف مع كل تنقّل.
    if (window.SlidesPlayer) {
      window.SlidesPlayer.setSlideProgressHandler(function (sectionIdx, slideIdx, slideId) {
        if (!currentCourseId) return;
        var course = getCourse(currentCourseId);
        if (!course) return;
        currentSlideIdx = slideIdx != null ? slideIdx : 0;
        if (slideId && isLoggedIn() && course.sections[sectionIdx]) {
          markLocalProgress(course, sectionIdx, slideId);
          postPart(course, sectionIdx, slideId);
        }
        savePosition();
      });
    }
    // عند مغادرة الصفحة/التبويب، نعتمد آخر موقع حتى لا يضيع عند الإغلاق.
    var flushPos = function () { savePosition(); };
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') savePosition();
    });
    window.addEventListener('pagehide', flushPos);
    if (window.AppAuth) {
      window.AppAuth.onAuth(function () {
        loadProgress().then(function () { renderDashboard(); });
      });
    }
    loadCourseData().then(function () {
      loadProgress().then(function () { renderDashboard(); });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();