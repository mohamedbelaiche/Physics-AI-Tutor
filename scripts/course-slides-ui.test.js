const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function createHarness(options) {
  const settings = options || {};
  const listeners = new Map();
  const storage = new Map();
  const postedPositions = [];
  if (settings.savedPosition) {
    storage.set('course_positions.v1', JSON.stringify({
      [settings.savedPosition.course_id]: settings.savedPosition
    }));
  }

  class FakeClassList {
    constructor(initial) {
      this.values = new Set(initial || []);
    }

    add(name) {
      this.values.add(name);
    }

    remove(name) {
      this.values.delete(name);
    }

    contains(name) {
      return this.values.has(name);
    }

    toggle(name, force) {
      const next = force === undefined ? !this.values.has(name) : force;
      if (next) this.values.add(name);
      else this.values.delete(name);
      return next;
    }
  }

  class FakeElement {
    constructor(id, initialClasses) {
      this.id = id;
      this.classList = new FakeClassList(initialClasses);
      this.style = {};
      this.textContent = '';
      this._innerHTML = '';
      this.disabled = false;
      this.attributes = {};
      this.children = [];
      this.parent = null;
      this.eventListeners = new Map();
      this.scrollIntoViewCalls = 0;
    }

    get innerHTML() {
      return this._innerHTML;
    }

    // كما في DOM الحقيقي: تعيين innerHTML يزيل الأبناء السابقين.
    set innerHTML(value) {
      this._innerHTML = String(value);
      if (value === '') {
        this.children.slice().forEach((child) => { child.remove(); });
      }
    }

    appendChild(child) {
      this.children.push(child);
      child.parent = this;
      return child;
    }

    insertBefore(child) {
      this.children.unshift(child);
      child.parent = this;
      return child;
    }

    remove() {
      if (!this.parent) return;
      const idx = this.parent.children.indexOf(this);
      if (idx !== -1) this.parent.children.splice(idx, 1);
      this.parent = null;
    }

    querySelector(selector) {
      if (selector.charAt(0) === '.') {
        const name = selector.slice(1);
        for (const child of this.children) {
          if (child.classList.contains(name)) return child;
        }
      }
      return null;
    }

    addEventListener(type, handler) {
      const handlers = this.eventListeners.get(type) || [];
      handlers.push(handler);
      this.eventListeners.set(type, handlers);
    }

    dispatchEvent(event) {
      const handlers = this.eventListeners.get(event.type) || [];
      handlers.slice().forEach((handler) => handler.call(this, event));
      return true;
    }

    click() {
      this.dispatchEvent({ type: 'click', target: this, currentTarget: this });
    }

    setAttribute(name, value) {
      this.attributes[name] = String(value);
    }

    getAttribute(name) {
      return Object.prototype.hasOwnProperty.call(this.attributes, name) ? this.attributes[name] : null;
    }

    get className() {
      return Array.from(this.classList.values).join(' ');
    }

    set className(value) {
      this.classList.values = new Set(String(value).split(/\s+/).filter(Boolean));
    }

    // قياسات التخطيط: test harness لا يملك محرّك تخطيط، فيُلقن كل عنصر بأبعاد
    // map حسب أصنافه (settings.layout) لإثارة مسارات القياس في slides-player.
    layoutBox() {
      const layout = this.harnessLayout || {};
      for (const name of this.classList.values) {
        if (layout[name]) return layout[name];
      }
      return null;
    }

    get clientHeight() {
      const box = this.layoutBox();
      return box && typeof box.clientHeight === 'number' ? box.clientHeight : 0;
    }

    get scrollHeight() {
      const box = this.layoutBox();
      return box && typeof box.scrollHeight === 'number' ? box.scrollHeight : 0;
    }

    get clientWidth() {
      const box = this.layoutBox();
      return box && typeof box.clientWidth === 'number' ? box.clientWidth : 0;
    }

    get scrollWidth() {
      const box = this.layoutBox();
      return box && typeof box.scrollWidth === 'number' ? box.scrollWidth : 0;
    }

    scrollIntoView() {
      this.scrollIntoViewCalls += 1;
    }
  }

  // كل عنصر يعرف قياسات التخطيط التي يلقنها له الاختبار.
  FakeElement.prototype.harnessLayout = settings.layout || {};

  const body = new FakeElement('body');
  const elements = new Map();
  const initialClasses = {
    'course-lesson-view': ['hidden'],
    'lesson-presentation-controls': ['hidden'],
    'course-lesson-mode': ['hidden'],
    'slides-expand-btn': ['hidden']
  };
  const ids = [
    'summaries-group',
    'courses-group',
    'tab-summaries',
    'tab-courses',
    'course-dashboard-view',
    'course-lesson-view',
    'course-cards',
    'course-overall-wrap',
    'course-overall-count',
    'course-overall-fill',
    'course-gate',
    'course-lesson-back',
    'course-lesson-head',
    'course-lesson-body',
    'course-lesson-nav',
    'lesson-presentation-controls',
    'course-lesson-mode',
    'mode-text',
    'mode-slides',
    'course-sections-bar',
    'slides-expand-btn'
  ];

  ids.forEach((id) => {
    elements.set(id, new FakeElement(id, initialClasses[id] || []));
  });
  elements.get('mode-text').setAttribute('aria-selected', 'true');
  elements.get('mode-slides').setAttribute('aria-selected', 'false');

  const documentListeners = new Map();
  const document = {
    readyState: 'complete',
    visibilityState: 'visible',
    body,
    getElementById(id) {
      return elements.get(id) || null;
    },
    createElement() {
      return new FakeElement('created');
    },
    addEventListener(type, handler) {
      const handlers = documentListeners.get(type) || [];
      handlers.push(handler);
      documentListeners.set(type, handlers);
    },
    dispatchEvent(event) {
      const handlers = documentListeners.get(event.type) || [];
      handlers.slice().forEach((handler) => handler.call(document, event));
      return true;
    }
  };

  // Expansion is a CSS class on body alone, so the harness never stubs
  // requestFullscreen/exitFullscreen: the suite runs in a browser-like context
  // that simply has no Fullscreen API, which is the behaviour we depend on.
  body.document = document;
  elements.forEach((element) => {
    element.document = document;
  });

  const fetch = (url, options) => {
    const href = String(url);
    if (href.indexOf('course/slides/') === 0) {
      if (settings.deckAvailable === false) {
        return Promise.resolve({
          ok: false,
          status: 404,
          json() {
            return Promise.resolve({});
          }
        });
      }
      return Promise.resolve({
        ok: true,
        json() {
          return Promise.resolve(settings.deck || {
            version: 1,
            sections: [{
              title: 'Section',
              slides: [{
                id: 'slide-1',
                title: 'Slide',
                text_md: 'نص الشريحة الأولى',
                scene: { svg: 'scene-01.svg', alt: 'مشهد ١', steps: ['خطوة أولى', 'خطوة ثانية'] }
              }]
            }]
          });
        }
      });
    }
    if (href === 'course/course.json') {
      return Promise.resolve({
        ok: true,
        json() {
          const courses = settings.courses || (settings.course ? [settings.course] : []);
          return Promise.resolve({ courses: courses });
        }
      });
    }
    if (href === '/api/course/progress') {
      if (options && options.method === 'POST') {
        const body = JSON.parse(options.body || '{}');
        if (body.position) postedPositions.push(body.position);
        return Promise.resolve({
          ok: true,
          json() {
            return Promise.resolve({
              courses: [{ id: body.course_id, completed: true }]
            });
          }
        });
      }
      return Promise.resolve({
        ok: true,
        json() {
          return Promise.resolve(settings.progress || { completedCount: 0, total: 0, courses: [] });
        }
      });
    }
    return Promise.resolve({
      ok: true,
      json() {
        return Promise.resolve({});
      }
    });
  };

  // ResizeObserver: المشغّل يراقب صندوق الشريحة، فقِس تغيّره لا تغيّر النافذة
  // فقط (لوحة المحادثة، شريط المتصفح على الجوال، تبديل الأدوات). harness يجد
  // مَن مرصود فـtriggerResize يطلق الاستدعاء كما يفعل المتصفح.
  const observedTargets = [];
  const resizeCallbacks = [];
  class FakeResizeObserver {
    constructor(callback) {
      this.callback = callback;
      resizeCallbacks.push(callback);
    }

    observe(target) {
      observedTargets.push(target);
    }

    unobserve() {}

    disconnect() {}
  }

  const window = {
    fetch,
    scrollTo() {},
    ResizeObserver: FakeResizeObserver,
    addEventListener(type, handler) {
      const handlers = listeners.get(type) || [];
      handlers.push(handler);
      listeners.set(type, handlers);
    },
    MdRender: {
      renderMarkdownContent(md) {
        return '<p>' + String(md) + '</p>';
      }
    }
  };

  if (settings.loggedIn === true) {
    window.AppAuth = {
      getUser() {
        return { id: 'user-1' };
      },
      getSession() {
        return Promise.resolve({ access_token: 'token-1' });
      },
      onAuth() {}
    };
  }

  const context = vm.createContext({
    window,
    document,
    fetch,
    localStorage: {
      getItem(key) {
        return storage.has(key) ? storage.get(key) : null;
      },
      setItem(key, value) {
        storage.set(key, value);
      },
      removeItem(key) {
        storage.delete(key);
      }
    },
    console,
    setTimeout,
    clearTimeout
  });

  const slidePlayerSource = fs.readFileSync(path.join(__dirname, '..', 'public', 'slides-player.js'), 'utf8');
  vm.runInContext(slidePlayerSource, context, { filename: 'public/slides-player.js' });

  if (settings.deckLoadRejects === true) {
    window.SlidesPlayer.loadDeck = function () {
      return Promise.reject(new Error('Deck load failed'));
    };
  }
  if (settings.deckLoadPending === true) {
    window.SlidesPlayer.loadDeck = function () {
      return new Promise(function () {});
    };
  }

  const source = fs.readFileSync(path.join(__dirname, '..', 'public', 'course.js'), 'utf8');
  vm.runInContext(source, context, { filename: 'public/course.js' });

  function dispatchWindow(type) {
    const handlers = listeners.get(type) || [];
    handlers.slice().forEach((handler) => handler.call(window, { type }));
  }

  // يطلق ResizeObserver كما لو تغيّر حجم الصندوق المرصود (لا حدث نافذة).
  function triggerResize() {
    resizeCallbacks.forEach(function (callback) {
      callback([], null);
    });
  }

  return {
    context,
    document,
    elements,
    body,
    storage,
    postedPositions,
    dispatchWindow,
    observedTargets,
    triggerResize
  };
}

