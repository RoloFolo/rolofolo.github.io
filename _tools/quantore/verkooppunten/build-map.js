// Bouwt assets/vp-data.js voor de verkooppuntenkaart: provincies en gemeenten van NL en BE als SVG-paden,
// plus alle verkooppunten met hun gemeente en provincie (punt-in-polygoon op de onvereenvoudigde grenzen).
// Gebruik: node build-map.js [stores.json] [uitvoer.js]
// Grenzen worden eenmalig gedownload naar ./geo:
//   NL: CBS gebiedsindelingen 2025 via PDOK (gegeneraliseerd)  BE: geoBoundaries gbOpen (ADM2 provincies, ADM4 gemeenten)
const fs = require('fs');
const path = require('path');

const DIR = __dirname;
const STORES = process.argv[2] || path.join(DIR, 'stores.json');
const OUT = process.argv[3] || path.join(DIR, '../../../quantore-c01c1018/assets/vp-data.js');
const GEO = path.join(DIR, 'geo');
const WFS = 'https://service.pdok.nl/cbs/gebiedsindelingen/2025/wfs/v1_0?request=GetFeature&service=WFS&version=2.0.0&outputFormat=json&srsName=EPSG:4326&typeName=';
const GB = 'https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/BEL';
const SOURCES = {
  'nl-prov': WFS + 'provincie_gegeneraliseerd',
  'nl-gem': WFS + 'gemeente_gegeneraliseerd',
  'be-prov': GB + '/ADM2/geoBoundaries-BEL-ADM2_simplified.geojson',
  'be-gem': GB + '/ADM4/geoBoundaries-BEL-ADM4_simplified.geojson',
};

// ---------- projectie: equirectangulair met cos(51.5°), y naar beneden ----------
const LNG0 = 2.5, LAT0 = 53.58, K = 240, COS = Math.cos(51.5 * Math.PI / 180);
const proj = ([lng, lat]) => [(lng - LNG0) * COS * K, (LAT0 - lat) * K];
const r1 = v => Math.round(v * 10) / 10;

// ---------- geometrie ----------
const polys = g => g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
function inRing(p, ring) {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > p[1]) !== (yj > p[1]) && p[0] < (xj - xi) * (p[1] - yi) / (yj - yi) + xi) c = !c;
  }
  return c;
}
const inPoly = (p, poly) => inRing(p, poly[0]) && !poly.slice(1).some(h => inRing(p, h));
const inGeom = (p, g) => polys(g).some(poly => inPoly(p, poly));
function bbox(rings) {
  let b = [Infinity, Infinity, -Infinity, -Infinity];
  for (const r of rings) for (const [x, y] of r) b = [Math.min(b[0], x), Math.min(b[1], y), Math.max(b[2], x), Math.max(b[3], y)];
  return b;
}
const ringArea = r => { let a = 0; for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j][0] + r[i][0]) * (r[j][1] - r[i][1]); return Math.abs(a / 2); };

// Punt binnen de grootste deelvlakte: midden van het breedste binnenstuk op een paar horizontale lijnen.
function interiorPoint(g) {
  const ps = polys(g).sort((a, b) => ringArea(b[0]) - ringArea(a[0]));
  const poly = ps[0], [x0, y0, x1, y1] = bbox([poly[0]]);
  let best = null;
  for (const t of [0.5, 0.4, 0.6, 0.3, 0.7, 0.2, 0.8]) {
    const y = y0 + (y1 - y0) * t, xs = [];
    for (const ring of poly) for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i], [xj, yj] = ring[j];
      if ((yi > y) !== (yj > y)) xs.push(xi + (y - yi) * (xj - xi) / (yj - yi));
    }
    xs.sort((a, b) => a - b);
    for (let i = 0; i + 1 < xs.length; i += 2) {
      const w = xs[i + 1] - xs[i];
      if (!best || w > best.w) best = { w, p: [(xs[i] + xs[i + 1]) / 2, y] };
    }
  }
  return best ? best.p : [(x0 + x1) / 2, (y0 + y1) / 2];
}

