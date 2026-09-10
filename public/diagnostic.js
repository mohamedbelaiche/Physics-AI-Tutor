(function () {
  var TEST_ID = 'bac-physics-v1';
  var LS_PREFIX = 'diag_v1_';

  var SKILL_LABELS = {
    math: 'الرياضيات',
    units: 'الوحدات والرموز',
    concepts: 'المفاهيم الفيزيائية',
    data: 'قراءة البيانات والمنحنيات',
    problem_solving: 'حل المسائل',
    methodology: 'المنهجية'
  };

  var DIFF_LABELS = { 1: 'سهل', 2: 'متوسط', 3: 'صعب', 4: 'متقدم' };
  var LEVEL_LABELS = { 1: 'مستوى التأسيس', 2: 'مستوى أساسي', 3: 'مستوى جيد', 4: 'مستوى متقدم' };
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

  function startBtnClick() {
    if (loadStoredState()) {
      enterQuiz(0);
      return;
    }
    hideError(els.introError);
    els.startBtn.disabled = true;
    getSupabase()
      .rpc('start_diagnostic_attempt', { p_test_id: TEST_ID })
      .then(function (res) {
        els.startBtn.disabled = false;
        if (res.error) throw res.error;
        var data = res.data;
        var startedMs = new Date(data.started_at).getTime();
        var limit = (data.test && data.test.time_limit_minutes) || 60;
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

  function renderResults(report) {
    showScreen('results');
    var body = els.resultBody;
    body.innerHTML = '';

    var score = Math.round(report.overall_score || 0);
    var level = report.level || 1;
    var levelClass = level === 4 ? 'lvl-4' : level === 3 ? 'lvl-3' : level === 2 ? 'lvl-2' : 'lvl-1';

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

    var skillMap = report.skill_map || {};
    var skillCard = document.createElement('div');
    skillCard.className = 'diag-result-card';
    var skillTitle = document.createElement('h4');
    skillTitle.className = 'diag-result-title';
    skillTitle.textContent = 'خريطة المهارات';
    skillCard.appendChild(skillTitle);
    Object.keys(SKILL_LABELS).forEach(function (skill) {
      var row = skillMap[skill];
      if (!row) return;
      var barWrap = document.createElement('div');
      barWrap.className = 'diag-skill-row';
      var label = document.createElement('div');
      label.className = 'diag-skill-label';
      var name = document.createElement('span');
      name.textContent = SKILL_LABELS[skill];
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
      val.textContent = (row.score || 0) + '%';
      track.appendChild(bar);
      barWrap.appendChild(label);
      barWrap.appendChild(track);
      barWrap.appendChild(val);
      skillCard.appendChild(barWrap);
    });
    body.appendChild(skillCard);

    var path = report.recommended_learning_path;
    if (Array.isArray(path) && path.length) {
      var recCard = document.createElement('div');
      recCard.className = 'diag-result-card diag-rec';
      var recTitle = document.createElement('h4');
      recTitle.className = 'diag-result-title';
      recTitle.textContent = 'نقطة البداية الموصى بها';
      recCard.appendChild(recTitle);
      path.forEach(function (step) {
        var stepTitle = document.createElement('strong');
        stepTitle.textContent = step.title || step.focus || '';
        var stepDesc = document.createElement('p');
        stepDesc.textContent = step.description || '';
        recCard.appendChild(stepTitle);
        recCard.appendChild(stepDesc);
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

  function init() {
    renderCta();
  }

  if (window.AppAuth) {
    window.AppAuth.onReady(init);
    window.AppAuth.onAuth(init);
  } else {
    document.addEventListener('DOMContentLoaded', init);
  }
})();