function makeCourse(overrides) {
  return Object.assign({
    id: 'unit-01',
    slug: 'unit-01',
    order: 1,
    title_ar: 'كورس تجريبي',
    description: 'وصف',
    skills: [],
    sections: [{ num: 1, title: 'المقطع الأول', content_md: 'نص المقطع' }]
  }, overrides || {});
}

function flushAsyncWork() {
  return new Promise((resolve) => setImmediate(resolve));
}

// يقتطع كتلة تعريف مُحدَّد من style.css. المُحدَّد مثبَّت في بداية السطر حتى
// لا تلتقط قاعدة أعمق (مثل ".slides-text" داخل "…two-col .slides-text").
function cssBlock(css, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const open = new RegExp('^' + escaped + '\\s*\\{', 'm').exec(css);
  assert.notEqual(open, null, 'public/style.css must contain a rule for "' + selector + '"');
  const start = css.indexOf('{', open.index);
  const close = css.indexOf('\n}', start);
  assert.notEqual(close, -1, 'rule "' + selector + '" must close its block');
  return css.slice(start, close);
}

test('the design tokens the whole theme depends on are defined once', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'public', 'style.css'), 'utf8');
  const root = cssBlock(css, ':root');

  // هذه الرموز هي أساس المظهر الجديد: حذفها يكسر الألوان والظلال والقياس.
  [
    '--font', '--ink', '--muted', '--line', '--surface', '--canvas',
    '--brand', '--brand-dark', '--brand-tint', '--accent', '--accent-tint',
    '--success', '--success-tint', '--on-brand',
    '--r-sm', '--r-md', '--r-lg', '--r-xl', '--r-pill',
    '--shadow-sm', '--shadow-md', '--shadow-lg',
    '--shell', '--measure'
  ].forEach((token) => {
    assert.match(root, new RegExp(token + ':'), ':root must define ' + token);
  });

  // الخط العربي أولًا في المكدس، مع بديل نظامي إن تعذّر تحميله.
  assert.match(root, /--font:\s*'Cairo'/);
  assert.match(root, /Tahoma/);
});

