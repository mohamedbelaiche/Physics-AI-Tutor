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

  var units = [];
  var chatHistory = [];

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

    var typingRow = showTyping();

    fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
  }

  chatBtn.addEventListener('click', function () {
    toggleChat(true);
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

  fetch('units.json')
    .then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    })
    .then(function (data) {
      units = data.units || [];
      renderUnits();
    })
    .catch(function (err) {
      unitsContainer.innerHTML = '<p>تعذر تحميل ملف البيانات: ' + err.message + '</p>';
    });
})();
