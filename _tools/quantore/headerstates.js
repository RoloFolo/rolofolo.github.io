// Leg alle toestanden van de mobiele/tablet-header vast (dicht, menu open, submenu's open)
// en welke klik (index van element binnen <header>) naar welke toestand leidt.
// Plus de klassewissels bij scrollen. Uitvoer: header-states.json, header-states.css
const { chromium } = require('playwright');
const fs = require('fs');
const URL0 = 'https://www.quantore.com/';

(async () => {
  const b = await chromium.launch();
  const out = {};
  const cssRules = new Set();
  const collectCss = async p => (await p.evaluate(() => { const o = []; for (const s of document.styleSheets) { try { for (const r of s.cssRules) o.push(r.cssText); } catch (e) {} } return o; })).forEach(r => cssRules.add(r));
  const headerHtml = p => p.evaluate(() => document.querySelector('header').outerHTML);

  for (const [v, w] of [['m', 390], ['t', 900]]) {
    const p = await b.newPage({ viewport: { width: w, height: 844 } });
    await p.route(/googletagmanager|google-analytics/, r => r.abort());
    const clickIdx = async i => {
      const box = await p.evaluate(i => { const el = document.querySelector('header').querySelectorAll('*')[i]; if (!el) return null; const r = el.getBoundingClientRect(); return r.width && r.height ? { x: r.x + r.width / 2, y: r.y + r.height / 2 } : null; }, i);
      if (!box) return false;
      await p.mouse.click(box.x, box.y);
      await p.waitForTimeout(700);
      return true;
    };
    const goTo = async path => {
      await p.goto(URL0, { waitUntil: 'networkidle' });
      for (const i of path) await clickIdx(i);
    };
    const states = [], paths = [], trans = {};
    await goTo([]);
    states.push(await headerHtml(p)); paths.push([]);
    for (let s = 0; s < states.length && s < 12; s++) {
      await goTo(paths[s]);
      const cands = await p.evaluate(() => [...document.querySelector('header').querySelectorAll('*')].map((el, i) => [el, i]).filter(([el]) => {
        if (el.closest('a[href]')) return false;
        const big = c => { const r = c.getBoundingClientRect(); return r.width > 3 && r.height > 3; };
        if ([...el.children].some(big) && el.tagName.toLowerCase() !== 'svg') return false;
        if (el.closest('svg') && el.tagName.toLowerCase() !== 'svg') return false;
        const r = el.getBoundingClientRect(); return r.width > 3 && r.height > 3 && r.y < innerHeight;
      }).map(([, i]) => i));
      console.log(v, 'toestand', s, 'kandidaten', cands.length);
      let dirty = false;
      for (const idx of cands) {
        if (dirty) { await goTo(paths[s]); dirty = false; }
        if (!(await clickIdx(idx))) continue;
        if (p.url() !== URL0) { dirty = true; continue; }
        const h = await headerHtml(p);
        if (h === states[s]) continue;
        await collectCss(p);
        dirty = true;
        let t = states.indexOf(h);
        if (t < 0) { t = states.length; states.push(h); paths.push(paths[s].concat(idx)); }
        trans[s + '|' + idx] = t;
        console.log('   ', s, idx, '->', t);
      }
    }
    // Scrollgedrag, langzaam omlaag en weer omhoog.
    await p.goto(URL0, { waitUntil: 'networkidle' });
    const cls = () => p.evaluate(() => [...document.querySelectorAll('body *')].slice(0, 400).map(e => e.getAttribute('class') || ''));
    let prev = await cls(); const scrollLog = [];
    const seq = []; for (let y = 0; y <= 600; y += 10) seq.push(y); for (let y = 600; y >= 0; y -= 10) seq.push(y);
    for (const y of seq) {
      await p.evaluate(y => window.scrollTo(0, y), y);
      await p.waitForTimeout(120);
      const c1 = await cls();
      const sw = {}; prev.forEach((c, i) => { if (c !== c1[i]) sw[c] = c1[i]; });
      if (Object.keys(sw).length) scrollLog.push({ y, sw });
      prev = c1;
    }
    await collectCss(p);
    out[v] = { states, trans, scroll: scrollLog };
    console.log(v, 'toestanden', states.length, 'overgangen', JSON.stringify(trans));
    await p.close();
  }
  fs.writeFileSync('header-states.json', JSON.stringify(out));
  fs.writeFileSync('header-states.css', [...cssRules].join('\n/*@@*/\n'));
  await b.close();
})();