test('every unit number gets a generated cover, so no image file is needed', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'public', 'style.css'), 'utf8');

  // الأغلفة مولَّدة داخل CSS: إن غاب أي رقم فبقيت البطاقة بلا هوية بصرية.
  for (let unit = 1; unit <= 5; unit += 1) {
    const cover = cssBlock(css, '.course-card[data-unit="' + unit + '"] .course-card-cover');
    assert.match(cover, /background-image:\s*url\("data:image\/svg\+xml,/, 'unit ' + unit + ' needs a cover');
    // محرف # داخل data-URI يجب أن يبقى مُرمَّزًا، وإلا انقطع التدرّج.
    assert.doesNotMatch(cover, /stop-color='#/, 'unit ' + unit + ' must encode # as %23');
    assert.match(cover, /stop-color='%23/, 'unit ' + unit + ' must encode # as %23');
  }
});

test('the slide controls markup matches the ids course.js looks up', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
  [
    'lesson-presentation-controls',
    'course-lesson-mode',
    'mode-text',
    'mode-slides',
    'slides-expand-btn',
    'course-lesson-view',
    'course-lesson-body',
    'course-lesson-nav'
  ].forEach((id) => {
    assert.equal(
      new RegExp('id="' + id + '"').test(html),
      true,
      'public/index.html must keep id="' + id + '"'
    );
  });
});

test('the slide card defines a proportional safe area for every screen size', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'public', 'style.css'), 'utf8');
  const wrap = cssBlock(css, '.slides-wrap');

  // المسافة من الحواف تتنفّس مع الشاشة (vw أفقيًا، vh رأسيًا) لا بقيم ثابتة.
  assert.match(wrap, /--slide-safe-inline:\s*clamp\([^)]*vw[^)]*\)/);
  assert.match(wrap, /--slide-safe-block:\s*clamp\([^)]*vh[^)]*\)/);

  // عمود مريح متمركز: سقف بالبكسل + نسبي صغير، فلا يستفيض ولا يتضيق.
  assert.match(wrap, /max-width:\s*min\(\s*\d+px\s*,\s*100%\s*\)/);
  assert.match(wrap, /margin-inline:\s*auto/);
  assert.match(wrap, /padding-inline:\s*var\(--slide-safe-inline\)/);
  assert.match(wrap, /padding-block:\s*var\(--slide-safe-block\)/);
});

test('the expanded slide layout does not zero the content padding', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'public', 'style.css'), 'utf8');
  const container = cssBlock(css, 'body.slides-focus .course-content.slides-mode');

  // هذا هو سبب ظهور النص في الحواف: تصفير الحشوة مع max-width: none ترك
  // عمود النص بلا أي احتواء، فامتد على كامل عرض الشاشة.
  assert.doesNotMatch(container, /padding:\s*0\b/);
  assert.doesNotMatch(container, /max-width:\s*none\b/);
});

test('the expanded slide chain shares one screen instead of stacking full screens', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'public', 'style.css'), 'utf8');

  // كل مستوى كان يحمل min-height: 100dvh، والبطاقة نفسها 100dvh داخل حشوة
  // وأدوات عرض: فيصير المجموع أطول من الشاشة بقليل، فيخرج شريط «التالي»
  // (الملتصق بأسفل البطاقة) تحت حافة الشاشة ولا يمكن الوصول إليه أصلًا
  // (الجسم overflow: hidden). الحل: مستوى واحد فقط يحمل الشاشة، والباقي
  // يقسمها؛ حشوة الحاوية وحدها تكفي للاحتواء.
  const wrap = cssBlock(css, 'body.slides-focus .slides-wrap');
  assert.doesNotMatch(wrap, /min-height:\s*100dvh/);
  assert.match(wrap, /min-height:\s*0\b/);
  assert.match(wrap, /flex:\s*1\b/);

  // الحاوية تأخذ المتبقّي بعد شريط التنقّل بين المقاطع، لا شاشة كاملة زائدة.
  const container = cssBlock(css, 'body.slides-focus .course-content.slides-mode');
  assert.doesNotMatch(container, /min-height:\s*100dvh/);
  assert.match(container, /min-height:\s*0\b/);
  assert.match(container, /flex:\s*1\b/);
});

test('the slide body may shrink below its content so it can be measured', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'public', 'style.css'), 'utf8');
  const body = cssBlock(css, '.slides-wrap > .slides-body');

  // min-height:auto في عنصر flex يجعل الصندوق أطول من محتواه، فلا ينكمش ولا
  // يُقاس: يفيض النص خارجًا ويُطلب التمرير. min-height:0 يجعل صندوق الجسم
  // هو المساحة المتاحة بالضبط (clientHeight) فيقاس الفيض (scrollHeight)
  // وتُبنى عليه ملاءمة الشريحة للشاشة.
  assert.match(body, /flex:\s*1\b/);
  assert.match(body, /min-height:\s*0\b/);
});

test('the expanded slide reserves room for the floating controls only at the top', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'public', 'style.css'), 'utf8');
  const wrap = cssBlock(css, 'body.slides-focus .slides-wrap');

  // الأدوات العائمة فوق البطاقة تستحق حيّزًا أعلىها فقط؛ الحيّز الأسفل
  // كان يهدر مساحة الشاشة ويبعد شريط التنقّل عن الحواف.
  assert.match(wrap, /padding-block:\s*var\(--slide-controls-h\)\s+0/);
});

test('slide prose keeps a proportional reading measure', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'public', 'style.css'), 'utf8');
  const text = cssBlock(css, '.slides-text');

  // 68ch يتبع حجم الخط ولغة النص، فلا يطول السطر مع كبر الشاشة ولا يقصّ.
  assert.match(text, /max-width:\s*\d+ch/);
  assert.match(text, /line-height:\s*1\.[6-9]/);
});

