(function () {
  var homeView = document.getElementById('home-view');
  var readerView = document.getElementById('reader-view');
  var unitsContainer = document.getElementById('units-container');
  var backBtn = document.getElementById('back-btn');
  var readerTitle = document.getElementById('reader-title');
  var pdfFrame = document.getElementById('pdf-frame');
  var pdfError = document.getElementById('pdf-error');

  var chatBtn = document.getElementById('chat-btn');
  var chatPanel = document.getElementById('chat-panel');
  var chatClose = document.getElementById('chat-close');
  var chatForm = document.getElementById('chat-form');
  var chatInput = document.getElementById('chat-input');
  var chatMessages = document.getElementById('chat-messages');

  var units = [];
  var chatHistory = [];

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
    pdfFrame.src = file.path;
    pdfError.classList.add('hidden');
    pdfFrame.classList.remove('hidden');
    showView('reader');
  }

  function showError(msg) {
    pdfError.textContent = msg;
    pdfError.classList.remove('hidden');
    pdfFrame.classList.add('hidden');
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

  backBtn.addEventListener('click', function () {
    pdfFrame.src = '';
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
