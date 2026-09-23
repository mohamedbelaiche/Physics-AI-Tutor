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
    var card = buildSlideCard(deck);
    if (!card) {
      current.container.innerHTML = '<p>لا توجد شرائح لهذا القسم.</p>';
      return;
    }
    current.container.appendChild(card);

    // كل شريحة تُعرض تُبلَّغ كمقطع/جزء مكتمل (يستخدمه course.js لحفظ التقدم والموقع).
    if (slideProgressHandler && slide && slide.id) {
      slideProgressHandler(current.sectionIdx, current.slideIdx, slide.id);
    }

    current.container.scrollIntoView({ block: 'start' });
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
    setSlideProgressHandler: setSlideProgressHandler
  };
})();