test('display equations keep the fraction bars that overflow their box', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'public', 'style.css'), 'utf8');

  // صندوق ‎.katex-display‎ يُقاس على ‎.katex-html‎، فيرسم الكسرُ أطرافَه فوق
  // الصندوق وتحتَه. ومع ‎overflow-y:hidden‎ يُمحى ذلك الحبر ولا يُرى: قِسناه
  // 13px في 177 شريحة، و125 صندوقًا من 125 يفيض رأسيًا. حدُّ القصّ عند حدّ
  // الحشو، فكلما اتّسع الحشو اقترّب الحدّ من الحبر. فنتحقّق أن القواعد الثلاث
  // تُعطيه.
  const RULES = ['.chat-msg .katex-display', '.course-content .katex-display', '.slides-text .katex-display'];
  RULES.forEach((sel) => {
    const rule = cssBlock(css, sel);
    const pad = /padding:\s*([\d.]+)(em|rem|px)\s+(?:0|auto)\s*;/.exec(rule);
    assert.notEqual(
      pad, null,
      sel + ' must pad the box vertically, or overflow-y:hidden clips the fraction bars'
    );
    assert.notEqual(
      pad[2], 'px',
      sel + ' must express the padding in em so it keeps tracking the font size'
    );
  });

  // ولا نصلحه ‎overflow-y:visible‎: حين يكون المحور الآخر ‎auto‎ يصير
  // ‎visible‎ هو ‎auto‎، فيظهر شريط تمرير عمودي على كل معادلة. جرّبنا
  // ‎overflow-clip-margin‎ فلم ينفع هنا. فالحشو هو الحلّ وحده.
  RULES.forEach((sel) => {
    assert.doesNotMatch(
      cssBlock(css, sel), /overflow-y:\s*visible/,
      sel + ' must not use overflow-y:visible — it makes every equation scroll vertically'
    );
  });
});

test('a scene is not shrunk twice in the expanded slide', async () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'public', 'style.css'), 'utf8');
  const scene = cssBlock(css, 'body.slides-focus .slides-scene-img');

  // كان max-height محسوبًا من 100dvh، أي قبل تحجيم جسم الشريحة: المشهد
  // ينكمش مرّتين (سقفٌ ثم تحجيم) فيصير أصغر من اللازم والم启迪 غير مقروء.
  // الآن سقفه صندوقُ جسم الشريحة وحده، والتحجيم الواحد يكفي.
  assert.doesNotMatch(scene, /100dvh/);
  assert.match(scene, /max-height:\s*100%/);

  // ولا ينكمش صندوق المشهد عن محتواه فيتحدّد السقف بنسبة زائفة.
  const box = cssBlock(css, '.slides-scene');
  assert.match(box, /min-height:\s*0\b/);
});

test('the slide navigation and the toolbar never sit inside the scaled body', async () => {
  // التحجيم يطبَّق على جسم الشريحة وحده. شريط التنقّل (السابقة/التالي) وزرّ
  // التوسيع خارجه، فيبقيان بحجمهما الكامل مهما صغُر المحتوى — وهذا ما يجعل
  // الأزرار واضحة بدل أن تصغر مع النص حتى تختفي.
  const { slideBody, card } = await expandedSlideWith({
    'slides-body': { clientHeight: 800, scrollHeight: 2000 }
  });

  const scaledLabels = [];
  slideBody.children.forEach(function (child) {
    scaledLabels.push(child.className);
  });
  assert.equal(scaledLabels.indexOf('slides-nav'), -1);
  assert.equal(card.children.filter(function (child) {
    return child.classList.contains('slides-nav');
  }).length, 1);
});

test('the scene replay button cannot be mistaken for the next button', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'public', 'style.css'), 'utf8');
  const replay = cssBlock(css, '.slides-scene-actions .nav-btn');
  const primary = cssBlock(css, '.nav-btn.primary');

  // كان زرّ «إعادة الحركة» بنفس الأزرق المصمتّ لزرّ «التالي» تمامًا، فليس
  // التلميذ أيّهما ينقل الشريحة وأيّهما يعيد المشهد.Outline أبيض بحافة
  // زرقاء يفصل بينهما شكلًا لا لونًا وحده (تبقى مقروءة فوق أي مشهد).
  const replayBackground = /background:\s*([^;]+);/.exec(replay);
  assert.notEqual(replayBackground, null, 'the replay button needs a background');
  assert.notEqual(replayBackground[1].trim(), 'none');
  assert.match(replay, /border:\s*1px\s+solid/);
  assert.match(replay, /color:\s*#/);

  const primaryBackground = /background:\s*([^;]+);/.exec(primary);
  assert.notEqual(primaryBackground, null, 'the next button needs a background');
  assert.notEqual(
    replayBackground[1].trim(),
    primaryBackground[1].trim(),
    'replay and next must not share one background'
  );
});

test('the floating toolbar does not tint the white slide card grey', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'public', 'style.css'), 'utf8');
  const controls = cssBlock(css, 'body.slides-focus #lesson-presentation-controls');

  // التدرّج كان بلون خلفية الصفحة (240,244,248) فيُلقي شريطًا رماديًا على
  // البطاقة البيضاء فيبدو العرض قذرًا. البطاقة بيضاء، فليكن التلاشي من
  // الأبيض أيضًا.
  const background = /background:\s*([^;]+);/.exec(controls);
  assert.notEqual(background, null, 'the floating controls need a background');
  assert.doesNotMatch(background[1], /240,\s*244,\s*248/);
  assert.match(background[1], /255,\s*255,\s*255/);
});

test('the redundant lesson pager is hidden while the slide is expanded', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'public', 'style.css'), 'utf8');

  // شريط «السابق/التالي» الخاص بالدرس يبقى في التدفّق بارتفاع ‎~49px‎
  // (+ حشوته) تحت البطاقة، فيصير المستند أطول من الشاشة (‎871px‎ في
  // ‎1366×768‎ مقابل ‎768px‎)، فيتمرّر المتصفح من تلقاءه ويُقصّ أعلى الشريحة:
  // عدّاد الشرائح وعنوانها يختفيان تحت حافة الشاشة. ووضع الشرائح له شريطه
  // الخاص (.slides-nav) مثبَّت أسفل البطاقة، فيكفي أن يختفي هذا.
  const chrome = /body\.slides-focus > \.site-header[\s\S]*?\n\}/.exec(css);
  assert.notEqual(chrome, null, 'the focus-mode chrome rule list must exist');
  assert.match(
    chrome[0],
    /#course-lesson-nav/,
    'the lesson pager must be hidden in focus mode or it pushes the document past the viewport'
  );
  assert.match(chrome[0], /display:\s*none/);
});

