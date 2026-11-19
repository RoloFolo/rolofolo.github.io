// Leg vast welke klassen het origineel wisselt bij een klik (menu's, uitklapblokken),
// plus de CSS die daarbij hoort. Uitvoer: interactions.json en interactions.css
// Gebruik: node capture.js <url> [url...]
const { chromium } = require('playwright');
const fs = require('fs');

const BURGER = '[class*="Toggle__ToggleItem"]';

(async () => {
  const urls = process.argv.slice(2);
  const b = await chromium.launch();
  const records = {};
  const cssRules = new Set();
  const notes = [];

  const allClasses = p => p.evaluate(() => [...document.querySelectorAll('*')].map(e => e.getAttribute('class') || ''));
  const collectCss = async p => (await p.evaluate(() => { const o = []; for (const s of document.styleSheets) { try { for (const r of s.cssRules) o.push(r.cssText); } catch (e) {} } return o; })).forEach(r => cssRules.add(r));

  async function measure(p, v, idx, cls) {
    await p.evaluate(i => document.querySelectorAll('*')[i].scrollIntoView({ block: 'center' }), idx);
    await p.waitForTimeout(900);
    const before = await allClasses(p);
    await p.evaluate(i => document.querySelectorAll('*')[i].dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window })), idx);
    await p.waitForTimeout(900);
    const after = await allClasses(p);
    await collectCss(p);
    if (before.length !== after.length) { notes.push(v + ' ' + cls.slice(0, 50) + ': DOM ' + before.length + '->' + after.length); return; }
    const changed = [];
    for (let i = 0; i < before.length; i++) if (before[i] !== after[i]) changed.push(i);
    if (!changed.length) return;
    const up = await p.evaluate(([ti, ch]) => {
      const all = document.querySelectorAll('*'); let s = all[ti], n = 0;
      while (s && !ch.every(i => s.contains(all[i]))) { s = s.parentElement; n++; }
      return n;
    }, [idx, changed]);
    const key = v + '|' + cls;
    const rec = records[key] || (records[key] = { v, trigger: cls, up, swaps: {} });
    changed.forEach(i => { rec.swaps[before[i]] = after[i]; });
    rec.up = Math.max(rec.up, up);
  }

  for (const [v, w] of [['t', 900], ['m', 390], ['d', 1280]]) {
    for (const url of urls) {
      for (const openBurger of v === 'd' ? [false] : [false, true]) {
        const p = await b.newPage({ viewport: { width: w, height: 900 } });
        await p.route(/googletagmanager|google-analytics/, r => r.abort());
        const prep = async () => {
          await p.goto(url, { waitUntil: 'networkidle' });
          if (openBurger) { await p.click(BURGER); await p.waitForTimeout(900); }
        };
        await prep();
        const cands = await p.evaluate(burgerOpen => {
          const out = new Map();
          document.querySelectorAll('body *').forEach(el => {
            if (el.closest('a') || el.tagName === 'A') return;
            if (getComputedStyle(el).cursor !== 'pointer') return;
            const r = el.getBoundingClientRect();
            if (r.width < 5 || r.height < 5) return;
            if (burgerOpen && !el.closest('[class*=Header], header, nav')) return;
            const cls = el.getAttribute('class') || '';
            if (!cls || out.has(cls)) return;
            out.set(cls, [...document.querySelectorAll('*')].indexOf(el));
          });
          return [...out];
        }, openBurger);
        for (const [cls, idx] of cands) {
          if (openBurger && /Toggle__ToggleItem/.test(cls)) continue;
          await prep();
          await measure(p, v + (openBurger ? '+menu' : ''), idx, cls);
        }
        await p.close();
      }
    }
  }
  fs.writeFileSync('interactions.json', JSON.stringify(Object.values(records), null, 1));
  fs.writeFileSync('interactions.css', [...cssRules].join('\n/*@@*/\n'));
  console.log('interacties', Object.keys(records).length, 'css', cssRules.size);
  Object.values(records).forEach(r => { console.log(r.v, r.trigger.slice(0, 70), 'up', r.up); Object.entries(r.swaps).forEach(([a, c]) => console.log('     ', a.slice(0, 60), '->', c.slice(-12))); });
  notes.forEach(n => console.log('NB', n));
  await b.close();
})();
