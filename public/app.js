(function () {
  var homeView = document.getElementById('home-view');
  var readerView = document.getElementById('reader-view');
  var unitsContainer = document.getElementById('units-container');
  var backBtn = document.getElementById('back-btn');
  var readerTitle = document.getElementById('reader-title');
  var pdfError = document.getElementById('pdf-error');
  var pdfCanvasWrap = document.getElementById('pdf-canvas-wrap');
  var pdfCanvas = document.getElementById('pdf-canvas');
  var pdfProgress = document.getElementById('pdf-progress');
  var pdfControls = document.getElementById('pdf-controls');
  var pdfPrev = document.getElementById('pdf-prev');
  var pdfNext = document.getElementById('pdf-next');
  var pdfPageInfo = document.getElementById('pdf-page-info');
  var pdfDownload = document.getElementById('pdf-download');
  var pdfOpenOriginal = document.getElementById('pdf-open-original');

  var chatBtn = document.getElementById('chat-btn');
  var chatPanel = document.getElementById('chat-panel');
  var chatClose = document.getElementById('chat-close');
  var chatForm = document.getElementById('chat-form');
  var chatInput = document.getElementById('chat-input');
  var chatMessages = document.getElementById('chat-messages');

  var authBtn = document.getElementById('auth-btn');
  var authModal = document.getElementById('auth-modal');
  var authModalClose = document.getElementById('auth-modal-close');
  var authModalTitle = document.getElementById('auth-modal-title');
  var authModalSub = document.getElementById('auth-modal-sub');
  var authForm = document.getElementById('auth-form');
  var authEmail = document.getElementById('auth-email');
  var authPassword = document.getElementById('auth-password');
  var authName = document.getElementById('auth-name');
  var authError = document.getElementById('auth-error');
  var authSubmit = document.getElementById('auth-submit');
  var authGoogle = document.getElementById('auth-google');
  var authSwitchBtn = document.getElementById('auth-switch-btn');
  var authSwitchText = document.getElementById('auth-switch-text');
  var authGoogleWrap = document.getElementById('auth-google-wrap');

  var units = [];
  var chatHistory = [];
  var currentChatSessionId = null;
  var isAuthMode = false;

  if (window.pdfjsLib && window.pdfjsLib.GlobalWorkerOptions) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }

  var currentDoc = null;
  var currentPage = 1;
  var currentFileUrl = '';
  var currentRenderTask = null;

  function toggleChat(open) {
    chatPanel.classList.toggle('hidden', !open);
    chatBtn.classList.toggle('hidden', open);
    if (open) chatInput.focus();
  }

  function showView(view) {
    homeView.classList.toggle('hidden', view === 'reader');
    readerView.classList.toggle('hidden', view === 'home');
    window.scrollTo(0, 0);
  }

  function isLoggedIn() {
    return !!(window.AppAuth && window.AppAuth.getUser());
  }

  function openAuthModal(mode) {
    isAuthMode = mode === 'signup';
    authModalTitle.textContent = isAuthMode ? 'إنشاء حساب جديد' : 'تسجيل الدخول';
    authModalSub.textContent = isAuthMode
      ? 'أنشئ حساباً مجانياً لاستخدام المدرّس الذكي'
      : 'ادخل بحسابك لاستخدام المدرّس الذكي';
    authSubmit.textContent = isAuthMode ? 'إنشاء حساب' : 'دخول';
    authPassword.autocomplete = isAuthMode ? 'new-password' : 'current-password';
    authName.classList.toggle('hidden', !isAuthMode);
    authSwitchText.textContent = isAuthMode ? 'لديك حساب بالفعل؟' : 'ليس لديك حساب؟';
    authSwitchBtn.textContent = isAuthMode ? 'تسجيل الدخول' : 'إنشاء حساب جديد';
    authError.classList.add('hidden');
    authError.textContent = '';
    authModal.classList.remove('hidden');
    authEmail.focus();
  }

  function closeAuthModal() {
    authModal.classList.add('hidden');
  }

  function showAuthError(msg) {
    authError.textContent = msg;
    authError.classList.remove('hidden');
  }

  function setAuthBusy(busy) {
    authSubmit.disabled = busy;
    authGoogle.disabled = busy;
  }

  function handleAuthSubmit(e) {
    e.preventDefault();
    var email = authEmail.value.trim();
    var password = authPassword.value;
    var fullName = authName.value.trim();

    if (!email || !password) {
      showAuthError('أدخل البريد الإلكتروني وكلمة المرور.');
      return;
    }
    if (password.length < 6) {
      showAuthError('كلمة المرور يجب أن تكون 6 أحرف على الأقل.');
      return;
    }

    setAuthBusy(true);
    var action = isAuthMode
      ? window.AppAuth.signUpWithEmail(email, password, fullName)
      : window.AppAuth.signInWithEmail(email, password);

    action.then(function (result) {
      setAuthBusy(false);
      if (result.error) {
        showAuthError(result.error.message);
        return;
      }
      if (isAuthMode && result.data && result.data.session === null) {
        showAuthError('تم إنشاء الحساب. تفقد بريدك لتأكيد الحساب، ثم سجّل الدخول.');
        return;
      }
      closeAuthModal();
      authForm.reset();
      renderAuthUI();
      if (isLoggedIn()) startNewSession();
    });
  }

  function handleGoogleSignIn() {
    setAuthBusy(true);
    window.AppAuth.signInWithGoogle().catch(function (err) {
      setAuthBusy(false);
      showAuthError('تعذر بدء تسجيل الدخول عبر Google: ' + err.message);
    });
  }

  function renderAuthUI() {
    var user = window.AppAuth.getUser();
    var profile = window.AppAuth.getProfile();
    if (authBtn) {
      authBtn.classList.remove('hidden');
      if (user) {
        var name = (profile && (profile.full_name || profile.email)) || user.email || 'حسابي';
        authBtn.textContent = 'تسجيل الخروج';
        authBtn.classList.add('btn-outline');
        authBtn.dataset.action = 'logout';

        var display = (profile && (profile.full_name || profile.email)) || user.email || name;
        var initials = String(display).charAt(0).toUpperCase();
        var userChip = document.getElementById('auth-user-chip');
        if (userChip) userChip.remove();

        userChip = document.createElement('span');
        userChip.id = 'auth-user-chip';
        userChip.className = 'auth-user';
        if (profile && profile.avatar_url) {
          var img = document.createElement('img');
          img.src = profile.avatar_url;
          img.alt = 'صورة المستخدم';
          userChip.appendChild(img);
        } else {
          var initial = document.createElement('span');
          initial.textContent = initials;
          userChip.appendChild(initial);
        }
        var nm = document.createElement('span');
        nm.textContent = display;
        userChip.appendChild(nm);
        authBtn.parentNode.insertBefore(userChip, authBtn);
      } else {
        authBtn.textContent = 'تسجيل الدخول';
        authBtn.classList.remove('btn-outline');
        authBtn.dataset.action = 'login';
        var chip = document.getElementById('auth-user-chip');
        if (chip) chip.remove();
      }
    }
  }

  function updateChatGate() {
    var gate = document.getElementById('chat-gate');
    if (!gate) return;
    if (isLoggedIn()) {
      gate.classList.add('hidden');
      chatForm.classList.remove('hidden');
      chatInput.disabled = false;
    } else {
      gate.classList.remove('hidden');
      chatForm.classList.add('hidden');
      chatInput.disabled = true;
    }
  }

  function requireAuth(callback) {
    if (isLoggedIn()) {
      callback();
      return;
    }
    openAuthModal('login');
  }

  function startNewSession() {
    currentChatSessionId = null;
    chatHistory = [];
    var messagesEl = document.getElementById('chat-messages');
    messagesEl.innerHTML =
      '<div class="chat-msg bot"><p>مرحباً! أنا المدرس الذكي. اسألني عن أي سؤال في الفيزياء أو الكيمياء.</p></div>';
    loadLatestSession();
  }

  function loadLatestSession() {
    var supabase = window.AppAuth.getClient();
    if (!supabase || !isLoggedIn()) return;
    supabase
      .from('chat_sessions')
      .select('*')
      .eq('user_id', window.AppAuth.getUser().id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(function (result) {
        if (result.error || !result.data) return;
        currentChatSessionId = result.data.id;
        return supabase
          .from('chat_messages')
          .select('id, role, content')
          .eq('session_id', currentChatSessionId)
          .order('id', { ascending: true })
          .then(function (msgResult) {
            var messagesEl = document.getElementById('chat-messages');
            messagesEl.innerHTML = '';
            if (!msgResult.error && msgResult.data) {
              msgResult.data.forEach(function (m) {
                var row = document.createElement('div');
                row.className = m.role === 'user' ? 'chat-msg user' : 'chat-msg bot';
                var p = document.createElement('p');
                p.textContent = m.content;
                row.appendChild(p);
                messagesEl.appendChild(row);
                chatHistory.push({ role: m.role, content: m.content });
              });
            }
            if (!chatHistory.length) {
              messagesEl.innerHTML =
                '<div class="chat-msg bot"><p>مرحباً! أنا المدرس الذكي. اسألني عن أي سؤال في الفيزياء أو الكيمياء.</p></div>';
            }
            messagesEl.scrollTop = messagesEl.scrollHeight;
          });
      })
      .catch(function () {});
  }

  function saveChatMessage(role, content) {
    var supabase = window.AppAuth.getClient();
    if (!supabase || !isLoggedIn()) return Promise.resolve();

    if (!currentChatSessionId) {
      return supabase
        .from('chat_sessions')
        .insert({
          user_id: window.AppAuth.getUser().id,
          title: chatHistory.length ? chatHistory[0].content.slice(0, 40) : 'محادثة جديدة'
        })
        .select('id')
        .single()
        .then(function (res) {
          if (res.error) throw res.error;
          currentChatSessionId = res.data.id;
          return supabase.from('chat_messages').insert({
            session_id: currentChatSessionId,
            role: role,
            content: content
          });
        })
        .then(function (res) {
          if (res.error) throw res.error;
          return supabase
            .from('chat_sessions')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', currentChatSessionId);
        });
    }

    return supabase
      .from('chat_messages')
      .insert({ session_id: currentChatSessionId, role: role, content: content })
      .then(function (res) {
        if (res.error) throw res.error;
        return supabase
          .from('chat_sessions')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', currentChatSessionId);
      });
  }

  function recordUnitOpen(unitId) {
    var supabase = window.AppAuth.getClient();
    if (!supabase || !isLoggedIn()) return;
    supabase
      .from('user_progress')
      .upsert(
        { user_id: window.AppAuth.getUser().id, unit_id: unitId, opened_at: new Date().toISOString() },
        { onConflict: 'user_id,unit_id' }
      )
      .catch(function () {});
  }

  function renderUnits() {
    unitsContainer.innerHTML = '';
    if (!units.length) {
      unitsContainer.innerHTML = '<p>لا توجد وحدات.</p>';
      return;
    }
    units.forEach(function (unit) {
      var card = document.createElement('div');
      card.className = 'unit-card';
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');

      var title = document.createElement('h3');
      title.textContent = unit.title;

      var desc = document.createElement('p');
      desc.textContent = unit.description || '';

      var badge = document.createElement('span');
      badge.className = 'file-badge';
      badge.textContent = (unit.files ? unit.files.length : 0) + ' ملخص';

      card.appendChild(title);
      card.appendChild(desc);
      card.appendChild(badge);

      card.addEventListener('click', function () {
        openUnit(unit);
      });
      card.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openUnit(unit);
        }
      });

      unitsContainer.appendChild(card);
    });
  }

  function openUnit(unit) {
    var file = unit.files && unit.files.length ? unit.files[0] : null;
    if (!file) {
      showError('لا يوجد ملف لعرضه لهذه الوحدة.');
      return;
    }
    readerTitle.textContent = unit.title + (unit.description ? ' — ' + unit.description : '');
    currentFileUrl = file.path;
    pdfError.classList.add('hidden');
    pdfCanvas.classList.add('hidden');
    pdfControls.classList.add('hidden');
    pdfDownload.classList.add('hidden');
    if (pdfOpenOriginal) pdfOpenOriginal.classList.add('hidden');
    pdfProgress.classList.remove('hidden');
    pdfProgress.textContent = 'جاري تحميل الملف...';
    showView('reader');
    loadPdf(file.path);
    recordUnitOpen(unit.id);
  }

  function loadPdf(url) {
    if (!window.pdfjsLib) {
      pdfCanvas.classList.add('hidden');
      pdfProgress.classList.add('hidden');
      showError('متصفحك لا يدعم عرض الملفات هنا. استخدم زر "تحميل الملف" بالأسفل، أو حدّث المتصفح لنسخة أحدث.');
      showDownloadFallback(url);
      return;
    }

    window.pdfjsLib
      .getDocument(encodeURI(url))
      .promise.then(function (doc) {
        currentDoc = doc;
        currentPage = 1;
        pdfProgress.classList.add('hidden');
        pdfCanvas.classList.remove('hidden');
        pdfControls.classList.remove('hidden');
        pdfPrev.classList.remove('hidden');
        pdfNext.classList.remove('hidden');
        pdfPageInfo.classList.remove('hidden');
        setupFileLinks(url);
        renderPage();
      })
      .catch(function () {
        pdfCanvas.classList.add('hidden');
        pdfProgress.classList.add('hidden');
        showError('تعذر تحميل الملف. اضغط زر "تحميل الملف" بالأسفل لفتحه مباشرة.');
        showDownloadFallback(url);
      });
  }

  function showDownloadFallback(url) {
    pdfControls.classList.remove('hidden');
    pdfPrev.classList.add('hidden');
    pdfNext.classList.add('hidden');
    pdfPageInfo.classList.add('hidden');
    setupFileLinks(url);
  }

  function setupFileLinks(url) {
    var encoded = encodeURI(url);
    pdfDownload.href = encoded;
    pdfDownload.setAttribute('download', '');
    pdfDownload.classList.remove('hidden');
    if (pdfOpenOriginal) {
      pdfOpenOriginal.href = encoded;
      pdfOpenOriginal.classList.remove('hidden');
    }
  }

  function renderPage() {
    if (!currentDoc) return;
    var pageNum = currentPage;
    currentDoc.getPage(pageNum).then(function (page) {
      if (currentRenderTask) currentRenderTask.cancel();

      var wrapWidth = pdfCanvasWrap.clientWidth - 24;
      var wrapHeight = pdfCanvasWrap.clientHeight - 24;
      var dpr = window.devicePixelRatio || 1;

      var baseViewport = page.getViewport({ scale: 1 });
      var scale = Math.min(wrapWidth / baseViewport.width, wrapHeight / baseViewport.height);
      scale = Math.max(scale, 0.5);

      var cssViewport = page.getViewport({ scale: scale });
      var renderScale = scale * dpr;

      var renderViewport = page.getViewport({ scale: renderScale });

      pdfCanvas.style.width = Math.round(cssViewport.width) + 'px';
      pdfCanvas.style.height = Math.round(cssViewport.height) + 'px';
      pdfCanvas.width = Math.round(renderViewport.width);
      pdfCanvas.height = Math.round(renderViewport.height);

      var renderTask = page.render({
        canvasContext: pdfCanvas.getContext('2d'),
        viewport: renderViewport
      });
      currentRenderTask = renderTask;
      renderTask.promise.catch(function () {});

      pdfPageInfo.textContent = currentPage + ' / ' + currentDoc.numPages;
      pdfPrev.disabled = currentPage <= 1;
      pdfNext.disabled = currentPage >= currentDoc.numPages;
    });
  }

  function showError(msg) {
    pdfError.textContent = msg;
    pdfError.classList.remove('hidden');
    pdfCanvas.classList.add('hidden');
    showView('reader');
  }

  function addChatMessage(role, text) {
    var row = document.createElement('div');
    row.className = role === 'user' ? 'chat-msg user' : 'chat-msg bot';
    var p = document.createElement('p');
    p.textContent = text;
    row.appendChild(p);
    chatMessages.appendChild(row);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return row;
  }

  function showTyping() {
    var row = document.createElement('div');
    row.className = 'chat-msg bot typing';
    row.innerHTML = '<span></span><span></span><span></span>';
    chatMessages.appendChild(row);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return row;
  }

  function sendChat() {
    var text = chatInput.value.trim();
    if (!text) return;
    chatInput.value = '';
    addChatMessage('user', text);
    chatHistory.push({ role: 'user', content: text });
    saveChatMessage('user', text);

    var typingRow = showTyping();

    window.AppAuth.getSession().then(function (session) {
      var token = session && session.access_token ? session.access_token : '';
      fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token
        },
        body: JSON.stringify({ messages: chatHistory })
      })
        .then(function (res) {
          return res.json().then(function (data) {
            return { ok: res.ok, data: data };
          });
        })
        .then(function (result) {
          if (typingRow.parentNode) typingRow.parentNode.removeChild(typingRow);
          if (result.ok) {
            var reply =
              result.data.choices &&
              result.data.choices[0] &&
              result.data.choices[0].message
                ? result.data.choices[0].message.content
                : '';
            if (reply) {
              chatHistory.push({ role: 'assistant', content: reply });
              addChatMessage('bot', reply);
              saveChatMessage('assistant', reply);
            } else {
              addChatMessage('bot', 'لم أستطع توليد إجابة. حاول مرة أخرى.');
            }
          } else {
            addChatMessage('bot', result.data.error || 'حدث خطأ في الاتصال بالمدرس الذكي.');
          }
        })
        .catch(function (err) {
          if (typingRow.parentNode) typingRow.parentNode.removeChild(typingRow);
          addChatMessage('bot', 'تعذر الاتصال بالخادم: ' + err.message);
        });
    });
  }

  chatBtn.addEventListener('click', function () {
    requireAuth(function () {
      toggleChat(true);
    });
  });
  chatClose.addEventListener('click', function () {
    toggleChat(false);
  });
  chatForm.addEventListener('submit', function (e) {
    e.preventDefault();
    sendChat();
  });

  pdfPrev.addEventListener('click', function () {
    if (currentPage > 1) {
      currentPage--;
      renderPage();
    }
  });
  pdfNext.addEventListener('click', function () {
    if (currentDoc && currentPage < currentDoc.numPages) {
      currentPage++;
      renderPage();
    }
  });

  window.addEventListener('resize', function () {
    if (currentDoc) renderPage();
  });

  backBtn.addEventListener('click', function () {
    currentDoc = null;
    currentPage = 1;
    pdfCanvas.classList.add('hidden');
    pdfControls.classList.add('hidden');
    pdfProgress.classList.add('hidden');
    pdfError.classList.add('hidden');
    pdfDownload.classList.add('hidden');
    if (pdfOpenOriginal) pdfOpenOriginal.classList.add('hidden');
    showView('home');
  });

  // ============ Auth event binding ============

  function renderUnitsGated() {
    if (!isLoggedIn()) {
      var chip = document.getElementById('auth-user-chip');
      // Leave units visible (public summaries), but chat requires login.
      renderUnits();
      var banner = document.getElementById('login-gate-banner');
      if (!banner) {
        banner = document.createElement('div');
        banner.id = 'login-gate-banner';
        banner.className = 'gate-banner';
        banner.innerHTML =
          'سجّل الدخول لتفعيل المدرّس الذكي وحفظ تقدمك في الوحدات. ملخصات الوحدات متاحة للجميع.';
        unitsContainer.parentNode.insertBefore(banner, unitsContainer);
      }
      return;
    }
    var banner = document.getElementById('login-gate-banner');
    if (banner) banner.remove();
    renderUnits();
  }

  authBtn.addEventListener('click', function () {
    if (authBtn.dataset.action === 'logout') {
      window.AppAuth.signOut().then(function () {
        currentChatSessionId = null;
        chatHistory = [];
        renderAuthUI();
        renderUnitsGated();
        updateChatGate();
        var messagesEl = document.getElementById('chat-messages');
        if (messagesEl) {
          messagesEl.innerHTML =
            '<div class="chat-msg bot"><p>مرحباً! أنا المدرس الذكي. اسألني عن أي سؤال في الفيزياء أو الكيمياء.</p></div>';
        }
      });
    } else {
      openAuthModal('login');
    }
  });

  authModalClose.addEventListener('click', closeAuthModal);
  authModal.addEventListener('click', function (e) {
    if (e.target === authModal) closeAuthModal();
  });
  authForm.addEventListener('submit', handleAuthSubmit);
  authGoogle.addEventListener('click', handleGoogleSignIn);
  authSwitchBtn.addEventListener('click', function () {
    openAuthModal(isAuthMode ? 'login' : 'signup');
  });
  var chatGateLogin = document.getElementById('chat-gate-login');
  if (chatGateLogin) {
    chatGateLogin.addEventListener('click', function () {
      openAuthModal('login');
    });
  }

  // ============ Boot ============

  if (window.AppAuth) {
    window.AppAuth.onReady(function () {
      renderAuthUI();
      renderUnitsGated();
      updateChatGate();
      if (isLoggedIn()) loadLatestSession();
    });
    window.AppAuth.onAuth(function () {
      renderAuthUI();
      renderUnitsGated();
      updateChatGate();
      if (isLoggedIn() && !currentChatSessionId) loadLatestSession();
    });
  }

  fetch('units.json')
    .then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    })
    .then(function (data) {
      units = data.units || [];
      renderUnitsGated();
    })
    .catch(function (err) {
      unitsContainer.innerHTML = '<p>تعذر تحميل ملف البيانات: ' + err.message + '</p>';
    });
})();