test('the expanded slide is capped to the viewport so it can scale instead of overflow', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'public', 'style.css'), 'utf8');

  // min-height وحدها لا تقيّد شيئًا: البطاقة تنمو مع محتواها فوق حافة
  // الشاشة (741px في شاشة 720px)، فيصير المستند أطول من الشاشة فيتمرّر
  // المتصفح من تلقاءه ويُقصّ أعلى الشريحة. والأسوأ أن ذلك لا يُنتج تمريرًا
  // داخليًا، فلا يرى fitCard في slides-player.js ما يتجاوز البطاقة فلا
  // يصغّرها أصلًا. السقف (max-height) هو ما يجعل المحتوى يفيض *داخل*
  // البطاقة فيُقاس على محورها فتُصغَّر الشريحة ملاءمةً للشاشة.
  const chain = /body\.slides-focus #courses-group[\s\S]*?\n\}/.exec(css);
  assert.notEqual(chain, null, 'the focus-mode height chain must exist');
  assert.match(
    chain[0],
    /max-height:\s*100dvh/,
    'the focus-mode chain must be capped to the viewport, not merely given a min-height'
  );
});

test('the slide next button stays reachable without covering the slide', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'public', 'style.css'), 'utf8');
  const nav = cssBlock(css, 'body.slides-focus .slides-nav');

  // sticky يحجز مكانه في التدفّق فلا يركب على الشريحة؛ fixed/absolute يغطّيان
  // المشهد والنص، وهما بالضبط ما اشتكى منه التلميذ.
  assert.match(nav, /position:\s*sticky/);
  assert.match(nav, /bottom:\s*0\b/);
  assert.doesNotMatch(nav, /position:\s*(fixed|absolute)\b/);

  // خلفية معتمة: النص المارّ تحت الشريط لا يظهر متباخلًا مع الأزرار.
  const background = /background:\s*([^;]+);/.exec(nav);
  assert.notEqual(background, null, 'the sticky controls need a background');
  assert.notEqual(background[1].trim(), 'none');

  // البطاقة هي المِرْيار الوحيد (الجسم overflow:hidden)، فيجب أن يُعلن
  // التمرير بمقبض مستقرّ حتى يعرف التلميذ أن هناك محتوى أسفل.
  const scroller = cssBlock(css, 'body.slides-focus .slides-wrap');
  assert.match(scroller, /overflow-y:\s*auto/);
  assert.match(scroller, /scrollbar-gutter:\s*stable/);

  // المشهد لا ينزل تحت الشريط الملتصق: سقفه صندوق جسم الشريحة، وهو مقيس
  // على المتاح بعد حشوة الشريط، فيبقى داخله ويُصغَّر معه عند الحاجة.
  const scene = cssBlock(css, 'body.slides-focus .slides-scene-img');
  assert.match(scene, /max-height:\s*100%/);
});

// ---------- ملاءمة الشريحة للشاشة في الوضع الموسّع ----------

// يفتح درسًا في وضع الشرائح ويوسّع العرض، ثم يعيد جسم الشريحة المرسوم.
async function expandedSlideWith(layout, extraSettings) {
  const harness = createHarness(Object.assign({
    course: makeCourse({ id: 'unit-01', slug: 'unit-01' }),
    layout
  }, extraSettings || {}));
  const { elements, body } = harness;

  await flushAsyncWork();
  await flushAsyncWork();
  elements.get('course-cards').children[0].click();
  await flushAsyncWork();
  await flushAsyncWork();
  elements.get('mode-slides').click();
  await flushAsyncWork();
  await flushAsyncWork();
  elements.get('slides-expand-btn').click();
  await flushAsyncWork();

  const card = elements.get('course-lesson-body').children[0];
  const slideBody = card.children.filter(function (child) {
    return child.classList.contains('slides-body');
  })[0];

  return { harness, body, card, slideBody };
}

test('the expanded slide shrinks its body to fit the whole slide on screen', async () => {
  // 1000px محتوى في 800px متاح ⇒ 0.8، فلا يفيض شيء ولا يُطلب نزول.
  const { slideBody } = await expandedSlideWith({
    'slides-body': { clientHeight: 800, scrollHeight: 1000 }
  });

  assert.equal(slideBody.style.transform, 'scale(0.8)');
  assert.equal(slideBody.style.transformOrigin, 'top center');
});

test('a slide too wide for the screen is shrunk on the width axis too', async () => {
  // 1600px محتوى في 1200px عرض، والارتفاع مضبوط تمامًا (800 في 800). القياس
  // بالارتفاع وحده كان يمرّ (لا فيض رأسي) فيترك المحتوى العريض يُقصّ أفقيًا
  // ويضطرّ التلميذ للتمرير جانبًا. المحوران معًا: 1200/1600 = 0.75.
  const { slideBody } = await expandedSlideWith({
    'slides-body': {
      clientHeight: 800, scrollHeight: 800,
      clientWidth: 1200, scrollWidth: 1600
    }
  });

  assert.equal(slideBody.style.transform, 'scale(0.75)');
  assert.equal(slideBody.style.transformOrigin, 'top center');
});

test('the fit falls back to the height axis when the width has no measurement', async () => {
  // محور بلا قياس (0) لا يُحتسب: نكتفي بالمتاح. المتصفح يعطي clientWidth
  // دائمًا، فوجود شرط عدم الكسر حماية لا انحراف.
  const { slideBody } = await expandedSlideWith({
    'slides-body': { clientHeight: 800, scrollHeight: 1000 }
  });

  assert.equal(slideBody.style.transform, 'scale(0.8)');
});

test('a slide that already fits keeps its natural size', async () => {
  const { slideBody } = await expandedSlideWith({
    'slides-body': { clientHeight: 800, scrollHeight: 640 }
  });

  assert.equal(slideBody.style.transform, '');
});

test('an overlong slide stops shrinking at the readable floor of 0.55', async () => {
  // 2000px في 800px ⇒ 0.4، أي نصّ غير مقروء. نقف عند 0.55 — أضيق حدٍّ قرّره
  // صاحب المشروع ليبقى النص مقروءًا. ما دونه يبقى التمرير صمّامَ أمان
  // للمحتوى الشاذّ لا سلوكًا معتادًا؛ ولا شريحة من الشرائح الـ84 يحتاجه.
  const { slideBody } = await expandedSlideWith({
    'slides-body': { clientHeight: 800, scrollHeight: 2000 }
  });

  assert.equal(slideBody.style.transform, 'scale(0.55)');
});

test('collapsing the expanded view restores the natural slide size', async () => {
  const { harness, slideBody } = await expandedSlideWith({
    'slides-body': { clientHeight: 800, scrollHeight: 1000 }
  });

  assert.equal(slideBody.style.transform, 'scale(0.8)');

  harness.elements.get('slides-expand-btn').click();
  await flushAsyncWork();

  assert.equal(slideBody.style.transform, '');
});

