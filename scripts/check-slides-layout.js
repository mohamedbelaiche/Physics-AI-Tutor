/* فحص هندسي لعارض الشرائح في الوضع الموسّع، بمحرّك تخطيط حقيقي.
 *
 * المطلوب: في الوضع الموسّع تظهر الشريحة كاملةً داخل الشاشة بلا نزول:
 *   1) .slides-wrap غير قابل للتمرير رأسيًا (scrollHeight <= clientHeight)،
 *   2) كل عناصر الشريحة داخل صندوقها المرئي (لا نصّ ولا مشهد خارجها).
 *
 * الفحص يقود الواجهة كما يقودها التلميذ (بطاقة ← وضع الشرائح ← شريحة
 * فيها مشهد ← زرّ التوسيع)، ويقيس من متصفح بلا واجهة، ويلتقط لقطات.
 *
 * التشغيل:  node scripts/check-slides-layout.js [--shots <dir>]
 */

const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT = path.join(__dirname, '..');
const PORT = process.env.CHECK_PORT || '5599';
const BASE = 'http://127.0.0.1:' + PORT + '/';
const args = process.argv.slice(2);
const shotIdx = args.indexOf('--shots');
const SHOT_DIR = shotIdx !== -1 ? args[shotIdx + 1] : null;

const VIEWPORTS = [
  { name: '1920x1080', width: 1920, height: 1080 },
  { name: '1600x900', width: 1600, height: 900 },
  { name: '1440x900', width: 1440, height: 900 },
  { name: '1366x768', width: 1366, height: 768 },
  { name: '1280x720', width: 1280, height: 720 },
  { name: '1024x768', width: 1024, height: 768 }
];

function startServer() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(ROOT, 'server.js')], {
      cwd: ROOT,
      env: Object.assign({}, process.env, { PORT }),
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let out = '';
    const onData = (d) => {
      out += d.toString();
      if (out.indexOf('Serving on') !== -1) resolve(child);
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', (d) => process.stderr.write('[server] ' + d));
    child.on('exit', (code) => reject(new Error('server exited: ' + code + '\n' + out)));
    setTimeout(() => reject(new Error('server start timeout')), 15000);
  });
}

