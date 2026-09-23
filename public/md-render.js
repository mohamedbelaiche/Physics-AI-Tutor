/* public/md-render.js
 * عرض مشترك للنص التعليمي (Markdown + KaTeX) يستخدمه course.js و slides-player.js
 * - نفس نمط العرض الأصلي في app.js/course.js: حماية الصيغ LaTeX قبل تحويل Markdown ثم استرجاعها.
 * - يُحمَّل قبل course.js في index.html.
 */
(function () {
  'use strict';

  function renderMath(tex, isDisplay) {
    try {
      return window.katex.renderToString(tex, { throwOnError: false, displayMode: !!isDisplay });
    } catch (err) {
      return (isDisplay ? '$$' : '\\(') + tex + (isDisplay ? '$$' : '\\)');
    }
  }

  function escapeHtml(text) {
    return String(text == null ? '' : text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* مرجع: يقوم بتحويل Markdown + معالجة LaTeX. يضبط المتغيرات dir/rtl داخل كتل markdown عند الحاجة. */
  function renderMarkdownContent(md) {
    if (typeof md !== 'string' || !md) return '';
    var math = [];
    function protect(re, isDisplay) {
      md = md.replace(re, function (match, tex) {
        var token = '\u0001KX' + math.length + '\u0001';
        math.push(renderMath(tex, isDisplay));
        return token;
      });
    }
    // العرض أولاً ثم السطر الواحد، حتى لا تلتقط $ النصية بقايا صيغ العرض.
    protect(/\$\$([\s\S]+?)\$\$/g, true);
    protect(/\\\[([\s\S]+?)\\\]/g, true);
    protect(/\\\(([\s\S]+?)\\\)/g, false);
    protect(/\$([\s\S]+?)\$/g, false);

    var html;
    if (window.marked && typeof window.marked.parse === 'function') {
      html = window.marked.parse(md, { gfm: true, breaks: true });
    } else {
      html = md.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\n/g, '<br>');
    }
    html = html.replace(/\u0001KX(\d+)\u0001/g, function (m, i) {
      return math[+i] || '';
    });
    return html;
  }

  window.MdRender = {
    renderMath: renderMath,
    escapeHtml: escapeHtml,
    renderMarkdownContent: renderMarkdownContent
  };
})();