test('a window resize re-fits the expanded slide', async () => {
  const layout = { 'slides-body': { clientHeight: 800, scrollHeight: 1000 } };
  const { harness, slideBody } = await expandedSlideWith(layout);

  assert.equal(slideBody.style.transform, 'scale(0.8)');

  // نافذة أطول: تظهر مساحة أكبر فيتّسع المحتوى ويُعاد القياس.
  layout['slides-body'] = { clientHeight: 1000, scrollHeight: 1000 };
  harness.dispatchWindow('resize');
  await flushAsyncWork();

  assert.equal(slideBody.style.transform, '');
});

test('a container resize re-fits the slide even without a window resize event', async () => {
  const layout = { 'slides-body': { clientHeight: 800, scrollHeight: 1000 } };
  const { harness, slideBody } = await expandedSlideWith(layout);

  assert.equal(slideBody.style.transform, 'scale(0.8)');

  // المساحة المتاحة تتغير دون حدث نافذة: فتح لوحة المحادثة، انطواء شريط
  // المتصفح على الجوال، تبديل الأدوات. ResizeObserver هو المُشغّل الوحيد
  // لهذا، فبدونه تبقى نسبةً قديمة يفيض بها نصٌّ أو يُقصّ مشهد.
  assert.equal(
    harness.observedTargets.indexOf(slideBody) !== -1,
    true,
    'slides-player.js must observe the slide body box'
  );

  layout['slides-body'] = { clientHeight: 1000, scrollHeight: 1000 };
  harness.triggerResize();
  await flushAsyncWork();

  assert.equal(slideBody.style.transform, '');
});

test('navigating between expanded slides never scrolls the container', async () => {
  const { harness, card } = await expandedSlideWith(
    { 'slides-body': { clientHeight: 800, scrollHeight: 1000 } },
    {
      deck: {
        version: 1,
        sections: [{
          title: 'Section',
          slides: [
            { id: 'slide-1', title: 'الأولى', text_md: 'نص' },
            { id: 'slide-2', title: 'الثانية', text_md: 'نص' }
          ]
        }]
      }
    }
  );

  // الرسم الأول تمّ في الوضع العادي (والتمرير إليه مقصود)، فلا يُحسب هنا.
  // العبرة بالرسم التالي وأنت في الوضع الموسّع.
  const container = harness.elements.get('course-lesson-body');
  const callsBeforeNavigation = container.scrollIntoViewCalls;

  const nav = card.querySelector('.slides-nav');
  const next = nav.children.filter(function (child) {
    return child.classList.contains('primary');
  })[0];
  next.click();
  await flushAsyncWork();

  // شريحة ثانية مرسومة فعلًا (العدّاد تقدّم)…
  const drawnCard = container.children[0];
  const counter = drawnCard.querySelector('.slides-top').children[0];
  assert.equal(counter.textContent, 'شريحة 2 من 2');

  // …وفي الوضع الموسّع البطاقة هي الشاشة نفسها، فـscrollIntoView يزيح موضع
  // التمرير عن الملاءمة التي بُنيت عليه توًّا فيكشف فجوة أسفل الشريحة.
  assert.equal(container.scrollIntoViewCalls, callsBeforeNavigation);
});

test('a normal unexpanded slide still scrolls into view so the page follows it', async () => {
  const { elements } = createHarness({
    course: makeCourse({ id: 'unit-01', slug: 'unit-01' })
  });

  await flushAsyncWork();
  await flushAsyncWork();
  elements.get('course-cards').children[0].click();
  await flushAsyncWork();
  await flushAsyncWork();
  elements.get('mode-slides').click();
  await flushAsyncWork();
  await flushAsyncWork();

  // بلا توسيع: الشريحة جزءٌ من صفحة أطول، فالتمرير إلىها سلوك مقصود.
  assert.equal(elements.get('course-lesson-body').scrollIntoViewCalls, 1);
});

test('a slide is left unmeasured when the browser reports no layout box', async () => {
  // لا قياس (clientHeight/scrollHeight = 0) ⇒ لا تحجيم مصطنع، ويبقى
  // التمرير هو السلوك الاحتياطي.
  const { slideBody } = await expandedSlideWith({});

  assert.equal(slideBody.style.transform, '');
});

test('slide mode keeps the normal site layout until the expand button is pressed', async () => {
  const { elements, body } = createHarness();
  const modeSlides = elements.get('mode-slides');
  const modeText = elements.get('mode-text');
  const expandButton = elements.get('slides-expand-btn');
  const presentationControls = elements.get('lesson-presentation-controls');

  modeSlides.click();
  await flushAsyncWork();

  assert.equal(body.classList.contains('slides-focus'), false);
  assert.equal(presentationControls.classList.contains('hidden'), false);
  assert.equal(expandButton.classList.contains('hidden'), false);
  assert.equal(expandButton.getAttribute('aria-pressed'), 'false');
  assert.equal(modeText.getAttribute('aria-selected'), 'false');
  assert.equal(modeSlides.getAttribute('aria-selected'), 'true');

  expandButton.click();
  await flushAsyncWork();

  assert.equal(body.classList.contains('slides-focus'), true);
  assert.equal(expandButton.getAttribute('aria-pressed'), 'true');

  expandButton.click();
  await flushAsyncWork();

  assert.equal(body.classList.contains('slides-focus'), false);
  assert.equal(expandButton.getAttribute('aria-pressed'), 'false');

  modeText.click();
  await flushAsyncWork();

  assert.equal(body.classList.contains('slides-focus'), false);
  assert.equal(presentationControls.classList.contains('hidden'), false);
  assert.equal(expandButton.classList.contains('hidden'), true);
  assert.equal(modeText.getAttribute('aria-selected'), 'true');
  assert.equal(modeSlides.getAttribute('aria-selected'), 'false');
});

test('the expand button never calls the browser fullscreen API', async () => {
  const { document, elements, body } = createHarness();
  const expandButton = elements.get('slides-expand-btn');
  const lessonView = elements.get('course-lesson-view');

  assert.equal(typeof lessonView.requestFullscreen, 'undefined');
  assert.equal(typeof document.exitFullscreen, 'undefined');
  assert.equal(document.fullscreenElement, undefined);

  elements.get('mode-slides').click();
  await flushAsyncWork();

  expandButton.click();
  await flushAsyncWork();

  assert.equal(body.classList.contains('slides-focus'), true);
  assert.equal(document.fullscreenElement, undefined);
  assert.equal(
    elements.get('course-lesson-nav').querySelector('.course-note'),
    null
  );
});