/* قياس داخل الصفحة: أرقام خام فقط. الحكم يترك لتقرير أسفل. */
const MEASURE = () => {
  const wrap = document.querySelector('.slides-wrap');
  const bodyEl = document.querySelector('.slides-wrap > .slides-body');
  const img = document.querySelector('.slides-scene-img');
  if (!wrap || !bodyEl) return { ok: false, reason: 'no .slides-wrap/.slides-body' };

  const bb = bodyEl.getBoundingClientRect();
  const pr = window.getComputedStyle(bodyEl).transform;
  const m = /matrix\(([\d.]+)/.exec(pr || '');

  const out = {
    ok: true,
    viewportH: window.innerHeight,
    viewportW: window.innerWidth,
    wrapScrollH: wrap.scrollHeight,
    wrapClientH: wrap.clientHeight,
    wrapScrolls: wrap.scrollHeight > wrap.clientHeight + 1,
    wrapW: Math.round(wrap.getBoundingClientRect().width),
    bodyScrollH: bodyEl.scrollHeight,
    bodyClientH: bodyEl.clientHeight,
    bodyOverflows: bodyEl.scrollHeight > bodyEl.clientHeight + 1,
    scale: m ? Number(m[1]) : 1,
    hasScene: !!img
  };
  out.wrapOverflowsDown = Math.max(0, wrap.scrollHeight - wrap.clientHeight);

  // المقصود الحقيقي: حبرٌ يراه التلميذ ويوجد خارج ما يصله إليه. لا يكفي
  // أن نقيس صناديق العناصر: كثيرٌ منها أبعادُه صفرية (دعامات KaTeX عرضها
  // 0، وحواملُ المحارف ارتفاعها 0)، فيبدو «فيضًا» كبيرًا ولا يُرى منه حبر.
  // فنقيس حبرَ النصّ نفسه عبر Range، ثم نبحث عن أقرب صندوق يقصّه.
  //
  // ونميّز قسمين لا ثالث لهما:
  //   • مفقود: الصندوق overflow:hidden|clip على ذلك المحور ⇒ الحبر ضاع.
  //   • مدرك: الصندوق overflow:auto|scroll على ذلك المحور ⇒ التلميذ
  //     يستطيع التمرير فيراه. عيبٌ في راحة القراءة لا في المعلومة،
  //     فيُسجَّل تحذيرًا لا فشلًا.
  out.clipped = (function () {
    const lost = [];
    const reachable = [];

    // ما يُقصّ قصدًا: تمثيل MathML المخفي الذي يرسمه KaTeX بجوار كل معادلة
    // للقارئات الشاشية (1×1px، مقصوص عمدًا)، وكل ما طُبِّق عليه
    // visibility:hidden أو opacity:0. هو ليس معروضًا فلا يُحاسب.
    //
    // ولا نُسقط السلفَ عديمةَ البُعد: صنفُ الكسور في KaTeX صناديقُه ارتفاعُها
    // صفر ومحتواها مرسومٌ بتموضعٍ نسبي، فلها حبرٌ يراه التلميذ تمامًا. نُهمل
    // صنفًا لا حبر له، ونقيس ما له حبر.
    const hiddenBy = (el) => {
      for (let p = el; p && p !== document.body; p = p.parentElement) {
        const st = getComputedStyle(p);
        if (st.visibility === 'hidden' || st.opacity === '0') return p;
        if (st.display === 'none') return p;
        if (p.classList && p.classList.contains('katex-mathml')) return p;
      }
      return null;
    };

    // أقرب صندوق يحدّ من ظهور الحبر، مع نوع الحدّ.
    const clipper = (el) => {
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        const st = getComputedStyle(p);
        if (st.overflowX === 'visible' && st.overflowY === 'visible') continue;
        return {
          p,
          label: p.tagName.toLowerCase() + (typeof p.className === 'string' && p.className.trim()
            ? '.' + p.className.trim().split(/\s+/).join('.') : ''),
          ox: st.overflowX,
          oy: st.overflowY
        };
      }
      return null;
    };

    // حدود القصّ = حافة صندوق الحشو، لا حدّ المحتوى: الحشو داخل القصّ.
    const edges = (el) => {
      const st = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return {
        top: r.top - (parseFloat(st.paddingTop) || 0),
        bottom: r.bottom + (parseFloat(st.paddingBottom) || 0),
        left: r.left - (parseFloat(st.paddingLeft) || 0),
        right: r.right + (parseFloat(st.paddingRight) || 0)
      };
    };

    const walk = document.createTreeWalker(bodyEl, NodeFilter.SHOW_TEXT, null);
    let node;
    const seen = new Set();
    while ((node = walk.nextNode())) {
      if (!(node.nodeValue || '').trim()) continue;
      const host = node.parentElement;
      if (!host || hiddenBy(host)) continue;

      const range = document.createRange();
      range.selectNodeContents(node);
      const rects = range.getClientRects();
      for (let i = 0; i < rects.length; i += 1) {
        const q = rects[i];
        if (q.width <= 0.5 || q.height <= 0.5) continue;
        const c = clipper(host);
        if (!c) continue;
        const e = edges(c.p);
        const outTop = Math.round(Math.max(0, e.top - q.top));
        const outBottom = Math.round(Math.max(0, q.bottom - e.bottom));
        const outRight = Math.round(Math.max(0, q.right - e.right));
        const outLeft = Math.round(Math.max(0, e.left - q.left));
        const worstV = Math.max(outTop, outBottom);
        const worstH = Math.max(outRight, outLeft);
        if (worstV <= 1 && worstH <= 1) continue;

        // مفقود إن كان المحور المقطوع مقصوصًا صراحةً، وإلا فهو مدرك بالتمرير.
        const axisV = worstV > worstH;
        const lostHere = axisV
          ? (c.oy === 'hidden' || c.oy === 'clip')
          : (c.ox === 'hidden' || c.ox === 'clip');
        const amount = Math.max(worstV, worstH);
        const key = c.label + '|' + amount + '|' + (lostHere ? 'lost' : 'reachable');
        if (seen.has(key)) continue;
        seen.add(key);
        const rec = {
          el: host.tagName.toLowerCase() + (typeof host.className === 'string' && host.className.trim()
            ? '.' + host.className.trim().split(/\s+/)[0] : ''),
          clippedBy: c.label,
          over: amount,
          axis: axisV ? 'vertical' : 'horizontal',
          text: node.nodeValue.trim().slice(0, 18)
        };
        (lostHere ? lost : reachable).push(rec);
        if (lost.length + reachable.length > 12) break;
      }
      if (lost.length + reachable.length > 12) break;
    }
    out.lost = lost;
    out.reachable = reachable;
    return lost;
  })();

  out.bodyOverflowStyle = getComputedStyle(bodyEl).overflow;

   // البطاقة يجب أن تُحاذى في النافذة نفسها: تجاوزها يعني أن شريط
   // «التالي» في أسفلها يقع تحت حافة الشاشة بلا وسيلة للوصول إليه.
  const wr = wrap.getBoundingClientRect();
  out.wrapTop = Math.round(wr.top);
  out.wrapBottom = Math.round(wr.bottom);
  out.wrapPastViewport = Math.round(Math.max(0, wr.bottom - window.innerHeight));
  out.wrapAboveViewport = Math.round(Math.max(0, -wr.top));

  const nav = document.querySelector('.slides-nav');
  if (nav) {
    const nr = nav.getBoundingClientRect();
    out.navBottom = Math.round(nr.bottom);
    out.navPastViewport = Math.round(Math.max(0, nr.bottom - window.innerHeight));
  }

  if (img) {
    const ib = img.getBoundingClientRect();
    out.imgBoxH = Math.round(ib.height);
    out.imgBoxW = Math.round(ib.width);
    out.imgBottomPastBody = Math.round(Math.max(0, ib.bottom - bb.bottom));
  }

  // إلى أي حد يخرج محتوى الشريحة عمّا يراه التلميذ فعلًا؟
  //
  // fitCard يُصغّر جسم الشريحة بـ transform، فينكمش مستطيل الصندوق نفسه
  // مع المحتوى. فقياس المحتوى مقابل ذلك الصندوق المنكمش يعطي «فيضًا» وهو
  // ليس فيضًا: المحتوى يخرج من صندوق *مصغَّر*، لا أنه يُقصّ. المرجع
  // الصحيح هو ما يصل إليه عين التلميذ: البطاقة، وشريط التنقّل الملتصق
  // الذي يجب ألّا يركبه المحتوى، وحافة الشاشة.
  const wr0 = wrap.getBoundingClientRect();
  const navEl = document.querySelector('.slides-nav');
  const navTop = navEl ? navEl.getBoundingClientRect().top : null;

  let pastCard = 0;
  let underNav = 0;
  let pastViewport = 0;
  let pastRight = 0;
  Array.prototype.slice.call(
    bodyEl.querySelectorAll('.slides-text, .slides-scene, .slides-scene-img, .slides-steps')
  ).forEach((n) => {
    const r = n.getBoundingClientRect();
    if (!r.height && !r.width) return;
    if (r.bottom - wr0.bottom > pastCard) pastCard = r.bottom - wr0.bottom;
    if (navTop != null && r.bottom - navTop > underNav) underNav = r.bottom - navTop;
    if (r.bottom - window.innerHeight > pastViewport) pastViewport = r.bottom - window.innerHeight;
    if (r.right - wr0.right > pastRight) pastRight = r.right - wr0.right;
  });
  out.worstPastCard = Math.round(pastCard);
  out.worstUnderNav = Math.round(underNav);
  out.worstPastViewport = Math.round(pastViewport);
  out.worstPastRight = Math.round(pastRight);
  return out;
};

