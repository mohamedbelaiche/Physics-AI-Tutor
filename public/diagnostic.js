(function () {
  var TEST_ID = 'bac-physics-v2';
  var LS_PREFIX = 'diag_v2_';

  var CATEGORY_LABELS = {
    A: { title: 'المهارات الرياضية', skills: ['mat-num', 'mat-unitconv', 'mat-algebra', 'mat-proportion', 'mat-logexp', 'mat-calc', 'mat-vectrig'] },
    B: { title: 'المهارات الفيزيائية العامة', skills: ['phy-graph', 'phy-table', 'phy-unitsdim', 'phy-lawapply', 'phy-protocol'] },
    C: { title: 'التفكير العلمي والاستدلال', skills: ['rea-method', 'rea-justify', 'rea-compare', 'rea-modelize'] }
  };

  var SKILL_LABELS = {
    'mat-num': 'الحساب بالقوى والكتابة العلمية',
    'mat-unitconv': 'تحويل الوحدات (النظام الدولي)',
    'mat-algebra': 'عزل المتغير وإعادة ترتيب العلاقات',
    'mat-proportion': 'التناسب والكسور والنسب المئوية',
    'mat-logexp': 'الدوال الأسية واللوغاريتمية',
    'mat-calc': 'الاشتقاق والتكامل',
    'mat-vectrig': 'المثلثات والمتجهات (مركبات وإسقاط)',
    'phy-graph': 'قراءة واستغلال المنحنيات',
    'phy-table': 'قراءة الجداول وتحديد الأنماط',
    'phy-unitsdim': 'التحليل البعدي والمتجانسية',
    'phy-lawapply': 'تطبيق علاقة معطاة في موقف بسيط',
    'phy-protocol': 'الفهم التجريبي (أجهزة وإجراء)',
    'rea-method': 'المنهجية: استخراج المعطيات وحل المسألة',
    'rea-justify': 'التبرير والاستنتاج المنطقي',
    'rea-compare': 'المقارنة بين كميتين واتخاذ قرار',
    'rea-modelize': 'النمذجة: وضعية ← علاقة/معادلة'
  };

  var DIFF_LABELS = { 1: 'أساسي', 2: 'تطبيق علاقة', 3: 'تحليل بيان', 4: 'استدلال', 5: 'مسألة مركبة' };
  var LEVEL_LABELS = { 1: 'مستوى تأسيسي', 2: 'مستوى أساسي', 3: 'مستوى جيد', 4: 'مستوى متقدم', 5: 'مستوى متقن' };
  var START_LABELS = {
    unit1: 'المتابعة الزمنية لتحول كيميائي في وسط مائي',
    unit2: 'التحويلات النووية',
    unit3: 'الظواهر الكهربائية (المكثفة والوشيعة)',
    unit4: 'تطور جملة كيميائية نحو التوازن',
    unit5: 'تطور جملة ميكانيكية (الميكانيك)',
    baccalaureate_exams: 'المراجعة المركزة والامتحانات'
  };
  var DIMENSION_LABELS = {
    overall: 'الدرجة الكلية',
    level: 'المستوى',
    math: 'الرياضيات',
    physics: 'الفيزياء',
    scientific: 'التفكير العلمي',
    num: 'القوى والكتابة العلمية',
    units: 'الوحدات والتحليل البعدي',
    proportion: 'التناسب',
    algebra: 'الجبر',
    log_exp: 'الأسي واللوغاريتمي',
    calc: 'الاشتقاق والتكامل',
    vectors: 'المتجهات والمثلثات',
    graph: 'قراءة المنحنيات',
    experimental: 'التجريبية (بروتوكول وجداول)'
  };
  var STATUS_LABELS = {
    strength: 'قوة',
    good: 'جيدة',
    weak: 'ضعيفة',
    critical: 'حرجة'
  };

  var els = {
    cta: document.getElementById('diag-cta'),
    ctaResult: document.getElementById('diag-cta-result'),
    ctaBtn: document.getElementById('diag-cta-btn'),
    view: document.getElementById('diagnostic-view'),
    intro: document.getElementById('diag-intro'),
    quiz: document.getElementById('diag-quiz'),
    results: document.getElementById('diag-results'),
    startBtn: document.getElementById('diag-start'),
    backBtn: document.getElementById('diag-back'),
    introError: document.getElementById('diag-intro-error'),
    priorPhysics: document.getElementById('diag-prior-physics'),
    priorMath: document.getElementById('diag-prior-math'),
    quizExit: document.getElementById('diag-quiz-exit'),
    progressText: document.getElementById('diag-progress-text'),
    timerEl: document.getElementById('diag-timer'),
    progressBar: document.getElementById('diag-progress-bar'),
    qText: document.getElementById('diag-q-text'),
    qMeta: document.getElementById('diag-q-meta'),
    options: document.getElementById('diag-options'),
    prev: document.getElementById('diag-prev'),
    next: document.getElementById('diag-next'),
    submit: document.getElementById('diag-submit'),
    quizError: document.getElementById('diag-quiz-error'),
    resultsBack: document.getElementById('diag-results-back'),
    resultBody: document.getElementById('diag-result-body')
  };

  var state = null; // { attemptId, startedAt (ms), endAt (ms), timeLimitMin, questions: [], answers: {} }
  var currentIndex = 0;
  var timerId = null;
  var saveTimer = null;
  var submitLock = false;
  var reviewShown = false;

  function uid() {
    var u = window.AppAuth && window.AppAuth.getUser();
    return u ? u.id : null;
  }

  function stateKey() {
    return LS_PREFIX + 'state_' + (uid() || 'anon');
  }

  function resultKey() {
    return LS_PREFIX + 'result_' + (uid() || 'anon');
  }

  function isLoggedIn() {
    return !!(window.AppAuth && window.AppAuth.getUser());
  }

  function getSupabase() {
    return window.AppAuth.getClient();
  }

  function loadStoredState() {
    try {
      var raw = localStorage.getItem(stateKey());
      state = raw ? JSON.parse(raw) : null;
    } catch (err) {
      state = null;
    }
    return state;
  }

  function persistState() {
    if (!state) return;
    try {
      localStorage.setItem(stateKey(), JSON.stringify(state));
    } catch (err) {}
  }

  function clearState() {
    state = null;
    try {
      localStorage.removeItem(stateKey());
    } catch (err) {}
  }

  function loadResult() {
    try {
      var raw = localStorage.getItem(resultKey());
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      return null;
    }
  }

  function persistResult(report) {
    try {
      localStorage.setItem(resultKey(), JSON.stringify(report));
    } catch (err) {}
  }

  // ---------- view management ----------

  function showView(showDiag) {
    var home = document.getElementById('home-view');
    if (home) home.classList.toggle('hidden', showDiag);
    els.view.classList.toggle('hidden', !showDiag);
    window.scrollTo(0, 0);
    if (!showDiag) {
      stopTimer();
      if (els.quiz.classList.contains('hidden') === false) {
        afterExitQuiz();
      }
    }
  }

  function showScreen(screen) {
    els.intro.classList.toggle('hidden', screen !== 'intro');
    els.quiz.classList.toggle('hidden', screen !== 'quiz');
    els.results.classList.toggle('hidden', screen !== 'results');
  }

  function showError(el, msg) {
    el.textContent = msg;
    el.classList.remove('hidden');
  }

  function hideError(el) {
    el.classList.add('hidden');
    el.textContent = '';
  }

  function afterExitQuiz() {
    if (timerId) {
      clearInterval(timerId);
      timerId = null;
    }
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
  }

  // ---------- CTA ----------

  function renderCta() {
    if (!els.cta) return;
    if (!isLoggedIn()) {
      els.cta.classList.remove('hidden');
      els.ctaBtn.textContent = 'سجّل الدخول لتخوض التقييم';
      els.ctaResult.classList.add('hidden');
      return;
    }
    els.cta.classList.remove('hidden');
    var res = loadResult();
    var hasProgress = !!loadStoredState();
    if (hasProgress) {
      els.ctaBtn.textContent = 'استكمال التقييم';
      els.ctaResult.classList.add('hidden');
    } else if (res) {
      els.ctaBtn.textContent = 'إعادة التقييم';
      els.ctaResult.textContent = 'مستواك: ' + (LEVEL_LABELS[res.level] || res.level) + ' — ' + Math.round(res.overall_score) + '%';
      els.ctaResult.classList.remove('hidden');
    } else {
      els.ctaBtn.textContent = 'ابدأ التقييم مجاناً';
      els.ctaResult.classList.add('hidden');
    }
  }

  function openDiag() {
    if (!isLoggedIn()) {
      var authBtn = document.getElementById('auth-btn');
      if (authBtn && authBtn.dataset.action !== 'logout') authBtn.click();
      return;
    }
    loadStoredState();
    showView(true);
    hideError(els.introError);
    renderIntro();
    showScreen('intro');
  }

  function renderIntro() {
    var hasProgress = !!loadStoredState();
    els.startBtn.textContent = hasProgress ? 'استكمال التقييم' : 'ابدأ التقييم';
  }

  function readPriorScores() {
    function parseVal(el) {
      if (!el || el.value.trim() === '') return null;
      var v = parseFloat(el.value.replace(',', '.'));
      return v;
    }
    return { physics: parseVal(els.priorPhysics), math: parseVal(els.priorMath) };
  }

  function validateAndGetPriorScores() {
    var p = readPriorScores();
    var bad = [];
    if (p.physics !== null && (isNaN(p.physics) || p.physics < 0 || p.physics > 20)) {
      bad.push('نقطة الفيزياء يجب أن تكون رقماً بين 0 و 20');
    }
    if (p.math !== null && (isNaN(p.math) || p.math < 0 || p.math > 20)) {
      bad.push('نقطة الرياضيات يجب أن تكون رقماً بين 0 و 20');
    }
    return bad;
  }

  function savePriorScores(attemptId) {
    var p = readPriorScores();
    if (p.physics === null || p.math === null) return Promise.resolve();
    return getSupabase()
      .rpc('save_prior_year_scores', {
        p_attempt_id: attemptId,
        p_math_score: p.math,
        p_physics_score: p.physics
      });
  }

  function startBtnClick() {
    if (loadStoredState()) {
      enterQuiz(0);
      return;
    }
    hideError(els.introError);
    var priorBad = validateAndGetPriorScores();
    if (priorBad.length) {
      showError(els.introError, priorBad.join('، '));
      return;
    }
    els.startBtn.disabled = true;
    getSupabase()
      .rpc('start_diagnostic_attempt', { p_test_id: TEST_ID })
      .then(function (res) {
        els.startBtn.disabled = false;
        if (res.error) throw res.error;
        var data = res.data;
        var startedMs = new Date(data.started_at).getTime();
        var limit = (data.test && data.test.time_limit_minutes) || 75;
        state = {
          attemptId: data.attempt_id,
          startedAt: startedMs || Date.now(),
          endAt: (startedMs || Date.now()) + limit * 60000,
          timeLimitMin: limit,
          questions: data.questions || [],
          answers: data.draft_answers && typeof data.draft_answers === 'object' ? data.draft_answers : {}
        };
        persistState();
        enterQuiz(0);
        savePriorScores(state.attemptId).catch(function (err) {
          console.warn('prior scores not saved:', err && (err.message || err));
        });
      })
      .catch(function (err) {
        els.startBtn.disabled = false;
        showError(els.introError, 'تعذر بدء التقييم: ' + (err.message || err));
      });
  }

  function enterQuiz(index) {
    showScreen('quiz');
    currentIndex = index;
    reviewShown = false;
    renderQuestion();
    startTimer();
  }

  function renderQuestion() {
    var q = state.questions[currentIndex];
    if (!q) return;

    els.qText.textContent = (currentIndex + 1) + '. ' + q.question;
    var meta = [];
    meta.push('<span class="diag-chip">' + (SKILL_LABELS[q.skill] || q.skill) + '</span>');
    if (q.secondary_skill) {
      meta.push('<span class="diag-chip diag-chip-alt">' + (SKILL_LABELS[q.secondary_skill] || q.secondary_skill) + '</span>');
    }
    meta.push('<span class="diag-chip">الصعوبة: ' + (DIFF_LABELS[q.difficulty] || q.difficulty) + '</span>');
    els.qMeta.innerHTML = meta.join('');

    els.options.innerHTML = '';
    (q.options || []).forEach(function (opt) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'diag-option';
      btn.setAttribute('role', 'button');
      var selected = state.answers[q.id] === opt.id;
      if (selected) btn.classList.add('selected');
      var letter = document.createElement('span');
      letter.className = 'diag-option-letter';
      letter.textContent = opt.id;
      var text = document.createElement('span');
      text.className = 'diag-option-text';
      text.textContent = opt.text;
      btn.appendChild(letter);
      btn.appendChild(text);
      btn.addEventListener('click', function () {
        selectOption(q.id, opt.id);
      });
      els.options.appendChild(btn);
    });

    var total = state.questions.length;
    els.progressText.textContent = 'السؤال ' + (currentIndex + 1) + ' من ' + total;
    var pct = Math.round(((currentIndex + 1) / total) * 100);
    els.progressBar.style.width = pct + '%';

    els.prev.disabled = currentIndex === 0;
    els.next.classList.toggle('hidden', currentIndex >= total - 1);
    els.submit.classList.toggle('hidden', currentIndex < total - 1);
  }

  function selectOption(qid, optId) {
    if (!state) return;
    state.answers[qid] = optId;
    persistState();
    renderQuestion();
    scheduleSave();
  }

  function scheduleSave() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      saveTimer = null;
      saveToServer();
    }, 900);
  }

  var saving = false;

  function saveToServer() {
    if (saving || !state || !isLoggedIn()) return;
    var snapshot = JSON.parse(JSON.stringify(state.answers));
    saving = true;
    getSupabase()
      .rpc('save_diagnostic_answers', { p_attempt_id: state.attemptId, p_answers: snapshot })
      .then(function () { saving = false; })
      .catch(function () { saving = false; });
  }

  function setTimerText(secs) {
    if (secs < 0) secs = 0;
    var m = Math.floor(secs / 60);
    var s = secs % 60;
    els.timerEl.textContent = 'الوقت المتبقي: ' + m + ':' + (s < 10 ? '0' : '') + s;
    els.timerEl.classList.toggle('diag-timer-warn', secs <= 300);
  }

  var lastTickEmited = false;

  function startTimer() {
    stopTimer();
    lastTickEmited = false;
    timerId = setInterval(tick, 1000);
    tick();
  }

  function stopTimer() {
    if (timerId) {
      clearInterval(timerId);
      timerId = null;
    }
  }

  function tick() {
    if (!state) return;
    var left = Math.max(0, Math.floor((state.endAt - Date.now()) / 1000));
    setTimerText(left);
    if (left <= 0 && !lastTickEmited) {
      lastTickEmited = true;
      stopTimer();
      confirmSubmit(true);
    }
  }

  // ---------- submit ----------

  function confirmSubmit(auto) {
    if (submitLock) return;
    if (!state) return;

    var answered = Object.keys(state.answers).length;
    var total = state.questions.length;
    if (!auto && answered < total) {
      var ok = window.confirm('أنت أجبت على ' + answered + ' من ' + total + ' سؤالاً. ' +
        'الأسئلة غير المُجابة تُحتسب خطأ. هل تريد الإرسال الآن؟');
      if (!ok) return;
    }

    submitLock = true;
    els.submit.disabled = true;
    var payload = JSON.parse(JSON.stringify(state.answers));
    var duration = Math.max(0, Math.floor((Date.now() - state.startedAt) / 1000));

    getSupabase()
      .rpc('submit_diagnostic_attempt', {
        p_attempt_id: state.attemptId,
        p_duration_seconds: duration
      })
      .then(function (res) {
        submitLock = false;
        els.submit.disabled = false;
        if (res.error) throw res.error;
        var report = res.data;
        clearState();
        persistResult(report);
        afterExitQuiz();
        renderResults(report);
      })
      .catch(function (err) {
        submitLock = false;
        els.submit.disabled = false;
        showError(els.quizError, 'تعذر إرسال النتائج: ' + (err.message || err) + ' — ستعود إجاباتك محفوظة محلياً، حاول مجدداً.');
      });
  }

  // ---------- results ----------

  function dimTile(v, label, unit) {
    var tile = document.createElement('div');
    tile.className = 'diag-dim-tile';
    var lab = document.createElement('div');
    lab.className = 'diag-dim-label';
    lab.textContent = label;
    var val = document.createElement('div');
    val.className = 'diag-dim-value';
    val.textContent = v === null || v === undefined ? '—' : Math.round(v) + unit;
    tile.appendChild(lab);
    tile.appendChild(val);
    return tile;
  }

  function skillRow(skill, row) {
    var barWrap = document.createElement('div');
    barWrap.className = 'diag-skill-row';
    var label = document.createElement('div');
    label.className = 'diag-skill-label';
    var name = document.createElement('span');
    name.textContent = SKILL_LABELS[skill] || skill;
    var chip = document.createElement('span');
    chip.className = 'diag-status diag-status-' + row.status;
    chip.textContent = STATUS_LABELS[row.status] || row.status;
    label.appendChild(name);
    label.appendChild(chip);
    var track = document.createElement('div');
    track.className = 'diag-skill-track';
    var bar = document.createElement('div');
    bar.className = 'diag-skill-bar diag-skill-' + row.status;
    bar.style.width = Math.max(2, row.score || 0) + '%';
    var val = document.createElement('span');
    val.className = 'diag-skill-val';
    val.textContent = (row.score || 0) + '%' + (row.level ? ' • L' + row.level : '');
    track.appendChild(bar);
    barWrap.appendChild(label);
    barWrap.appendChild(track);
    barWrap.appendChild(val);
    return barWrap;
  }

  function renderResults(report) {
    showScreen('results');
    var body = els.resultBody;
    body.innerHTML = '';

    var score = Math.round(report.overall_score || 0);
    var level = report.level || 1;
    var levelClass = level === 5 ? 'lvl-5' : level === 4 ? 'lvl-4' : level === 3 ? 'lvl-3' : level === 2 ? 'lvl-2' : 'lvl-1';

    var head = document.createElement('div');
    head.className = 'diag-result-card diag-result-head ' + levelClass;
    var scoreP = document.createElement('div');
    scoreP.className = 'diag-score';
    scoreP.textContent = score + '%';
    var meta = document.createElement('div');
    meta.className = 'diag-score-meta';
    var levelText = document.createElement('strong');
    levelText.textContent = LEVEL_LABELS[level] || 'مستوى غير محدد';
    var hint = document.createElement('span');
    hint.textContent = 'الدرجة الكلية في التقييم التشخيصي للفيزياء';
    meta.appendChild(levelText);
    meta.appendChild(hint);
    head.appendChild(scoreP);
    head.appendChild(meta);
    body.appendChild(head);

    var prior = report.prior_scores || {};
    if (prior.physics !== null || prior.math !== null) {
      var priorCard = document.createElement('div');
      priorCard.className = 'diag-result-card diag-prior-result';
      var priorTitle = document.createElement('h4');
      priorTitle.className = 'diag-result-title';
      priorTitle.textContent = 'نقطة العام الماضي (إشارة أولية فقط)';
      priorCard.appendChild(priorTitle);
      var priorRow = document.createElement('div');
      priorRow.className = 'diag-dim-grid';
      priorRow.appendChild(dimTile(prior.physics, 'الفيزياء', '/20'));
      priorRow.appendChild(dimTile(prior.math, 'الرياضيات', '/20'));
      priorCard.appendChild(priorRow);
      body.appendChild(priorCard);
    }

    var dims = report.dimensions || {};
    if (Object.keys(dims).length) {
      var dimCard = document.createElement('div');
      dimCard.className = 'diag-result-card';
      var dimTitle = document.createElement('h4');
      dimTitle.className = 'diag-result-title';
      dimTitle.textContent = 'الأبعاد الرئيسية';
      dimCard.appendChild(dimTitle);
      var dimGrid = document.createElement('div');
      dimGrid.className = 'diag-dim-grid';
      ['math', 'physics', 'scientific'].forEach(function (k) {
        if (dims[k] === null || dims[k] === undefined) return;
        dimGrid.appendChild(dimTile(dims[k], DIMENSION_LABELS[k] || k, '%'));
      });
      dimCard.appendChild(dimGrid);
      var dimChips = document.createElement('div');
      dimChips.className = 'diag-dim-chips';
      Object.keys(dims).forEach(function (k) {
        if (k === 'overall' || k === 'level' || k === 'math' || k === 'physics' || k === 'scientific') return;
        if (dims[k] === null || dims[k] === undefined) return;
        var chip = document.createElement('span');
        chip.className = 'diag-chip info';
        chip.textContent = DIMENSION_LABELS[k] + ': ' + Math.round(dims[k]) + '%';
        dimChips.appendChild(chip);
      });
      if (dimChips.childNodes.length) dimCard.appendChild(dimChips);
      body.appendChild(dimCard);
    }

    var skillMap = report.skill_map || {};
    var skillCard = document.createElement('div');
    skillCard.className = 'diag-result-card';
    var skillTitle = document.createElement('h4');
    skillTitle.className = 'diag-result-title';
    skillTitle.textContent = 'خريطة المهارات (16 مهارة)';
    skillCard.appendChild(skillTitle);
    Object.keys(CATEGORY_LABELS).forEach(function (cat) {
      var catLabel = document.createElement('div');
      catLabel.className = 'diag-cat-title';
      catLabel.textContent = CATEGORY_LABELS[cat].title;
      skillCard.appendChild(catLabel);
      CATEGORY_LABELS[cat].skills.forEach(function (skill) {
        var row = skillMap[skill];
        if (!row) return;
        skillCard.appendChild(skillRow(skill, row));
      });
    });
    body.appendChild(skillCard);

    var start = report.recommended_start;
    if (start) {
      var startCard = document.createElement('div');
      startCard.className = 'diag-result-card diag-start-card';
      var startTitle = document.createElement('h4');
      startTitle.className = 'diag-result-title';
      startTitle.textContent = 'نقطة البداية الموصى بها';
      startCard.appendChild(startTitle);
      var startText = document.createElement('p');
      startText.className = 'diag-start-text';
      startText.textContent = START_LABELS[start] || start;
      startCard.appendChild(startText);
      body.appendChild(startCard);
    }

    var path = report.recommended_learning_path;
    if (Array.isArray(path) && path.length) {
      var recCard = document.createElement('div');
      recCard.className = 'diag-result-card diag-rec';
      var recTitle = document.createElement('h4');
      recTitle.className = 'diag-result-title';
      recTitle.textContent = 'المسار التعليمي الموصى به';
      recCard.appendChild(recTitle);
      path.forEach(function (step, idx) {
        var stepRow = document.createElement('div');
        stepRow.className = 'diag-path-step';
        var num = document.createElement('span');
        num.className = 'diag-path-idx';
        num.textContent = (idx + 1) + '.';
        var inner = document.createElement('div');
        inner.className = 'diag-path-body';
        var headRow = document.createElement('div');
        headRow.className = 'diag-path-head';
        var stepTitle = document.createElement('strong');
        stepTitle.textContent = step.title || step.focus || '';
        headRow.appendChild(stepTitle);
        var badge = document.createElement('span');
        badge.className = 'diag-path-badge ' + (step.required ? 'req' : 'rec');
        badge.textContent = step.required ? 'إلزامي' : 'موصى به';
        headRow.appendChild(badge);
        inner.appendChild(headRow);
        var stepDesc = document.createElement('p');
        stepDesc.textContent = step.description || '';
        inner.appendChild(stepDesc);
        stepRow.appendChild(num);
        stepRow.appendChild(inner);
        recCard.appendChild(stepRow);
      });
      body.appendChild(recCard);
    }

    var strengths = report.strengths || [];
    var weaknesses = report.weaknesses || [];
    var critical = report.critical_weaknesses || [];
    var lists = {
      strengths: { title: 'نقاط قوتك', items: strengths },
      weaknesses: { title: 'مهارات تحتاج إلى تقوية', items: weaknesses },
      critical: { title: 'مهارات حرجة تستوجب الاهتمام أولاً', items: critical }
    };
    Object.keys(lists).forEach(function (key) {
      var list = lists[key];
      if (!list.items.length) return;
      var card = document.createElement('div');
      card.className = 'diag-result-card diag-list diag-list-' + key;
      var title = document.createElement('h4');
      title.className = 'diag-result-title';
      title.textContent = list.title;
      card.appendChild(title);
      list.items.forEach(function (skill) {
        var li = document.createElement('span');
        li.className = 'diag-list-item';
        li.textContent = SKILL_LABELS[skill] || skill;
        card.appendChild(li);
      });
      body.appendChild(card);
    });

    var actions = document.createElement('div');
    actions.className = 'diag-result-actions';
    var reviewBtn = document.createElement('button');
    reviewBtn.type = 'button';
    reviewBtn.className = 'btn-primary';
    reviewBtn.textContent = 'مراجعة حلولك بالتفصيل';
    reviewBtn.addEventListener('click', function () { loadReview(report); });
    var retakeBtn = document.createElement('button');
    retakeBtn.type = 'button';
    retakeBtn.className = 'diag-nav-btn';
    retakeBtn.textContent = 'إعادة التقييم';
    retakeBtn.addEventListener('click', function () {
      hideError(els.introError);
      els.startBtn.disabled = false;
      showScreen('intro');
      els.startBtn.textContent = 'ابدأ التقييم';
    });
    actions.appendChild(reviewBtn);
    actions.appendChild(retakeBtn);
    body.appendChild(actions);
  }

  function loadReview(report) {
    if (reviewShown) return;
    reviewShown = true;
    getSupabase()
      .rpc('get_my_diagnostic_attempt', {
        p_attempt_id: report.attempt_id,
        p_include_review: true
      })
      .then(function (res) {
        if (res.error) throw res.error;
        var data = res.data;
        renderReview(data.questions || []);
      })
      .catch(function (err) {
        reviewShown = false;
        alert('تعذر تحميل المراجعة: ' + (err.message || err));
      });
  }

  function renderReview(questions) {
    var existing = document.getElementById('diag-review-wrap');
    if (existing) {
      existing.classList.toggle('hidden', false);
      return;
    }
    var wrap = document.createElement('div');
    wrap.id = 'diag-review-wrap';
    var title = document.createElement('h4');
    title.className = 'diag-result-title';
    title.textContent = 'مراجعة الحلول';
    wrap.appendChild(title);

    questions.forEach(function (q, i) {
      var card = document.createElement('div');
      card.className = 'diag-review-card';

      var qTitle = document.createElement('div');
      qTitle.className = 'diag-review-q';
      qTitle.textContent = (i + 1) + '. ' + q.question + (q.correct ? ' ✓' : ' ✗');

      var options = document.createElement('div');
      options.className = 'diag-review-options';
      (q.options || []).forEach(function (opt) {
        var optRow = document.createElement('div');
        optRow.className = 'diag-option diag-review-option';
        if (opt.id === q.correct_option) optRow.classList.add('correct');
        if (opt.id === q.selected_option && q.selected_option !== q.correct_option) {
          optRow.classList.add('wrong');
        }
        var letter = document.createElement('span');
        letter.className = 'diag-option-letter';
        letter.textContent = opt.id;
        var text = document.createElement('span');
        text.className = 'diag-option-text';
        text.textContent = opt.text;
        optRow.appendChild(letter);
        optRow.appendChild(text);
        if (opt.id === q.correct_option) {
          var okTag = document.createElement('span');
          okTag.className = 'diag-review-tag';
          okTag.textContent = 'الإجابة الصحيحة';
          optRow.appendChild(okTag);
        } else if (opt.id === q.selected_option) {
          var badTag = document.createElement('span');
          badTag.className = 'diag-review-tag wrong';
          badTag.textContent = 'إجابتك';
          optRow.appendChild(badTag);
        }
        options.appendChild(optRow);
      });

      var exp = document.createElement('div');
      exp.className = 'diag-review-exp';
      exp.textContent = q.explanation || '';

      var tags = q.diagnostic_tags && q.diagnostic_tags.length;
      if (tags) {
        var tagRow = document.createElement('div');
        tagRow.className = 'diag-review-tags';
        (q.diagnostic_tags || []).forEach(function (t) {
          var tag = document.createElement('span');
          tag.className = 'diag-chip';
          tag.textContent = t;
          tagRow.appendChild(tag);
        });
        card.appendChild(tagRow);
      }

      card.appendChild(qTitle);
      card.appendChild(options);
      card.appendChild(exp);
      wrap.appendChild(card);
    });

    els.resultBody.appendChild(wrap);
  }

  // ---------- events ----------

  els.cta.addEventListener('click', openDiag);
  els.cta.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openDiag();
    }
  });
  els.backBtn.addEventListener('click', function () { showView(false); });
  els.startBtn.addEventListener('click', startBtnClick);
  els.quizExit.addEventListener('click', function () {
    if (confirm('خروج من التقييم؟ سيتم حفظ إجاباتك ويمكنك الاستكمال لاحقاً من نفس النقطة.')) {
      afterExitQuiz();
      hideError(els.introError);
      renderIntro();
      showView(false);
    }
  });
  els.prev.addEventListener('click', function () {
    if (currentIndex > 0) {
      currentIndex--;
      renderQuestion();
    }
  });
  els.next.addEventListener('click', function () {
    if (currentIndex < state.questions.length - 1) {
      currentIndex++;
      renderQuestion();
    }
  });
  els.submit.addEventListener('click', function () { confirmSubmit(false); });
  els.resultsBack.addEventListener('click', function () { showView(false); });

  window.addEventListener('beforeunload', function (e) {
    var quizVisible = !(els.quiz.classList.contains('hidden'));
    if (quizVisible && state && !submitLock) {
      e.preventDefault();
      e.returnValue = '';
    }
  });

  // Refresh saved answers when the page is closed cleanly.
  window.addEventListener('pagehide', function () {
    if (state && saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
      saveToServer();
    }
  });

  // ---------- boot ----------

  function clearLegacyKeys() {
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf('diag_v1_') === 0) {
          localStorage.removeItem(k);
        }
      }
    } catch (err) {}
  }

  function init() {
    clearLegacyKeys();
    renderCta();
  }

  if (window.AppAuth) {
    window.AppAuth.onReady(init);
    window.AppAuth.onAuth(init);
  } else {
    document.addEventListener('DOMContentLoaded', init);
  }
})();