test('switching to text collapses the expanded slide', async () => {
  const { elements, body } = createHarness();

  elements.get('mode-slides').click();
  await flushAsyncWork();
  elements.get('slides-expand-btn').click();
  await flushAsyncWork();

  assert.equal(body.classList.contains('slides-focus'), true);

  elements.get('mode-text').click();
  await flushAsyncWork();

  assert.equal(body.classList.contains('slides-focus'), false);
  assert.equal(elements.get('slides-expand-btn').getAttribute('aria-pressed'), 'false');
});

test('switching to another tab collapses the slide but keeps the lesson ready', async () => {
  const { elements, body } = createHarness();

  elements.get('mode-slides').click();
  await flushAsyncWork();
  elements.get('slides-expand-btn').click();
  await flushAsyncWork();

  elements.get('tab-summaries').click();
  await flushAsyncWork();

  assert.equal(body.classList.contains('slides-focus'), false);
  assert.equal(elements.get('slides-expand-btn').getAttribute('aria-pressed'), 'false');
});

test('returning to the course dashboard clears slide focus', async () => {
  const { elements, body } = createHarness();

  elements.get('mode-slides').click();
  await flushAsyncWork();
  elements.get('slides-expand-btn').click();
  await flushAsyncWork();

  elements.get('course-lesson-back').click();
  await flushAsyncWork();

  assert.equal(body.classList.contains('slides-focus'), false);
});

test('unavailable slide decks fall back to text mode', async () => {
  const { elements, body } = createHarness({ deckAvailable: false });
  const modeSlides = elements.get('mode-slides');
  const modeText = elements.get('mode-text');
  const expandButton = elements.get('slides-expand-btn');
  const presentationControls = elements.get('lesson-presentation-controls');

  modeSlides.click();
  await flushAsyncWork();
  await flushAsyncWork();

  assert.equal(body.classList.contains('slides-focus'), false);
  assert.equal(presentationControls.classList.contains('hidden'), true);
  assert.equal(expandButton.classList.contains('hidden'), true);
  assert.equal(modeText.classList.contains('active'), true);
  assert.equal(modeSlides.classList.contains('active'), false);
});

test('resuming a saved slide position without a deck resets to text mode', async () => {
  const { elements, storage } = createHarness({
    course: makeCourse(),
    deckAvailable: false,
    savedPosition: {
      course_id: 'unit-01',
      section_id: '1',
      slide_index: 0,
      mode: 'slides'
    }
  });
  const cards = elements.get('course-cards');
  const modeText = elements.get('mode-text');

  await flushAsyncWork();
  await flushAsyncWork();

  cards.children[0].click();
  await flushAsyncWork();
  await flushAsyncWork();
  await flushAsyncWork();

  const saved = JSON.parse(storage.get('course_positions.v1'))['unit-01'];
  assert.equal(saved.mode, 'text');
  assert.equal(saved.section_id, '1');
  assert.equal(modeText.classList.contains('active'), true);

  modeText.click();
  await flushAsyncWork();

  assert.equal(modeText.classList.contains('active'), true);
});

test('completing a course in slide mode resets the layout for the next course', async () => {
  const first = makeCourse({ id: 'unit-01', order: 1, title_ar: 'الكورس الأول' });
  const second = makeCourse({ id: 'unit-02', order: 2, title_ar: 'الكورس الثاني' });
  const { elements, body } = createHarness({
    courses: [first, second],
    loggedIn: true
  });
  const cards = elements.get('course-cards');
  const presentationControls = elements.get('lesson-presentation-controls');
  const expandButton = elements.get('slides-expand-btn');
  const modeText = elements.get('mode-text');
  const modeSlides = elements.get('mode-slides');
  const lessonNav = elements.get('course-lesson-nav');

  const navButton = (label) => lessonNav.children.filter(function (child) {
    return child.textContent === label;
  })[0];

  await flushAsyncWork();
  await flushAsyncWork();

  cards.children[0].click();
  await flushAsyncWork();
  await flushAsyncWork();

  modeSlides.click();
  await flushAsyncWork();
  await flushAsyncWork();
  expandButton.click();
  await flushAsyncWork();

  assert.equal(body.classList.contains('slides-focus'), true);

  navButton('إنهاء الكورس').click();
  await flushAsyncWork();
  await flushAsyncWork();
  await flushAsyncWork();
  await flushAsyncWork();

  assert.equal(body.classList.contains('slides-focus'), false);
  assert.equal(presentationControls.classList.contains('hidden'), true);
  assert.equal(expandButton.classList.contains('hidden'), true);
  assert.equal(modeText.classList.contains('active'), true);
  assert.equal(modeText.getAttribute('aria-selected'), 'true');
  assert.equal(modeSlides.getAttribute('aria-selected'), 'false');

  navButton('افتح الكورس التالي ←').click();
  await flushAsyncWork();
  await flushAsyncWork();
  await flushAsyncWork();

  assert.equal(body.classList.contains('slides-focus'), false);
  assert.equal(presentationControls.classList.contains('hidden'), false);
  assert.equal(expandButton.classList.contains('hidden'), true);
  assert.equal(modeText.classList.contains('active'), true);
  assert.equal(elements.get('course-lesson-head').innerHTML.indexOf('الكورس الثاني') !== -1, true);
});

test('a signed-in student gets the deck fallback pushed to the server', async () => {
  const { elements, postedPositions } = createHarness({
    course: makeCourse(),
    deckAvailable: false,
    loggedIn: true,
    progress: { completedCount: 0, total: 1, courses: [] },
    savedPosition: {
      course_id: 'unit-01',
      section_id: '1',
      slide_index: 0,
      mode: 'slides'
    }
  });

  await flushAsyncWork();
  await flushAsyncWork();
  elements.get('course-cards').children[0].click();
  await flushAsyncWork();
  await flushAsyncWork();
  await flushAsyncWork();

  assert.deepEqual(postedPositions.map((pos) => pos.mode), ['slides', 'text']);
  assert.equal(postedPositions[postedPositions.length - 1].mode, 'text');
});