/* يقود الواجهة حتى عرض شريحة فيها مشهد، ثم يوسّع. يعيد وصف الحالة. */
async function openExpandedSceneSlide(page) {
  // لوح الكورسات مخفيّ افتراضيًا، فلا بدّ من فتح تبويبه قبل رؤية البطاقات.
  await page.click('#tab-courses');
  await page.waitForSelector('.course-card', { state: 'visible', timeout: 15000 });
  await page.click('.course-card');
  await page.waitForSelector('#course-lesson-view:not(.hidden)', { timeout: 15000 });

  const modeVisible = await page.isVisible('#mode-slides');
  if (!modeVisible) return { error: 'slides mode unavailable for this course' };
  await page.click('#mode-slides');
  await page.waitForSelector('.slides-wrap', { timeout: 15000 });

  // نبحث عن شريحة فيها مشهد: نجرّب كل قسم ونضغط «التالي» حتى تظهر.
  const found = await page.evaluate(async () => {
    const chips = Array.prototype.slice.call(document.querySelectorAll('.course-section-chip'));
    for (const chip of chips) {
      chip.click();
      await new Promise((r) => setTimeout(r, 120));
      for (let step = 0; step < 14; step += 1) {
        if (document.querySelector('.slides-scene-img')) {
          return { section: chip.getAttribute('aria-label'), step };
        }
        const next = document.querySelector('.slides-nav .nav-btn.primary');
        if (!next || next.disabled) break;
        next.click();
        await new Promise((r) => setTimeout(r, 90));
      }
    }
    return null;
  });

  if (!found) return { error: 'no slide with a scene found' };

  await page.waitForFunction(() => {
    const i = document.querySelector('.slides-scene-img');
    return i && i.complete && i.naturalWidth > 0;
  }, null, { timeout: 10000 }).catch(() => {});

  await page.click('#slides-expand-btn');
  await page.waitForSelector('body.slides-focus', { timeout: 8000 });
  await page.waitForTimeout(300);
  return { found };
}

