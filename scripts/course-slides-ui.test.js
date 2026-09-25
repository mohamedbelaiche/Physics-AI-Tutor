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

    scrollIntoView() {}
  }

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

  const window = {
    fetch,
    scrollTo() {},
    addEventListener(type, handler) {
      listeners.set(type, handler);
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

  return { context, document, elements, body, storage, postedPositions };
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