test('switching tabs and back preserves the open slide lesson', async () => {
  const { elements, body, storage } = createHarness({
    course: makeCourse({ id: 'unit-01', title_ar: 'الكورس الأول' })
  });
  const cards = elements.get('course-cards');
  const presentationControls = elements.get('lesson-presentation-controls');
  const expandButton = elements.get('slides-expand-btn');
  const modeSlides = elements.get('mode-slides');

  await flushAsyncWork();
  await flushAsyncWork();

  cards.children[0].click();
  await flushAsyncWork();
  await flushAsyncWork();

  modeSlides.click();
  await flushAsyncWork();
  await flushAsyncWork();
  expandButton.click();
  await flushAsyncWork();

  assert.equal(body.classList.contains('slides-focus'), true);

  elements.get('tab-summaries').click();
  await flushAsyncWork();
  elements.get('tab-courses').click();
  await flushAsyncWork();
  await flushAsyncWork();

  assert.equal(body.classList.contains('slides-focus'), false);
  assert.equal(presentationControls.classList.contains('hidden'), false);
  assert.equal(expandButton.classList.contains('hidden'), false);
  assert.equal(modeSlides.classList.contains('active'), true);
  assert.equal(JSON.parse(storage.get('course_positions.v1'))['unit-01'].mode, 'slides');
});

test('repeated lesson errors replace the previous note instead of stacking', async () => {
  const { elements } = createHarness({
    course: makeCourse(),
    loggedIn: false
  });
  const lessonNav = elements.get('course-lesson-nav');

  const navButton = (label) => lessonNav.children.filter(function (child) {
    return child.textContent === label;
  })[0];
  const notes = () => lessonNav.children.filter(function (child) {
    return child.classList.contains('course-note');
  });

  await flushAsyncWork();
  await flushAsyncWork();
  elements.get('course-cards').children[0].click();
  await flushAsyncWork();
  await flushAsyncWork();

  assert.equal(notes().length, 0);

  navButton('إنهاء الكورس').click();
  await flushAsyncWork();
  navButton('إنهاء الكورس').click();
  await flushAsyncWork();

  assert.equal(notes().length, 1);
  assert.equal(notes()[0].classList.contains('error'), true);
  assert.equal(notes()[0].getAttribute('role'), 'alert');
  assert.equal(notes()[0].textContent, 'سجّل الدخول أولاً لحفظ تقدمك وإتمام الكورسات.');
});

test('slide mode renders the real slide card with text and scene', async () => {
  const { elements } = createHarness({ course: makeCourse({ id: 'unit-01', slug: 'unit-01' }) });
  const lessonBody = elements.get('course-lesson-body');

  await flushAsyncWork();
  await flushAsyncWork();
  elements.get('course-cards').children[0].click();
  await flushAsyncWork();
  await flushAsyncWork();

  elements.get('mode-slides').click();
  await flushAsyncWork();
  await flushAsyncWork();

  const card = lessonBody.children[0];
  assert.equal(card.classList.contains('slides-wrap'), true);

  const slideBody = card.children.filter(function (child) {
    return child.classList.contains('slides-body');
  })[0];
  const text = slideBody.children.filter(function (child) {
    return child.classList.contains('slides-text');
  })[0];
  const scene = slideBody.children.filter(function (child) {
    return child.classList.contains('slides-scene');
  })[0];
  const img = scene.children[0];

  assert.equal(text.innerHTML, '<p>نص الشريحة الأولى</p>');
  assert.equal(img.classList.contains('slides-scene-img'), true);
  assert.equal(img.src, 'course/slides/unit-01/scene-01.svg');
});

test('text mode renders lesson markdown instead of a slide card', async () => {
  const { elements } = createHarness({ course: makeCourse() });
  const lessonBody = elements.get('course-lesson-body');

  await flushAsyncWork();
  await flushAsyncWork();
  elements.get('course-cards').children[0].click();
  await flushAsyncWork();
  await flushAsyncWork();

  assert.equal(lessonBody.children.length, 0);
  assert.equal(lessonBody.innerHTML.indexOf('نص المقطع') !== -1, true);
  assert.equal(lessonBody.classList.contains('slides-mode'), false);
});

test('a rejected deck load leaves the mode switch on text', async () => {
  const { elements, body } = createHarness({ deckLoadRejects: true });
  const modeText = elements.get('mode-text');
  const modeSlides = elements.get('mode-slides');
  const presentationControls = elements.get('lesson-presentation-controls');

  modeSlides.click();
  await flushAsyncWork();
  await flushAsyncWork();

  assert.equal(modeText.classList.contains('active'), true);
  assert.equal(modeSlides.classList.contains('active'), false);
  assert.equal(modeText.getAttribute('aria-selected'), 'true');
  assert.equal(body.classList.contains('slides-focus'), false);
  assert.equal(presentationControls.classList.contains('hidden'), false);
});

test('switching to text while the deck is loading keeps text mode', async () => {
  const { elements, body } = createHarness({ deckLoadPending: true });
  const modeText = elements.get('mode-text');
  const modeSlides = elements.get('mode-slides');
  const lessonBody = elements.get('course-lesson-body');

  modeSlides.click();
  await flushAsyncWork();
  modeText.click();
  await flushAsyncWork();
  await flushAsyncWork();

  assert.equal(modeText.classList.contains('active'), true);
  assert.equal(modeSlides.classList.contains('active'), false);
  assert.equal(body.classList.contains('slides-focus'), false);
  assert.equal(lessonBody.classList.contains('slides-mode'), false);
});

test('the server serves .svg as image/svg+xml so the scenes can load', () => {
  // بدون هذا النوع يقدّم server.js ملفّات المشاهد octet-stream، فيرفض
  // Chromium عرضها في <img> (حدث error) وتظهر الشريحة بمشهد مكسور.
  const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
  assert.match(server, /'\.svg':\s*'image\/svg\+xml'/);
});

test('the expanded slide is not clamped by the reading measure', () => {
  // .course-content يحمل max-width للقراءة (72ch). لولا سعةٌ شاشة في الوضع
  // الموسّع لضاقت الشريحة إلى نحو 579px من 1920 (30% فقط)، فخسرنا
  // «تغطية نسبة كبيرة من الشاشة». يبقى النصّ محصورًا بـ .slides-text وحده.
  const css = fs.readFileSync(path.join(__dirname, '..', 'public', 'style.css'), 'utf8');
  const block = cssBlock(css, 'body.slides-focus .course-content.slides-mode');
  assert.doesNotMatch(block, /\d+ch/);
  assert.match(block, /max-width:\s*min\(\s*\d+px\s*,\s*100%\s*\)/);
});