const DEBUG = args.indexOf('--debug') !== -1;

/* يمشي على كل شرائح كل أقسام كل الوحدات في الوضع الموسّع ويقيسها.
   شريحة واحدة قد تمرّ وأختها في القسم نفسه تفيض. فنقيس الجميع. */
async function sweepEverySlide(page) {
  return page.evaluate(async (src) => {
    const MEASURE = eval('(' + src + ')');
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const out = { slides: 0, sections: 0, decks: 0, skippedDecks: [], errors: [], problems: [], warnings: [] };
    const worst = {};
    const bump = (k, v) => { if (v > (worst[k] || 0)) worst[k] = v; };

    const isFocus = () => document.body.classList.contains('slides-focus');
    const collapse = async () => {
      if (!isFocus()) return;
      const btn = document.getElementById('slides-expand-btn');
      if (btn) btn.click();
      await sleep(80);
    };

    const deckCount = document.querySelectorAll('.course-card').length;
    for (let d = 0; d < deckCount; d += 1) {
      // ارجع إلى لوح الكورسات، ثم افتح الوحدة d.
      await collapse();
      const back = document.getElementById('course-lesson-back');
      if (back && getComputedStyle(back).display !== 'none') back.click();
      await sleep(120);
      const cards = document.querySelectorAll('.course-card');
      if (!cards[d]) { out.errors.push('deck ' + d + ' missing'); break; }
      cards[d].click();
      await sleep(220);
      const deckName = (cards[d].querySelector('.course-card-title') || {}).textContent
        || ('unit ' + (d + 1));

      // لا فائدة من قياس وضع لا وجود له: مبدّل الشرائح يبقى مخفيًّا إن لم
      // يكن للوحدة deck، والإجابة الصحيحة هنا «لا يوجد» لا «فشل». عدّها
      // متخطّاةً صراحةً كي لا تُحسب على العيب ولا على successes.
      //
      //	setModeUI يخفي وعاءَ المبدّل (modeSwitch) لا الزرَّ نفسه، فالسؤال
      //	عن «هل مرئيّ؟» لا «هل عليه صنف hidden؟» — نقرأ الرسم لا الصنف.
      const isVisible = (el) => {
        if (!el) return false;
        for (let p = el; p && p !== document.documentElement; p = p.parentElement) {
          const st = getComputedStyle(p);
          if (st.display === 'none' || st.visibility === 'hidden') return false;
        }
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      };

      const modeSlides = document.getElementById('mode-slides');
      if (!isVisible(modeSlides)) {
        out.skippedDecks.push(deckName + ' (لا deck شرائح)');
        continue;
      }
      out.decks += 1;
      modeSlides.click();
      await sleep(200);

      const chips = Array.prototype.slice.call(document.querySelectorAll('.course-section-chip'));
      for (let s = 0; s < chips.length; s += 1) {
        await collapse();
        const chip = document.querySelectorAll('.course-section-chip')[s];
        if (!chip) { out.errors.push('section ' + s + ' vanished'); break; }
        const label = chip.getAttribute('aria-label') || ('section ' + (s + 1));
        chip.click();
        await sleep(160);

        const expand = document.getElementById('slides-expand-btn');
        if (!expand) { out.errors.push(label + ': no expand button'); continue; }
        expand.click();
        await sleep(200);
        if (!isFocus()) { out.errors.push(label + ': expand did not engage'); continue; }
        out.sections += 1;

        // نمشي على شرائح القسم: نقيس ثم «التالي» حتى تنتهي.
        //
        // حدود المشي: زرُّ «التالي» لا يُعطَّل أبدًا، بل يحمل عند آخر شريحة
        // عنوان «نهاية قسم ✓» ويقفز إلى القسم التالي. فلو اكتفينا بانتظار
        // next.disabled لتسرّب المشي إلى الأقسام اللاحقة بعنوانٍ قديم، ثم بلغ
        // آخر الـdeck فخرج sectionIdx عن مداه فيغيب .slides-wrap فيُبلَّغ عن
        // «لا شريحة» وهي ليست مشكلة أصلًا. فنقرأ موضع اللاعب ونقف عند
        // تغيّر القسم.
        const playerPos = () => (window.SlidesPlayer && window.SlidesPlayer.getPos)
          ? window.SlidesPlayer.getPos() : null;
        const startSection = (playerPos() || {}).sectionIdx;
        for (let step = 0; step < 30; step += 1) {
          const counter = document.querySelector('.slides-counter');
          const sig = label + ' | ' + (counter ? counter.textContent : step) +
            ' | ' + ((document.querySelector('.slides-title') || {}).textContent || '');
          const m = MEASURE;
          let r;
          try { r = eval('(' + src + ')')(); } catch (e) {
            out.errors.push(label + ': measure threw ' + e.message);
            break;
          }
          out.slides += 1;

          const probs = [];
          const warns = [];
          if (!r.ok) probs.push(r.reason);
          else {
            if (r.wrapClientH <= 0) probs.push('slide box has zero height');
            if (r.wrapScrolls) probs.push('SCROLLS ' + r.wrapOverflowsDown + 'px');
            if (r.worstPastCard > 1) probs.push('past card ' + r.worstPastCard + 'px');
            if (r.worstUnderNav > 1) probs.push('under NEXT bar ' + r.worstUnderNav + 'px');
            if (r.worstPastViewport > 1) probs.push('past screen ' + r.worstPastViewport + 'px');
            if (r.wrapPastViewport > 1) probs.push('card past viewport ' + r.wrapPastViewport + 'px');
            if (r.wrapAboveViewport > 1) probs.push('card top cut ' + r.wrapAboveViewport + 'px');
            if (r.navPastViewport > 1) probs.push('NEXT past viewport ' + r.navPastViewport + 'px');
            // حبرٌ ضاع: لا يظهر ولا بالتمرير. هذا فشل.
            if (r.lost && r.lost.length) {
              probs.push('INK LOST ' + r.lost.slice(0, 2)
                .map((c) => '"' + c.text + '" ' + c.axis + ' by ' + c.clippedBy + ' ' + c.over + 'px').join(', '));
            }
            // حبرٌ مدرك بالتمرير: يظهر إن مرّر التلميذ. تحذير لا فشل.
            if (r.reachable && r.reachable.length) {
              warns.push('ink needs scroll ' + r.reachable.slice(0, 2)
                .map((c) => '"' + c.text + '" ' + c.axis + ' in ' + c.clippedBy + ' ' + c.over + 'px').join(', '));
            }
          }

          bump('scaleLowest', r.scale == null ? 0 : (1 - Math.min(1, r.scale)));
          bump('pastCard', r.worstPastCard || 0);
          bump('underNav', r.worstUnderNav || 0);
          bump('pastScreen', r.worstPastViewport || 0);
          bump('scroll', r.wrapOverflowsDown || 0);
          if (probs.length) out.problems.push(sig + ' -> ' + probs.join('; '));
          if (warns.length) out.warnings.push(sig + ' -> ' + warns.join('; '));

          const next = document.querySelector('.slides-nav .nav-btn.primary');
          if (!next || next.disabled) break;
          next.click();
          await sleep(110);
          const moved = playerPos();
          if (moved && moved.sectionIdx !== startSection) break;
          const after = document.querySelector('.slides-counter');
          if (after && counter && after.textContent === counter.textContent) break;
        }
      }
    }
    await collapse();
    out.worst = worst;
    return out;
  }, MEASURE.toString());
}

