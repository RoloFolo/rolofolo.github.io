// Stap 2: zet de opgeslagen pagina's om naar een statische site met lokale bestanden.
// Per route drie versies: index.html (desktop ≥1024), t.html (tablet 769–1023), m.html (mobiel ≤768),
// net als het origineel, dat per breedte een andere opbouw rendert.
// Gebruik: node build.js <rawDir> <outDir>
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const [, , rawDir, outDir] = process.argv;
const ASSETS = 'assets';
fs.mkdirSync(path.join(outDir, ASSETS), { recursive: true });

const FILE = { d: 'index.html', t: 't.html', m: 'm.html' };
const pages = fs.readdirSync(rawDir).filter(f => /\.[dtm]\.html$/.test(f)).map(f => {
  const [, enc, v] = f.match(/^(.*)\.([dtm])\.html$/);
  const p = decodeURIComponent(enc);
  return { file: path.join(rawDir, f), css: path.join(rawDir, f.replace(/\.html$/, '.css')), route: p === '/index' ? '/' : p, v };
});
const routes = new Set(pages.map(p => p.route));

const assetMap = new Map();
function assetName(url) {
  if (assetMap.has(url)) return assetMap.get(url);
  const u = new URL(url);
  let ext = path.extname(u.pathname).toLowerCase() || '.bin';
  const fm = u.searchParams.get('fm');
  if (fm) ext = '.' + fm;
  const base = path.basename(u.pathname, path.extname(u.pathname)).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40) || 'f';
  const name = base + '-' + crypto.createHash('sha1').update(url).digest('hex').slice(0, 8) + ext;
  assetMap.set(url, name);
  return name;
}

const ASSET_RE = /(?:https?:)?\/\/(?:images|assets|downloads|videos)\.ctfassets\.net\/[^"'\s)<>\\]+|(?:https?:\/\/(?:www\.)?quantore\.com)?\/(?:static|icons)\/[^"'\s)<>\\]+|(?:https?:\/\/(?:www\.)?quantore\.com)?\/favicon[^"'\s)<>\\]*/g;
function rewriteAssets(text, prefix) {
  return text.replace(ASSET_RE, m => {
    let url = m.replace(/&amp;/g, '&');
    if (url.startsWith('//')) url = 'https:' + url;
    if (url.startsWith('/')) url = 'https://www.quantore.com' + url;
    return prefix + ASSETS + '/' + assetName(url);
  });
}

