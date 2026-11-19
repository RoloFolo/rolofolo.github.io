// Prototype-gedrag. Het origineel doet dit met React; hier met vastgelegde toestanden uit het origineel.
// De gegevens (headertoestanden, klassewissels) staan in proto-data.js, gemaakt door build.js.
(function () {
  'use strict';
  var D = window.QP_DATA || {};
  var body = document.body;
  var v = body.getAttribute('data-qp-variant');
  var me = document.currentScript || document.querySelector('script[src*="assets/proto.js"]');
  var ROOT = me.src.replace(/assets\/proto\.js.*$/, '');

  // ---------- Juiste versie bij andere schermbreedte ----------
  function want() { var w = innerWidth; return w >= 1024 ? 'd' : w > 768 ? 't' : 'm'; }
  var rt;
  addEventListener('resize', function () {
    clearTimeout(rt);
    rt = setTimeout(function () { if (want() !== v) location.replace({ d: './', t: 't.html', m: 'm.html' }[want()] + location.hash); }, 200);
  });

  // ---------- Klassen vervangen: laatste (hash-)token van een styled-components klasse ----------
  function swapClass(scope, from, to) {
    var list = scope.querySelectorAll('[class]');
    for (var i = -1; i < list.length; i++) {
      var el = i < 0 ? scope : list[i];
      if (el.getAttribute('class') === from) el.setAttribute('class', to);
    }
  }

  // ---------- Header bij scrollen: krimpen, wegschuiven bij omlaag, terugkomen bij omhoog ----------
  var S = (D.scroll || {})[v];
  var header = function () { return document.querySelector('header'); };
  var compact = false, lastY = scrollY, wrapState = null;
  function setWrap(name) {
    var h = header(); if (!h || !S) return;
    var cur = h.getAttribute('class'), base = cur.replace(/\s\S+$/, '');
    var next = base + ' ' + S.wrap[name];
    if (cur !== next) h.setAttribute('class', next);
    wrapState = name;
  }
  function setCompact(on) {
    var h = header(); if (!h || !S) return;
    var wrapperScope = h.parentElement || h;
    S.compact.forEach(function (pair) { swapClass(wrapperScope, on ? pair[0] : pair[1], on ? pair[1] : pair[0]); });
    compact = on;
  }
  function onScroll() {
    if (!S) return;
    var y = scrollY, down = y > lastY;
    if (y <= 0) { if (compact) setCompact(false); setWrap('top'); }
    else if (!compact && y >= S.compactAt) { setCompact(true); setWrap('hide'); }
    else if (compact && !down && y <= S.expandAt) { setCompact(false); setWrap('scrolled'); }
    else if (compact) { if (y !== lastY) setWrap(down ? 'hide' : 'show'); }
    else setWrap('scrolled');
    lastY = y;
  }
  addEventListener('scroll', onScroll, { passive: true });

  // ---------- Mobiel/tablet-menu: vervang de header door de vastgelegde toestand ----------
  var H = (D.header || {})[v];
  var hState = 0;
  function rooted(html) { return html.split('%ROOT%').join(ROOT); }
  if (H) {
    document.addEventListener('click', function (e) {
      var h = header(); if (!h || !h.contains(e.target)) return;
      var all = h.querySelectorAll('*');
      for (var el = e.target; el && el !== h; el = el.parentElement) {
        var idx = Array.prototype.indexOf.call(all, el);
        var to = H.trans[hState + '|' + idx];
        if (to !== undefined) {
          e.preventDefault();
          var tpl = document.createElement('div');
          tpl.innerHTML = rooted(H.states[to]);
          var fresh = tpl.firstElementChild;
          h.parentNode.replaceChild(fresh, h);
          hState = to;
          document.documentElement.style.overflow = to === 0 ? '' : 'hidden';
          if (to === 0) { compact = false; onScroll(); }
          return;
        }
        if (el.tagName === 'A' && el.getAttribute('href')) return;
      }
    });
  }

  // ---------- Uitklapblokken (footer op mobiel e.d.) ----------
  (D.toggles || []).filter(function (t) { return t.v === v; }).forEach(function (t) {
    document.addEventListener('click', function (e) {
      for (var el = e.target; el && el !== document.body; el = el.parentElement) {
        var c = el.getAttribute('class');
        var open = c === t.openTrigger;
        if (c === t.trigger || open) {
          var scope = el; for (var i = 0; i < t.up; i++) scope = scope.parentElement;
          t.pairs.forEach(function (p) { swapClass(scope, open ? p[1] : p[0], open ? p[0] : p[1]); });
          return;
        }
      }
    });
  });

  // ---------- Sliders (Swiper in het origineel) ----------
  [].forEach.call(document.querySelectorAll('.swiper'), function (sw) {
    var wrap = sw.querySelector('.swiper-wrapper'); if (!wrap) return;
    var slides = [].slice.call(wrap.children);
    var i = 0;
    var box = sw.parentElement;
    var next = box.querySelector('.button-next'), prev = box.querySelector('.button-prev');
    function go(n) {
      var max = Math.max(0, wrap.scrollWidth - sw.clientWidth);
      i = Math.max(0, Math.min(slides.length - 1, n));
      var x = Math.min(slides[i].offsetLeft - slides[0].offsetLeft, max);
      if (x >= max && n > i) return;
      wrap.style.transition = 'transform .3s ease';
      wrap.style.transform = 'translate3d(' + (-x) + 'px,0,0)';
      slides.forEach(function (s, k) {
        s.classList.toggle('swiper-slide-active', k === i);
        s.classList.toggle('swiper-slide-next', k === i + 1);
        s.classList.toggle('swiper-slide-prev', k === i - 1);
      });
    }
    if (next) next.addEventListener('click', function (e) { e.preventDefault(); var max = Math.max(0, wrap.scrollWidth - sw.clientWidth); if (slides[i].offsetLeft - slides[0].offsetLeft < max) go(i + 1); });
    if (prev) prev.addEventListener('click', function (e) { e.preventDefault(); go(i - 1); });
    var sx = null;
    sw.addEventListener('touchstart', function (e) { sx = e.touches[0].clientX; }, { passive: true });
    sw.addEventListener('touchend', function (e) {
      if (sx === null) return; var dx = e.changedTouches[0].clientX - sx; sx = null;
      if (Math.abs(dx) > 40) go(i + (dx < 0 ? 1 : -1));
    });
  });

  // ---------- Formulieren versturen niets ----------
  [].forEach.call(document.querySelectorAll('form[data-proto-form]'), function (f) {
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!f.querySelector('.qp-note')) {
        var n = document.createElement('p'); n.className = 'qp-note';
        n.textContent = 'Dit is een prototype: formulieren worden niet verstuurd.';
        f.appendChild(n);
      }
    });
  });
})();
