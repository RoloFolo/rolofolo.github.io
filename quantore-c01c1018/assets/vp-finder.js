// Verkooppuntenzoeker (prototype): klikbare kaart van NL en BE met provincies, gemeenten en alle Quantore-kantoorvakhandels.
// Data: assets/vp-data.js (gegenereerd door _tools/quantore/verkooppunten/build-map.js). Laadt niets van buiten.
(function () {
  'use strict';
  var D = window.VP_DATA, root = document.getElementById('vp-finder');
  if (!D || !root) return;
  var NS = 'http://www.w3.org/2000/svg';
  var KM = 111.32 / 240;   // projectie-eenheid in km (zie build-map.js: K = 240)

  // ---------- indexen ----------
  var prov = {}, gem = {}, gemsOf = {};
  D.provinces.forEach(function (p) { prov[p.id] = p; gemsOf[p.id] = []; });
  D.gemeenten.forEach(function (g) { gem[g.id] = g; gemsOf[g.prov].push(g); });
  D.stores.forEach(function (s, i) { s.i = i; });

  var st = { prov: null, gem: null, sel: null, q: '', filter: 'all' };

  // ---------- hulpfuncties ----------
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); }
  function norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/['’]/g, ''); }
  function el(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }
  function byName(a, b) { return a.name.localeCompare(b.name, 'nl'); }
  function inFilter(s) { return st.filter === 'all' || (st.filter === 'web' ? s.webOnly : !s.webOnly); }
  function matches(s, q) {
    if (!q) return true;
    var g = gem[s.gem], p = prov[s.prov];
    var hay = norm([s.name, s.city, s.street, g && g.name, p && p.name].join(' ')) + ' ' + norm(s.pc).replace(/\s/g, '');
    return q.split(/\s+/).every(function (w) { return hay.indexOf(w) >= 0; });
  }
  function visible(s) { return inFilter(s) && matches(s, st.q); }
  function storesWhere(fn) { return D.stores.filter(function (s) { return inFilter(s) && fn(s); }); }
  function count(key, id) { return storesWhere(function (s) { return s[key] === id; }).length; }
  function dist(s, x, y) { return Math.hypot(s.x - x, s.y - y) * KM; }
  function cityOrder(a, b) { return a.city.localeCompare(b.city, 'nl') || a.name.localeCompare(b.name, 'nl'); }

  var ICON = {
    search: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M9.5 18.25a8.75 8.75 0 1 1 7-3.51l6.03 6.03a1.25 1.25 0 0 1-1.77 1.77l-6.02-6.03a8.71 8.71 0 0 1-5.24 1.74Zm0-2.5a6.25 6.25 0 1 0 0-12.5 6.25 6.25 0 0 0 0 12.5Z"/></svg>',
    phone: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M6.6 10.8a15.2 15.2 0 0 0 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1A17 17 0 0 1 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1l-2.3 2.2Z"/></svg>',
    web: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm6.9 6h-2.9a15.6 15.6 0 0 0-1.4-3.6A8 8 0 0 1 18.9 8ZM12 4c.8 1.2 1.5 2.5 1.9 4h-3.8c.4-1.4 1.1-2.8 1.9-4ZM4.3 14a8.2 8.2 0 0 1 0-4h3.4a16.5 16.5 0 0 0 0 4H4.3Zm.8 2h3a15.6 15.6 0 0 0 1.3 3.6A8 8 0 0 1 5.1 16Zm3-8h-3a8 8 0 0 1 4.3-3.6C8.8 5.5 8.4 6.7 8.1 8ZM12 20c-.8-1.2-1.5-2.5-1.9-4h3.8c-.4 1.4-1.1 2.8-1.9 4Zm2.3-6H9.7a14.7 14.7 0 0 1 0-4h4.6a14.7 14.7 0 0 1 0 4Zm.3 5.6c.6-1.1 1-2.3 1.3-3.6h3a8 8 0 0 1-4.3 3.6Zm1.7-5.6a16.5 16.5 0 0 0 0-4h3.4a8.2 8.2 0 0 1 0 4h-3.4Z"/></svg>',
    route: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7Zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5Z"/></svg>',
    back: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M15.4 5.4 14 4l-8 8 8 8 1.4-1.4L8.8 12z"/></svg>',
  };

  // ---------- opbouw ----------
  var total = D.stores.length;
  root.innerHTML =
    '<div class="vp__bar">' +
      '<label class="vp__search">' + ICON.search +
        '<span class="qp-sr" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)">Zoek een kantoorvakhandel</span>' +
        '<input type="search" autocomplete="off" placeholder="Zoek op plaats, postcode of naam">' +
        '<button type="button" class="vp__clear" aria-label="Zoekveld leegmaken" hidden>×</button>' +
      '</label>' +
      '<div class="vp__filters" role="group" aria-label="Soort verkooppunt">' +
        '<button type="button" data-f="all" aria-pressed="true">Alle</button>' +
        '<button type="button" data-f="shop" aria-pressed="false">Met winkel</button>' +
        '<button type="button" data-f="web" aria-pressed="false">Alleen online</button>' +
      '</div>' +
    '</div>' +
    '<div class="vp__grid">' +
      '<div class="vp__map">' +
        '<svg role="img" aria-label="Kaart van Nederland en België met Quantore-kantoorvakhandels"></svg>' +
        '<div class="vp__mapbar"><button type="button" class="vp__back" hidden>' + ICON.back + '<span>Terug</span></button><span class="vp__place"></span></div>' +
        '<div class="vp__legend"><span><i></i>Kantoorvakhandel</span><span><i class="web"></i>Alleen online</span></div>' +
        '<div class="vp__zoom"><button type="button" data-z="1.6" aria-label="Inzoomen">+</button><button type="button" data-z="0.625" aria-label="Uitzoomen">−</button></div>' +
        '<div class="vp__tip" role="tooltip"></div>' +
      '</div>' +
      '<aside class="vp__panel" aria-live="polite">' +
        '<div class="vp__head"><ol class="vp__crumbs"></ol><h2 class="vp__title"></h2><p class="vp__sub"></p></div>' +
        '<div class="vp__body"></div>' +
      '</aside>' +
    '</div>';

  var $ = function (s) { return root.querySelector(s); };
  var svg = $('.vp__map svg'), mapBox = $('.vp__map'), tip = $('.vp__tip'), body = $('.vp__body'), input = $('input');
  var gProv = el('g', {}, svg), gGem = el('g', {}, svg), gLine = el('g', {}, svg), gLab = el('g', {}, svg), gPins = el('g', {}, svg);

  var provEls = {};
  D.provinces.forEach(function (p) {
    var path = el('path', { d: p.d, class: 'vp-shape vp-prov', 'data-p': p.id }, gProv);
    provEls[p.id] = path;
  });
  var outline = el('path', { class: 'vp-outline', d: '' }, gLine);

  var pinEls = [];
  D.stores.slice().sort(function (a, b) { return a.y - b.y; }).forEach(function (s) {
    var g = el('g', { class: 'vp-pin' + (s.webOnly ? ' web' : ''), 'data-s': s.i }, gPins);
    el('ellipse', { class: 's', cx: 0, cy: 0, rx: 3.5, ry: 1.3 }, g);
    el('path', { class: 'b', d: 'M0 0C-1.6-3.4-7.5-8-7.5-13a7.5 7.5 0 1 1 15 0C7.5-8 1.6-3.4 0 0z' }, g);
    el('circle', { class: 'd', cx: 0, cy: -13, r: 2.8 }, g);
    pinEls[s.i] = g;
  });

  // ---------- beeldvak ----------
  var vb = [0, 0, D.w, D.h];
  var anim = null;
  function size() { return [svg.clientWidth || 600, svg.clientHeight || 600]; }
  function upp() { var z = size(); return Math.max(vb[2] / z[0], vb[3] / z[1]); }
  function pinScale() { return (st.gem ? 1.25 : st.prov ? 1.1 : 0.7) * (size()[0] < 560 ? .8 : 1); }
  function applyView() {
    svg.setAttribute('viewBox', vb.map(function (v) { return v.toFixed(2); }).join(' '));
    var u = upp(), k = u * pinScale();
    [].forEach.call(gLab.children, function (t) {   // labels blijven even groot op het scherm
      t.setAttribute('transform', 'translate(' + t.getAttribute('data-x') + ' ' + t.getAttribute('data-y') + ') scale(' + u.toFixed(4) + ')');
    });
    D.stores.forEach(function (s) {
      var big = s.i === st.sel ? 1.35 : 1;
      pinEls[s.i].setAttribute('transform', 'translate(' + s.x + ' ' + s.y + ') scale(' + (k * big).toFixed(3) + ')');
    });
  }
  function fit(b, minSize, pad) {
    var z = size(), w = Math.max(b[2] - b[0], minSize || 0), h = Math.max(b[3] - b[1], minSize || 0);
    var cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2;
    w *= 1 + (pad || .12) * 2; h *= 1 + (pad || .12) * 2;
    var u = Math.max(w / z[0], h / z[1]);
    return [cx - z[0] * u / 2, cy - z[1] * u / 2, z[0] * u, z[1] * u];
  }
  function animateTo(to, ms) {
    if (anim) cancelAnimationFrame(anim);
    var from = vb.slice(), t0 = performance.now(), dur = ms == null ? 450 : ms;
    if (!dur || matchMedia('(prefers-reduced-motion: reduce)').matches) { vb = to; applyView(); return; }
    (function step(t) {
      var p = Math.min(1, (t - t0) / dur), e = p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
      vb = from.map(function (v, i) { return v + (to[i] - v) * e; });
      applyView();
      anim = p < 1 ? requestAnimationFrame(step) : null;
    })(t0);
  }
  function targetBox() {
    if (st.gem) return fit(gem[st.gem].bbox, 60, .25);
    if (st.prov) return fit(prov[st.prov].bbox, 60, .06);
    if (st.q.length >= 2) {
      var hit = D.stores.filter(visible);
      if (hit.length && hit.length < total) {
        var b = [Infinity, Infinity, -Infinity, -Infinity];
        hit.forEach(function (s) { b = [Math.min(b[0], s.x), Math.min(b[1], s.y), Math.max(b[2], s.x), Math.max(b[3], s.y)]; });
        return fit(b, 50, .2);
      }
    }
    return fit([0, 0, D.w, D.h], 0, .02);
  }

  // ---------- kaart bijwerken ----------
  function drawGemeenten() {
    var want = st.prov || '';
    if (gGem.getAttribute('data-p') !== want) {
      gGem.innerHTML = '';
      gGem.setAttribute('data-p', want);
      if (want) gemsOf[want].forEach(function (g) { el('path', { d: g.d, class: 'vp-shape vp-gem', 'data-g': g.id }, gGem); });
    }
    [].forEach.call(gGem.children, function (path) {
      var id = path.getAttribute('data-g');
      path.classList.toggle('has', count('gem', id) > 0);
      path.classList.toggle('sel', id === st.gem);
    });
    outline.setAttribute('d', st.prov ? prov[st.prov].d : '');
    // Namen van gemeenten met een kantoorvakhandel (en de gekozen gemeente)
    gLab.innerHTML = '';
    if (want) gemsOf[want].forEach(function (g) {
      var here = storesWhere(function (s) { return s.gem === g.id; });
      if (g.id !== st.gem && !here.length) return;
      // Onder de pin van de eerste winkel, anders midden in de gemeente
      var at = here.length ? [here[0].x, here[0].y, '1.2em'] : [g.lx, g.ly, '.35em'];
      var t = el('text', { class: 'vp-label' + (g.id === st.gem ? ' sel' : ''), 'data-x': at[0], 'data-y': at[1], dy: at[2] }, gLab);
      t.textContent = g.name;
    });
  }
  function updateMap(animate) {
    D.provinces.forEach(function (p) {
      var e = provEls[p.id];
      e.classList.toggle('has', count('prov', p.id) > 0);
      e.classList.toggle('active', p.id === st.prov);
      e.classList.toggle('dim', !!st.prov && p.id !== st.prov);
    });
    drawGemeenten();
    D.stores.forEach(function (s) {
      var pin = pinEls[s.i];
      pin.classList.toggle('off', !visible(s));
      pin.classList.toggle('out', !!st.prov && s.prov !== st.prov);
      pin.classList.toggle('hl', s.i === st.sel);
    });
    if (st.sel != null) gPins.appendChild(pinEls[st.sel]);
    $('.vp__back').hidden = !st.prov;
    $('.vp__place').textContent = st.gem ? gem[st.gem].name : st.prov ? prov[st.prov].name : '';
    animateTo(targetBox(), animate === false ? 0 : 450);
  }

  // ---------- paneel ----------
  function card(s, ref) {
    var web = s.web ? s.web.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '') : '';
    var href = s.web && !/^https?:/i.test(s.web) ? 'https://' + s.web : s.web;
    var km = ref ? '<span class="km">' + dist(s, ref[0], ref[1]).toFixed(dist(s, ref[0], ref[1]) < 10 ? 1 : 0).replace('.', ',') + ' km</span>' : '';
    return '<li class="vp-card" data-s="' + s.i + '">' + km +
      (s.webOnly ? '<span class="tag web">Alleen online</span>' : '') +
      '<h3><button type="button" data-show="' + s.i + '">' + esc(s.name) + '</button></h3>' +
      '<address>' + esc(s.street) + '<br>' + esc(s.pc) + ' ' + esc(s.city) + (s.country === 'BE' ? ', België' : '') + '</address>' +
      '<div class="acts">' +
        (s.phone ? '<a href="tel:' + esc(s.phone.replace(/[^\d+]/g, '')) + '">' + ICON.phone + esc(s.phone) + '</a>' : '') +
        (href ? '<a href="' + esc(href) + '" target="_blank" rel="noopener noreferrer">' + ICON.web + esc(s.webOnly ? 'Naar webshop' : web) + '</a>' : '') +
        (!s.webOnly ? '<a href="https://www.google.com/maps/dir/?api=1&amp;destination=' + s.lat + ',' + s.lng + '" target="_blank" rel="noopener noreferrer">' + ICON.route + 'Route</a>' : '') +
      '</div></li>';
  }
  function cards(list, ref) { return '<ul class="vp__cards">' + list.map(function (s) { return card(s, ref); }).join('') + '</ul>'; }
  function regionList(country) {
    return '<ul class="vp__regions">' + D.provinces.filter(function (p) { return p.country === country; }).sort(byName).map(function (p) {
      var n = count('prov', p.id);
      return '<li><button type="button" data-go="' + p.id + '"' + (n ? '' : ' class="zero"') + '><span>' + esc(p.name) + '</span><b>' + n + '</b></button></li>';
    }).join('') + '</ul>';
  }
  function gemChips(list) {
    return '<ul class="vp__chips">' + list.map(function (g) {
      var n = count('gem', g.id);
      return '<li><button type="button" data-go="' + g.prov + '/' + g.id + '">' + esc(g.name) + (n ? ' <b>' + n + '</b>' : '') + '</button></li>';
    }).join('') + '</ul>';
  }
  function crumbs() {
    var c = ['<li><button type="button" data-go="">Nederland &amp; België</button></li>'];
    if (st.prov) c.push(st.gem ? '<li><button type="button" data-go="' + st.prov + '">' + esc(prov[st.prov].name) + '</button></li>' : '<li>' + esc(prov[st.prov].name) + '</li>');
    if (st.gem) c.push('<li>' + esc(gem[st.gem].name) + '</li>');
    return c.length > 1 ? c.join('') : '';
  }
  var SRC = '<p class="vp__src">Adressen: quantore.com, ' + esc(D.generated.split('-').reverse().join('-')) + '. Kaart: CBS/PDOK, geoBoundaries.</p>';

  function renderPanel() {
    var title, sub, html = '';
    $('.vp__crumbs').innerHTML = crumbs();
    if (st.q && !st.prov) {
      var hits = D.stores.filter(visible).sort(cityOrder), q = norm(st.q);
      var gHits = D.gemeenten.filter(function (g) { return norm(g.name).indexOf(q) === 0; }).sort(byName).slice(0, 8);
      title = 'Zoekresultaten';
      sub = plural(hits.length, 'kantoorvakhandel', 'kantoorvakhandels') + ' voor “' + esc(st.q) + '”';
      if (gHits.length) html += '<h3 class="vp__h">Gemeenten</h3>' + gemChips(gHits);
      html += hits.length ? '<h3 class="vp__h">Kantoorvakhandels</h3>' + cards(hits) :
        '<p class="vp__empty">Geen kantoorvakhandel gevonden. Probeer een plaatsnaam of kies een regio op de kaart.</p>';
    } else if (st.gem) {
      var g = gem[st.gem], here = storesWhere(function (s) { return s.gem === g.id && matches(s, st.q); }).sort(byName);
      var ref = [g.lx, g.ly];
      title = g.name;
      sub = (here.length ? plural(here.length, 'kantoorvakhandel', 'kantoorvakhandels') : 'Geen kantoorvakhandel') + ' · ' + (g.country === 'BE' ? 'provincie ' : '') + esc(prov[g.prov].name);
      if (here.length) html += cards(here);
      var near = storesWhere(function (s) { return s.gem !== g.id; })
        .map(function (s) { return { s: s, d: dist(s, ref[0], ref[1]) }; })
        .sort(function (a, b) { return a.d - b.d; })
        .filter(function (x, i) { return here.length ? x.d < 20 && i < 3 : i < 4; })
        .map(function (x) { return x.s; });
      var soort = st.filter === 'web' ? 'webwinkel' : st.filter === 'shop' ? 'kantoorvakhandel met winkel' : 'Quantore-kantoorvakhandel';
      if (!here.length) html += '<p class="vp__note">In ' + esc(g.name) + ' zit (nog) geen ' + soort + '. Dit zijn de dichtstbijzijnde:</p>' + cards(near, ref);
      else if (near.length) html += '<h3 class="vp__h">Ook in de buurt</h3>' + cards(near, ref);
    } else if (st.prov) {
      var p = prov[st.prov], list = storesWhere(function (s) { return s.prov === p.id && matches(s, st.q); }).sort(cityOrder);
      var withStores = gemsOf[p.id].filter(function (x) { return count('gem', x.id) > 0; }).sort(byName);
      title = p.name;
      sub = list.length ? plural(list.length, 'kantoorvakhandel', 'kantoorvakhandels') + ' in ' + plural(withStores.length, 'gemeente', 'gemeenten') : 'Geen kantoorvakhandel in deze provincie';
      html += '<p class="vp__note">Klik op een gemeente op de kaart voor de ondernemers bij jou in de buurt.</p>';
      if (withStores.length) html += '<h3 class="vp__h">Gemeenten met een kantoorvakhandel</h3>' + gemChips(withStores);
      if (list.length) html += '<h3 class="vp__h">Alle kantoorvakhandels in ' + esc(p.name) + '</h3>' + cards(list);
      else {
        var c = [(p.bbox[0] + p.bbox[2]) / 2, (p.bbox[1] + p.bbox[3]) / 2];
        var nb = storesWhere(function () { return true; }).sort(function (a, b) { return dist(a, c[0], c[1]) - dist(b, c[0], c[1]); }).slice(0, 4);
        html += '<h3 class="vp__h">Dichtstbijzijnde kantoorvakhandels</h3>' + cards(nb, c);
      }
    } else {
      var n = storesWhere(function () { return true; }).length;
      title = 'Kies een regio';
      sub = plural(n, 'kantoorvakhandel', 'kantoorvakhandels') + ' in Nederland en België. Klik op een provincie op de kaart of hieronder.';
      html += '<h3 class="vp__h">Nederland</h3>' + regionList('NL') + '<h3 class="vp__h">België</h3>' + regionList('BE');
    }
    $('.vp__title').textContent = title;
    $('.vp__sub').innerHTML = sub;
    body.innerHTML = html + SRC;
    body.scrollTop = 0;
    highlight(st.sel, true);
  }

  function highlight(i, scroll) {
    [].forEach.call(root.querySelectorAll('.vp-card.hl'), function (c) { c.classList.remove('hl'); });
    D.stores.forEach(function (s) { pinEls[s.i].classList.toggle('hl', s.i === i); });
    if (i == null) return;
    gPins.appendChild(pinEls[i]);
    var c = body.querySelector('.vp-card[data-s="' + i + '"]');
    if (c) {
      c.classList.add('hl');
      if (scroll && body.scrollHeight > body.clientHeight) body.scrollTop = c.offsetTop - body.offsetTop - 12;
    }
  }

  // ---------- navigatie (met adresbalk, zodat terug-knop en delen werken) ----------
  function readHash() {
    var parts = decodeURIComponent(location.hash.replace(/^#\/?/, '')).split('/');
    st.prov = prov[parts[0]] ? parts[0] : null;
    st.gem = st.prov && gem[parts[1]] && gem[parts[1]].prov === st.prov ? parts[1] : null;
    var s = parts[2] != null ? D.stores[+parts[2]] : null;
    st.sel = s && s.gem === st.gem ? s.i : null;
  }
  function go(p, g, sel, replace) {
    var h = p ? '#' + p + (g ? '/' + g + (sel != null ? '/' + sel : '') : '') : '';
    var url = location.pathname + location.search + h;
    if (url !== location.pathname + location.search + location.hash) history[replace ? 'replaceState' : 'pushState'](null, '', url);
    route();
  }
  function route(noAnim) {
    readHash();
    if (st.prov && st.q) { st.q = ''; input.value = ''; syncClear(); }   // regio gekozen: zoekopdracht klaar
    updateMap(!noAnim); renderPanel(); hideTip();
  }
  addEventListener('popstate', function () { route(); });
  function up() { if (st.gem) go(st.prov); else if (st.prov) go(null); }

  // ---------- interactie op de kaart ----------
  function showTip(e, html) {
    var r = mapBox.getBoundingClientRect();
    tip.innerHTML = html;
    tip.style.left = Math.min(Math.max(e.clientX - r.left, 80), r.width - 80) + 'px';
    tip.style.top = (e.clientY - r.top) + 'px';
    tip.classList.add('on');
  }
  function hideTip() { tip.classList.remove('on'); }
  var drag = null, moved = false;
  svg.addEventListener('pointermove', function (e) {
    if (drag) {
      var u = upp(), dx = (e.clientX - drag.x) * u, dy = (e.clientY - drag.y) * u;
      if (Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y) > 5) moved = true;
      if (moved) { vb = [drag.vb[0] - dx, drag.vb[1] - dy, vb[2], vb[3]]; applyView(); hideTip(); return; }
    }
    if (e.pointerType === 'touch') return;
    var t = e.target, pin = t.closest && t.closest('.vp-pin');
    if (pin) { var s = D.stores[+pin.getAttribute('data-s')]; return showTip(e, esc(s.name) + '<small>' + esc(s.city) + (s.webOnly ? ' · alleen online' : '') + '</small>'); }
    var gid = t.getAttribute && t.getAttribute('data-g'), pid = t.getAttribute && t.getAttribute('data-p');
    if (gid) { var n = count('gem', gid); return showTip(e, esc(gem[gid].name) + '<small>' + (n ? plural(n, 'kantoorvakhandel', 'kantoorvakhandels') : 'geen kantoorvakhandel') + '</small>'); }
    if (pid) { var m = count('prov', pid); return showTip(e, esc(prov[pid].name) + '<small>' + (m ? plural(m, 'kantoorvakhandel', 'kantoorvakhandels') : 'geen kantoorvakhandel') + '</small>'); }
    hideTip();
  });
  svg.addEventListener('pointerleave', hideTip);
  svg.addEventListener('pointerdown', function (e) {
    if (e.button) return;
    if (anim) { cancelAnimationFrame(anim); anim = null; }
    drag = { x: e.clientX, y: e.clientY, vb: vb.slice() }; moved = false;
  });
  addEventListener('pointerup', function () { drag = null; });
  addEventListener('pointercancel', function () { drag = null; });
  svg.addEventListener('click', function (e) {
    if (moved) { moved = false; return; }
    var t = e.target, pin = t.closest('.vp-pin');
    if (pin) { var s = D.stores[+pin.getAttribute('data-s')]; return go(s.prov, s.gem, s.i); }
    var gid = t.getAttribute('data-g'), pid = t.getAttribute('data-p');
    if (gid) return go(st.prov, gid === st.gem ? null : gid);
    if (pid) return go(pid);
    if (st.prov) up();
  });
  $('.vp__zoom').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    var f = +b.getAttribute('data-z'), cx = vb[0] + vb[2] / 2, cy = vb[1] + vb[3] / 2, w = vb[2] / f, h = vb[3] / f;
    if (w > D.w * 2.5 || w < 12) return;
    animateTo([cx - w / 2, cy - h / 2, w, h], 250);
  });
  $('.vp__back').addEventListener('click', up);

  // ---------- paneel, zoeken, filter ----------
  root.addEventListener('click', function (e) {
    var b = e.target.closest('[data-go],[data-show],[data-f]');
    if (!b || !root.contains(b)) return;
    if (b.hasAttribute('data-go')) {
      var parts = b.getAttribute('data-go').split('/');
      if (st.q && parts[0]) { st.q = ''; input.value = ''; syncClear(); }
      return go(parts[0] || null, parts[1] || null);
    }
    if (b.hasAttribute('data-show')) { var s = D.stores[+b.getAttribute('data-show')]; return go(s.prov, s.gem, s.i); }
    if (b.hasAttribute('data-f')) {
      st.filter = b.getAttribute('data-f');
      [].forEach.call(root.querySelectorAll('[data-f]'), function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      updateMap(); renderPanel();
    }
  });
  body.addEventListener('mouseover', function (e) {
    var c = e.target.closest('.vp-card');
    D.stores.forEach(function (s) { pinEls[s.i].classList.toggle('hl', s.i === st.sel || (c && s.i === +c.getAttribute('data-s'))); });
    if (c) gPins.appendChild(pinEls[+c.getAttribute('data-s')]);
  });
  body.addEventListener('mouseleave', function () { highlight(st.sel); });

  var timer = null;
  function syncClear() { $('.vp__clear').hidden = !input.value; }
  input.addEventListener('input', function () {
    syncClear();
    clearTimeout(timer);
    timer = setTimeout(function () {
      st.q = norm(input.value.trim());
      if (st.q && st.prov) { history.replaceState(null, '', location.pathname + location.search); readHash(); }
      updateMap(); renderPanel();
    }, 180);
  });
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {   // één treffer of één gemeente: meteen erheen
      e.preventDefault();
      var hits = D.stores.filter(visible), q = norm(input.value.trim());
      var g = D.gemeenten.filter(function (x) { return norm(x.name) === q; })[0];
      if (g) { st.q = ''; input.value = ''; syncClear(); go(g.prov, g.id); }
      else if (hits.length === 1) go(hits[0].prov, hits[0].gem, hits[0].i);
    }
  });
  $('.vp__clear').addEventListener('click', function () { input.value = ''; st.q = ''; syncClear(); updateMap(); renderPanel(); input.focus(); });
  root.addEventListener('keydown', function (e) { if (e.key === 'Escape' && e.target !== input) up(); });

  var rz = null;
  addEventListener('resize', function () { clearTimeout(rz); rz = setTimeout(function () { animateTo(targetBox(), 0); }, 120); });

  route(true);
})();