function rewriteHref(href, prefix) {
  const h = (href || '').trim();
  if (!h || h.startsWith('#') || /^(mailto|tel|javascript):/i.test(h)) return href;
  if (/^https?:/i.test(h) && !/^https?:\/\/(www\.)?quantore\.com(\/|$)/i.test(h)) return href;
  if (!/^(https?:|\/)/i.test(h)) return href;
  const m = h.replace(/^https?:\/\/(www\.)?quantore\.com/i, '').match(/^([^?#]*)([?#].*)?$/);
  const route = (m[1] || '/').replace(/\/+$/, '') || '/';
  const hash = m[2] && m[2].startsWith('#') ? m[2] : '';
  if (!routes.has(route)) return /^(\/extranet|\/myquantos)/.test(route) ? null : 'https://www.quantore.com' + (route === '/' ? '/' : route) + hash;
  return prefix + (route === '/' ? '' : route.slice(1) + '/') + hash;
}

// Geen login: Extranet, Inloggen en de extranet-zoekknop worden verborgen (niet verwijderd,
// zodat de vastgelegde klikposities in de header blijven kloppen). Links worden lokaal.
function clean($, prefix) {
  $('a').each((_, a) => {
    const href = $(a).attr('href') || '';
    if (/extranet|myquantos/i.test(href) || /^inloggen$/i.test($(a).text().trim())) $(a).attr('hidden', '').removeAttr('href');
  });
  $('form').attr('action', '#').attr('data-proto-form', '');
  $('a[href]').each((_, a) => {
    const h = rewriteHref($(a).attr('href'), prefix);
    if (h === null) $(a).removeAttr('href'); else $(a).attr('href', h);
  });
}

// Eén gedeeld opmaakbestand: alle CSS-regels van alle pagina's en versies, zonder dubbele.
const seen = new Set();
let css = '';
const cssFiles = pages.map(pg => pg.css).concat(['interactions.css', 'header-states.css'].map(f => path.join(rawDir, '..', f)).filter(f => fs.existsSync(f)));
for (const f of cssFiles) {
  for (const rule of fs.readFileSync(f, 'utf8').split('\n/*@@*/\n')) {
    if (rule && !seen.has(rule)) { seen.add(rule); css += rule + '\n'; }
  }
}
fs.writeFileSync(path.join(outDir, ASSETS, 'site.css'), rewriteAssets(css, '../'));

const BADGE = '<a class="qp-proto" href="https://www.quantore.com" rel="noopener" title="Naar de echte website">Prototype · niet de officiële website</a>';

for (const pg of pages) {
  const depth = pg.route === '/' ? 0 : pg.route.split('/').filter(Boolean).length;
  const prefix = depth ? '../'.repeat(depth) : './';
  const $ = cheerio.load(fs.readFileSync(pg.file, 'utf8'));

  clean($, prefix);

  // Kies direct de juiste versie voor deze schermbreedte, vóór er iets getekend wordt.
  const chooser = "(function(){var w=innerWidth,v=w>=1024?'d':w>768?'t':'m';if(v!=='" + pg.v + "'){location.replace({d:'./',t:'t.html',m:'m.html'}[v]+location.hash)}})();";
  $('head').prepend('<meta name="robots" content="noindex, nofollow"><script>' + chooser + '</script>');
  $('head').append('<link rel="stylesheet" href="' + prefix + ASSETS + '/site.css"><link rel="stylesheet" href="' + prefix + ASSETS + '/proto.css">');
  $('body').attr('data-qp-variant', pg.v).append(BADGE + '<script src="' + prefix + ASSETS + '/proto-data.js"></script><script src="' + prefix + ASSETS + '/proto.js"></script>');

  const html = rewriteAssets($.html(), prefix);
  const dir = pg.route === '/' ? outDir : path.join(outDir, pg.route.slice(1));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, FILE[pg.v]), html);
}

// Gedragsgegevens voor proto.js: headertoestanden, scrollgedrag en uitklapblokken.
const data = { header: {}, scroll: {}, toggles: [] };
const hsFile = path.join(rawDir, '..', 'header-states.json');
if (fs.existsSync(hsFile)) {
  const hs = JSON.parse(fs.readFileSync(hsFile, 'utf8'));
  for (const v of Object.keys(hs)) {
    if (hs[v].states.length > 1) data.header[v] = {
      trans: hs[v].trans,
      states: hs[v].states.map(h => { const $ = cheerio.load(h, null, false); clean($, '%ROOT%'); return rewriteAssets($.html(), '%ROOT%'); })
    };
  }
}
// Scrollgedrag van de header, afgeleid uit wat het origineel deed (zie headerstates.js).
const WRAP = { top: 'fpJJVw', scrolled: 'kpkoes', hide: 'eZXlx', show: 'hqRMlw' };
const COMPACT = [['styles__FlexHeader-sc-f6zwk3-2 jdemUg', 'styles__FlexHeader-sc-f6zwk3-2 jjeFzL'], ['styles__LogoWrapper-sc-f6zwk3-4 CJITg', 'styles__LogoWrapper-sc-f6zwk3-4 CJITf'], ['styles__Logo-sc-f6zwk3-5 kLOavP', 'styles__Logo-sc-f6zwk3-5 ctKIJy']];
data.scroll.m = { wrap: WRAP, compact: COMPACT, compactAt: 160, expandAt: 90 };
data.scroll.t = { wrap: WRAP, compact: COMPACT, compactAt: 170, expandAt: 100 };
data.scroll.d = { wrap: WRAP, compact: COMPACT.concat([['styles__MenuWrapper-sc-tpo0xw-0 fHEPOf', 'styles__MenuWrapper-sc-tpo0xw-0 fpVbMd']]), compactAt: 200, expandAt: 100 };
const inFile = path.join(rawDir, '..', 'interactions.json');
if (fs.existsSync(inFile)) {
  for (const r of JSON.parse(fs.readFileSync(inFile, 'utf8'))) {
    if (/SliderButton|ChevronButton|button-background|chevron-icon/.test(r.trigger)) continue; // slider: eigen code
    const pairs = Object.entries(r.swaps).filter(([a, b]) => !/swiper-slide/.test(a));
    data.toggles.push({ v: r.v, trigger: r.trigger, openTrigger: r.swaps[r.trigger] || null, up: r.up, pairs });
  }
}
fs.writeFileSync(path.join(outDir, ASSETS, 'proto-data.js'), 'window.QP_DATA=' + JSON.stringify(data) + ';');

fs.writeFileSync(path.join(rawDir, '..', 'assets.json'), JSON.stringify([...assetMap]));
console.log('routes', routes.size, 'bestanden', pages.length, 'css-regels', seen.size, 'assets', assetMap.size);