async function main() {
  let server = null;
  let browser = null;
  const failures = [];
  const warnings = [];
  const FULL = process.env.SLIDES_CHECK_FULL === '1';
  try {
    server = await startServer();
    browser = await chromium.launch();
    if (SHOT_DIR) fs.mkdirSync(SHOT_DIR, { recursive: true });

    for (const vp of VIEWPORTS) {
      const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
      await page.goto(BASE, { waitUntil: 'networkidle' });
      await page.click('#tab-courses');
      await page.waitForSelector('.course-card', { state: 'visible', timeout: 15000 });

      const sweep = await sweepEverySlide(page);
      const w = sweep.worst || {};
      const bad = sweep.problems.length || sweep.errors.length;
      console.log(
        vp.name.padEnd(10) +
        ' slides=' + String(sweep.slides).padStart(3) +
        ' sections=' + String(sweep.sections).padStart(3) +
        ' decks=' + sweep.decks +
        ' worst: scale-1=' + (w.scaleLowest || 0).toFixed(2) +
        ' pastCard=' + (w.pastCard || 0) +
        ' underNav=' + (w.underNav || 0) +
        ' pastScreen=' + (w.pastScreen || 0) +
        ' scroll=' + (w.scroll || 0) +
        '  ' + (bad ? 'FAIL' : 'OK') +
        (sweep.warnings.length ? '  (warn ' + sweep.warnings.length + ')' : '')
      );
      if (sweep.skippedDecks && sweep.skippedDecks.length) {
        console.log('           تخطّى بلا deck: ' + sweep.skippedDecks.join('، '));
      }

      sweep.errors.forEach((e) => failures.push(vp.name + ' [harness] ' + e));
      // افتراضيًّا نعرض أسوأ ثلاث مشاكل فقط؛ البقية طويلة بلا فائدة. ومن
      // أراد السجلّ كاملًا يمرّر ‎SLIDES_CHECK_FULL=1‎.
      const shown = FULL ? sweep.problems : sweep.problems.slice(0, 3);
      shown.forEach((p) => failures.push(vp.name + ' -> ' + p));
      if (sweep.problems.length > shown.length) {
        failures.push(vp.name + ' -> … and ' + (sweep.problems.length - shown.length) + ' more');
      }
      // تحذيرات الحبر المدرك: نجمعها كعناوين فريدة كي لا يتكرّر نفس الشريحة.
      const wseen = new Set();
      sweep.warnings.forEach((x) => {
        const key = x.split('|').slice(1).join('|');
        if (wseen.has(key)) return;
        wseen.add(key);
        warnings.push(vp.name + ' -> ' + x);
      });

      if (SHOT_DIR) {
        const setup = await openExpandedSceneSlide(page);
        if (!setup.error) {
          await page.screenshot({ path: path.join(SHOT_DIR, 'expanded-' + vp.name + '.png') });
        }
      }
      if (DEBUG) console.log('    (debug per-slide details: ' + JSON.stringify(sweep).slice(0, 400) + ')');
      await page.close();
    }
  } finally {
    if (browser) await browser.close();
    if (server) server.kill();
  }

  if (warnings.length) {
    console.log('');
    console.log('تحذيرات (المعلومة موجودة لكن تحتاج تمريرًا): ' + warnings.length);
    warnings.slice(0, 5).forEach((w) => console.log('  ~ ' + w));
    if (warnings.length > 5) console.log('  ~ … and ' + (warnings.length - 5) + ' more');
  }

  console.log('');
  if (failures.length) {
    console.log('RESULT: FAIL — ' + failures.length + ' viewport(s)');
    failures.forEach((f) => console.log('  - ' + f));
    process.exit(1);
  }
  console.log('RESULT: PASS — الشريحة كاملة داخل الشاشة بلا نزول في كل المقاسات.');
}

main().catch((e) => { console.error('ERROR', e && e.stack ? e.stack : e); process.exit(2); });

