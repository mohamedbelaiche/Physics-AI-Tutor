/* public/slides-player.js
 * مشغّل الشرائح التفاعلية لمسار الكورسات.
 * - يحمّل deck الكورس من public/course/slides/<slug>/index.json (يوجد أم لا).
 * - يعرض شريحة واحدة في كل مرة لأقسام الدرس المختارة، عبر واجهة window.MdRender.
 * - المشاهد SVG تُعرض عبر <img> (SMIL ذاتي الاكتفاء) مع إعادة تشغيل وخطوات توضيحية.
 * - يُستدعى من course.js عند تفعيل مبدّل «النص | الشرائح التفاعلية».
 */
(function () {
  'use strict';

  var decks = {};      // > slug -> deck object | null
  var current = {
    slug: null,
    sectionIdx: 0,
    slideIdx: 0,
    container: null,
    card: null,
    deck: null
  };
  var slideProgressHandler = null;

  function cacheBust(url) {
    return url + (url.indexOf('?') === -1 ? '?' : '&') + 'r=' + Date.now();
  }

  /* ---------- تحميل deck ---------- */

  function loadDeck(slug) {
    if (slug in decks) return Promise.resolve(decks[slug]);
    return fetch('course/slides/' + encodeURIComponent(slug) + '/index.json')
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        decks[slug] = (data && data.version === 1 && Array.isArray(data.sections)) ? data : null;
        return decks[slug];
      })
      .catch(function () {
        decks[slug] = null;
        return null;
      });
  }

  function hasDeck(slug) {
    return decks[slug] ? true : false;
  }

  /* ---------- ملاءمة الشريحة للشاشة ---------- */

  // في الوضع الموسّع يجب أن تظهر الشريحة كاملة على الشاشة بلا نزول. نقيس
  // فيضَ محتوى جسم الشريحة (scroll*) وما يتّسع له داخل الشاشة
  // (client*) فنصغّر المحتوى بمقدار النقص فنضبط الشريحة. 0.55 حدّ أدنى:
  // نصٌّ أطول من أن يبقى مقروءًا مصغّرًا يظلّ قابلًا للتمرير (وهو ما يبقى
  // فعّالًا في .slides-wrap) بدل أن يصير غير مقروء. الصنف على body هو مصدر
  // الحقيقة الوحيد، فيتبع القياسُ حالةَ الوضع كما هي بعد أي إعادة رسم.
  var MIN_FIT_SCALE = 0.55;

  function slidesAreExpanded() {
    return !!(document.body && document.body.classList &&
      document.body.classList.contains('slides-focus'));
  }

  function fitCard() {
    var card = current.card;
    if (!card || !card.querySelector) return;
    var slideBody = card.querySelector('.slides-body');
    if (!slideBody || !slideBody.style) return;
    // نبدأ من الحجم الطبيعي: التحويل لا يغيّر التخطيط، فالقياس لا يتأثر
    // به، فيمكن إعادة الحساب في أي وقت (شريحة جديدة، تكبير، تغيير حجم).
    slideBody.style.transform = '';
    slideBody.style.transformOrigin = '';
    if (!slidesAreExpanded()) return;
    var scale = fitRatio(slideBody);
    // بلا قياس صالح نترك CSS يقرر: التمرير صمّام أمان لا سلوك معتاد.
    if (!(scale > 0) || scale >= 1) return;
    var applied = Math.max(MIN_FIT_SCALE, scale);
    slideBody.style.transformOrigin = 'top center';
    slideBody.style.transform = 'scale(' + (Math.round(applied * 1000) / 1000) + ')';
  }

  // أصغر نسبة فيضٍ على محورَين لهما قياس صالح، أو 0 إن لا قياس أصلًا.
  // المحوران معًا: بالارتفاع وحده يفيض النص الطويل، وبالعرض وحده يُقصّ
  // المحتوى العريض (جدولٌ عريض، مشهدٌ بعرض ثابت) جانبيًا. محورٌ بلا قياس
  // (0) لا يُحتسب، فلا يُسقط قياسًا صحيحًا للآخر.
  function fitRatio(box) {
    var ratios = [];
    var roomH = Number(box.clientHeight) || 0;
    var naturalH = Number(box.scrollHeight) || 0;
    if (roomH > 0 && naturalH > 0) ratios.push(roomH / naturalH);
    var roomW = Number(box.clientWidth) || 0;
    var naturalW = Number(box.scrollWidth) || 0;
    if (roomW > 0 && naturalW > 0) ratios.push(roomW / naturalW);
    if (!ratios.length) return 0;
    return Math.min.apply(null, ratios);
  }

  // المساحة المتاحة تتغيّر بأشياء لا تُطلق حدث نافذة: فتح لوحة المحادثة،
  // انطواء شريط المتصفح على الجوال، تبديل الأدوات. نراقب صندوق الشريحة
  // فنعيد القياس عند كل تغيّر. التحويل لا يغيّر التخطيط، فلا حلقة لا نهائية.
  var slideResizeObserver = null;

  function observeSlideBody(card) {
    if (typeof window === 'undefined' || typeof window.ResizeObserver !== 'function') return;
    if (slideResizeObserver) slideResizeObserver.disconnect();
    slideResizeObserver = new window.ResizeObserver(function () {
      fitCard();
    });
    var slideBody = card && card.querySelector ? card.querySelector('.slides-body') : null;
    if (slideBody) slideResizeObserver.observe(slideBody);
  }

  /* ---------- بناء DOM شريحة ---------- */

  function buildSlideCard(deck) {
    var section = deck.sections[current.sectionIdx];
    var slide = section && section.slides[current.slideIdx] ? section.slides[current.slideIdx] : null;
    if (!slide) return;

    var wrap = document.createElement('div');
    wrap.className = 'slides-wrap';
    wrap.setAttribute('dir', 'rtl');

    var top = document.createElement('div');
    top.className = 'slides-top';

    var counter = document.createElement('span');
    counter.className = 'slides-counter';
    counter.textContent = 'شريحة ' + (current.slideIdx + 1) + ' من ' + section.slides.length;
    top.appendChild(counter);

    var title = document.createElement('h3');
    title.className = 'slides-title';
    title.textContent = slide.title || section.title;
    top.appendChild(title);
    wrap.appendChild(top);

    var body = document.createElement('div');
    body.className = 'slides-body ' + (slide.layout === 'two-col' ? 'two-col' : 'full');

    if (slide.text_md) {
      var text = document.createElement('div');
      text.className = 'slides-text';
      text.innerHTML = window.MdRender.renderMarkdownContent(slide.text_md);
      body.appendChild(text);
    }

    if (slide.scene && slide.scene.svg) {
      var scene = document.createElement('div');
      scene.className = 'slides-scene';
      /* SVG تُحمَّل عبر <img> حفاظًا على SMIL وتفعيل العزل عن أنماط الصفحة. */
      var img = document.createElement('img');
      img.className = 'slides-scene-img';
      img.src = 'course/slides/' + encodeURIComponent(current.slug) + '/' + slide.scene.svg;
      img.alt = slide.scene.alt || 'مشهد تفاعلي';
      img.setAttribute('role', 'img');
      img.loading = 'lazy';
      // المشهد يصل بعد الرسم، فحتى بلوغه لا يُعرف ارتفاعه الحقيقي: نعيد
      // الملاءمة عند وصوله، وإلا بقيت الشريحة تفيض بلا سبب.
      img.addEventListener('load', fitCard);

      var actions = document.createElement('div');
      actions.className = 'slides-scene-actions';
      var replay = document.createElement('button');
      replay.className = 'nav-btn';
      replay.setAttribute('type', 'button');
      replay.textContent = '↻ إعادة الحركة';
      replay.addEventListener('click', function () {
        img.src = cacheBust('course/slides/' + encodeURIComponent(current.slug) + '/' + slide.scene.svg);
      });
      actions.appendChild(replay);

      scene.appendChild(img);
      scene.appendChild(actions);

      if (slide.scene.steps && slide.scene.steps.length) {
        var stepsList = document.createElement('ol');
        stepsList.className = 'slides-steps';
        slide.scene.steps.forEach(function (s) {
          var li = document.createElement('li');
          li.textContent = s;
          stepsList.appendChild(li);
        });
        scene.appendChild(stepsList);
      }

      body.appendChild(scene);
    }

    wrap.appendChild(body);

    var nav = document.createElement('div');
    nav.className = 'slides-nav';

    var prev = document.createElement('button');
    prev.className = 'nav-btn';
    prev.setAttribute('type', 'button');
    prev.textContent = '→ السابقة';
    prev.disabled = current.slideIdx === 0;
    prev.addEventListener('click', function () {
      current.slideIdx--;
      renderCard(deck);
    });
    nav.appendChild(prev);

    var spacer = document.createElement('span');
    spacer.style.flex = '1';
    nav.appendChild(spacer);

    var next = document.createElement('button');
    next.className = 'nav-btn primary';
    next.setAttribute('type', 'button');
    var last = current.slideIdx >= section.slides.length - 1;
    next.textContent = last ? 'نهاية قسم ✓' : 'التالي ←';
    next.addEventListener('click', function () {
      if (last) {
        current.sectionIdx++;
        current.slideIdx = 0;
        renderCard(deck);
      } else {
        current.slideIdx++;
        renderCard(deck);
      }
    });
    nav.appendChild(next);

    wrap.appendChild(nav);
    return wrap;
  }

  function renderCard(deck) {
    if (!current.container || !deck) return;
    var section = deck.sections[current.sectionIdx];
    var slide = section && section.slides[current.slideIdx] ? section.slides[current.slideIdx] : null;
    current.container.innerHTML = '';
    current.card = null;
    var card = buildSlideCard(deck);
    if (!card) {
      current.container.innerHTML = '<p>لا توجد شرائح لهذا القسم.</p>';
      return;
    }
    current.card = card;
    current.container.appendChild(card);

    // كل شريحة تُعرض تُبلَّغ كمقطع/جزء مكتمل (يستخدمه course.js لحفظ التقدم والموقع).
    if (slideProgressHandler && slide && slide.id) {
      slideProgressHandler(current.sectionIdx, current.slideIdx, slide.id);
    }

    // في الوضع العادي الشريحة جزءٌ من صفحة أطول فالتمرير إليها سلوك مقصود.
    // في الوضع الموسّع البطاقة هي الشاشة نفسها: scrollIntoView يزيح موضع
    // التمرير عن الملاءمة التي بُنيت عليه توًّا فيكشف فجوة أسفل الشريحة.
    if (!slidesAreExpanded() && current.container.scrollIntoView) {
      current.container.scrollIntoView({ block: 'start' });
    }
    observeSlideBody(card);
    fitCard();
  }

  /* ---------- واجهة عامة ---------- */

  /* يعرض شرائح قسم معيّن (index صفري) داخل الحاوية المرسلة.
   * initialSlide: فهرس شريحة بداية غير الصفر (لاستئناف الموقع المحفوظ). */
  function playSection(container, slug, sectionIdx, initialSlide) {
    current.container = container;
    current.slug = slug;
    current.sectionIdx = sectionIdx;
    current.slideIdx = 0;
    var deck = decks[slug];
    if (!deck) {
      container.innerHTML = '<p>لا تتوفر شرائح لهذا الكورس.</p>';
      return;
    }
    var section = deck.sections[sectionIdx];
    if (!section || !section.slides.length) {
      container.innerHTML = '<p>لا توجد شرائح لهذا القسم.</p>';
      return;
    }
    if (initialSlide != null) {
      current.slideIdx = Math.max(0, Math.min(Number(initialSlide) || 0, section.slides.length - 1));
    }
    renderCard(deck);
  }

  /* يُعيد عرض الشريحة من أول القسم الحالي (يُستدعى عند عودة للقسم). */
  function reset() {
    current.slideIdx = 0;
  }

  /* الموقع الحالي { sectionIdx, slideIdx } — يستخدمه course.js لحفظ الاستئناف. */
  function getPos() {
    return { sectionIdx: current.sectionIdx, slideIdx: current.slideIdx };
  }

  /* إعادة ملاءمة الشريحة المعروضة للشاشة — يستدعيها course.js بعد تبديل
     وضع التوسيع، حين تتغيّر مقاسات الشريحة ولا تُعاد رسمها. */
  function refit() {
    fitCard();
  }

  // تغيّر حجم النافذة يغيّر المتاح: نعيد القياس. وكذلك اكتمال تحميل الخطوط
  // (ارتفاع الأسطر يتبدّل) وبلوغ المشهد.
  if (typeof window !== 'undefined' && window.addEventListener) {
    window.addEventListener('resize', fitCard);
  }
  if (document.fonts && document.fonts.ready &&
      typeof document.fonts.ready.then === 'function') {
    document.fonts.ready.then(fitCard, function () {});
  }

  /* مسجّل تقدم: fn(sectionIdx, slideIdx, slideId) يُستدعى عند كل شريحة تُعرض. */
  function setSlideProgressHandler(fn) {
    slideProgressHandler = typeof fn === 'function' ? fn : null;
  }

  window.SlidesPlayer = {
    loadDeck: loadDeck,
    hasDeck: hasDeck,
    playSection: playSection,
    reset: reset,
    getPos: getPos,
    refit: refit,
    setSlideProgressHandler: setSlideProgressHandler
  };
})();