// ---------- topologie-veilige vereenvoudiging ----------
// Punten waar drie of meer grenzen samenkomen blijven staan; elk stuk daartussen wordt met Douglas-Peucker
// vereenvoudigd. Twee buren delen hetzelfde stuk met dezelfde eindpunten, dus de grens blijft dicht.
const key = p => p[0].toFixed(6) + ',' + p[1].toFixed(6);
function junctions(features) {
  const nb = new Map();
  for (const f of features) for (const poly of polys(f.geometry)) for (const ring of poly) {
    const n = ring.length - 1;   // GeoJSON-ring: laatste punt = eerste
    for (let i = 0; i < n; i++) {
      const k = key(ring[i]);
      if (!nb.has(k)) nb.set(k, new Set());
      nb.get(k).add(key(ring[(i - 1 + n) % n])).add(key(ring[(i + 1) % n]));
    }
  }
  const fixed = new Set();
  for (const [k, s] of nb) if (s.size > 2) fixed.add(k);
  return fixed;
}
function dp(pts, tol) {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, ay] = pts[a], [bx, by] = pts[b], dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1e-9;
    let md = -1, mi = -1;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs(dy * pts[i][0] - dx * pts[i][1] + bx * ay - by * ax) / L;
      if (d > md) { md = d; mi = i; }
    }
    if (md > tol) { keep[mi] = 1; stack.push([a, mi], [mi, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}
function simplifyRing(ring, fixed, tol) {
  const n = ring.length - 1, P = ring.slice(0, n).map(proj);
  let idx = [];
  for (let i = 0; i < n; i++) if (fixed.has(key(ring[i]))) idx.push(i);
  if (idx.length < 2) {   // los eiland of ring zonder knooppunten: vast punt op 0 en op het verste punt
    let far = 0, fd = -1;
    for (let i = 1; i < n; i++) { const d = Math.hypot(P[i][0] - P[0][0], P[i][1] - P[0][1]); if (d > fd) { fd = d; far = i; } }
    idx = [0, far];
  }
  const out = [];
  for (let s = 0; s < idx.length; s++) {
    const a = idx[s], b = idx[(s + 1) % idx.length], seg = [];
    for (let i = a; ; i = (i + 1) % n) { seg.push(P[i]); if (i === b && seg.length > 1) break; }
    // Zelfde richting voor beide buren, zodat Douglas-Peucker dezelfde punten kiest.
    const flip = key(ring[a]) > key(ring[b]);
    const simp = flip ? dp(seg.slice().reverse(), tol).reverse() : dp(seg, tol);
    out.push(...simp.slice(0, -1));
  }
  return out;
}
function toPath(rings) {
  let d = '';
  for (const r of rings) {
    if (r.length < 3) continue;
    let [px, py] = [r1(r[0][0]), r1(r[0][1])];
    d += 'M' + px + ' ' + py;
    for (let i = 1; i < r.length; i++) {
      const x = r1(r[i][0]), y = r1(r[i][1]), dx = r1(x - px), dy = r1(y - py);
      if (!dx && !dy) continue;
      d += 'l' + dx + (dy < 0 ? '' : ' ') + dy;
      px = x; py = y;
    }
    d += 'z';
  }
  return d.replace(/(^|[^\d])0\./g, '$1.').replace(/-0\./g, '-.');
}
function layer(features, tol, minArea) {
  const fixed = junctions(features);
  return features.map(f => {
    const rings = [];
    for (const poly of polys(f.geometry)) {
      const outer = simplifyRing(poly[0], fixed, tol);
      if (ringArea(outer) < minArea) continue;   // piepkleine eilandjes weglaten
      rings.push(outer);
      for (const h of poly.slice(1)) { const s = simplifyRing(h, fixed, tol); if (ringArea(s) >= minArea) rings.push(s); }
    }
    if (!rings.length) rings.push(simplifyRing(polys(f.geometry)[0][0], fixed, tol));
    return { d: toPath(rings), bbox: bbox(rings).map(r1) };
  });
}

// ---------- namen en regio's ----------
const slug = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const PROV_NAME = { 'Fryslân': 'Friesland', 'Brussels': 'Brussel' };
// Quantore-regio per provincie (slug zoals op quantore.com/verkooppunten/...)
const regionSlug = (country, name) => (country === 'BE' ? 'be-' : '') + slug(name);
function beName(n) {   // tweetalige Brusselse namen: Nederlandse kant
  if (!n.includes('|')) return n;
  return n.split('|').map(s => s.replace('/', '').trim()).pop().replace(/^St-/, 'Sint-').replace(/-St-/, '-Sint-');
}

(async () => {
  fs.mkdirSync(GEO, { recursive: true });
  const geo = {};
  for (const [k, url] of Object.entries(SOURCES)) {
    const f = path.join(GEO, k + '.geojson');
    if (!fs.existsSync(f)) {
      console.log('download', k);
      const r = await fetch(url);
      if (!r.ok) throw new Error(r.status + ' ' + url);
      fs.writeFileSync(f, await r.text());
    }
    geo[k] = JSON.parse(fs.readFileSync(f, 'utf8')).features;
  }

  // Provincies
  const provFeat = [
    ...geo['nl-prov'].map(f => ({ f, country: 'NL', name: PROV_NAME[f.properties.statnaam] || f.properties.statnaam })),
    ...geo['be-prov'].map(f => ({ f, country: 'BE', name: PROV_NAME[f.properties.shapeName] || f.properties.shapeName })),
  ];
  const provShapes = layer(provFeat.map(p => p.f), 0.35, 1.5);
  const provinces = provFeat.map((p, i) => ({
    id: regionSlug(p.country, p.name), name: p.name, country: p.country, ...provShapes[i],
  }));

  // Gemeenten, met provincie via een binnenpunt
  const gemFeat = [
    ...geo['nl-gem'].map(f => ({ f, country: 'NL', name: f.properties.statnaam })),
    ...geo['be-gem'].map(f => ({ f, country: 'BE', name: beName(f.properties.shapeName) })),
  ];
  const gemShapes = layer(gemFeat.map(g => g.f), 0.12, 0.08);
  const seen = new Set();
  const gemeenten = gemFeat.map((g, i) => {
    const ip = interiorPoint(g.f.geometry);
    let prov = provFeat.findIndex(p => p.country === g.country && inGeom(ip, p.f.geometry));
    if (prov < 0) {   // randgevallen: dichtstbijzijnde provincie-middelpunt in hetzelfde land
      let bd = Infinity;
      provFeat.forEach((p, j) => {
        if (p.country !== g.country) return;
        const c = interiorPoint(p.f.geometry), d = Math.hypot(c[0] - ip[0], c[1] - ip[1]);
        if (d < bd) { bd = d; prov = j; }
      });
    }
    let id = (g.country === 'BE' ? 'be-' : '') + slug(g.name);
    while (seen.has(id)) id += '-' + provinces[prov].id;
    seen.add(id);
    const [lx, ly] = proj(ip);
    return { id, name: g.name, country: g.country, prov: provinces[prov].id, ...gemShapes[i], lx: r1(lx), ly: r1(ly) };
  });

  // Verkooppunten
  const stores = JSON.parse(fs.readFileSync(STORES, 'utf8'));
  const warn = [];
  const out = stores.filter(s => s.lat != null).map(s => {
    const p = [s.lng, s.lat];
    let gi = gemFeat.findIndex(g => g.country === s.country && inGeom(p, g.f.geometry));
    if (gi < 0) {   // net buiten de (gegeneraliseerde) kustlijn: dichtstbijzijnde gemeente
      const [x, y] = proj(p); let bd = Infinity;
      gemeenten.forEach((g, j) => { if (g.country !== s.country) return; const d = Math.hypot(g.lx - x, g.ly - y); if (d < bd) { bd = d; gi = j; } });
      warn.push(`buiten grens: ${s.name} (${s.city}) -> ${gemeenten[gi].name}`);
    }
    const g = gemeenten[gi];
    if (g.prov !== s.regionSlug) warn.push(`regio wijkt af: ${s.name} (${s.city}) staat bij ${s.regionSlug}, ligt in ${g.prov}`);
    const [x, y] = proj(p);
    return {
      name: s.name, street: s.street, pc: s.postalCode, city: s.city, phone: s.phone, web: s.website,
      webOnly: s.webOnly, country: s.country, gem: g.id, prov: g.prov, region: s.regionSlug,
      x: r1(x), y: r1(y), lat: +s.lat.toFixed(5), lng: +s.lng.toFixed(5),
    };
  }).sort((a, b) => a.name.localeCompare(b.name, 'nl'));
  warn.forEach(w => console.log('let op:', w));

  const W = r1(proj([7.3, 50])[0]), H = r1(proj([2.5, 49.45])[1]);
  const data = { w: W, h: H, generated: new Date().toISOString().slice(0, 10), provinces, gemeenten, stores: out };
  const js = '// Gegenereerd door _tools/quantore/verkooppunten/build-map.js. Niet met de hand aanpassen.\n' +
    '// Grenzen: CBS/PDOK gebiedsindelingen 2025 (NL), geoBoundaries gbOpen (BE). Adressen: quantore.com.\n' +
    'window.VP_DATA=' + JSON.stringify(data) + ';\n';
  fs.writeFileSync(OUT, js);
  console.log(`${provinces.length} provincies, ${gemeenten.length} gemeenten, ${out.length} verkooppunten -> ${OUT} (${(js.length / 1024).toFixed(0)} kB)`);
})();
