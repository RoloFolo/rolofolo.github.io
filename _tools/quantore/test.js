// Test de kopie: fouten, externe verzoeken, horizontaal scrollen, en interactie op mobiel.
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const base = process.argv[2];
  const routes = fs.readFileSync('top.txt', 'utf8').split('\n').filter(Boolean).map(r => r === '/' ? '' : r.slice(1) + '/');
  const b = await chromium.launch();
  const errs = [];
  for (const [w, tag] of [[1280, 'd'], [900, 't'], [390, 'm']]) {
    const p = await b.newPage({ viewport: { width: w, height: 900 } });
    p.on('response', r => { if (r.status() >= 400) errs.push(r.status() + ' ' + r.url()); });
    p.on('request', r => { const u = r.url(); if (!u.startsWith(base) && !u.startsWith('data:')) errs.push('EXTERN ' + u); });
    p.on('pageerror', e => errs.push('JS ' + tag + ' ' + e.message));
    for (const r of routes) {
      await p.goto(base + r, { waitUntil: 'networkidle' });
      const info = await p.evaluate(() => ({ v: document.body.getAttribute('data-qp-variant'), sw: document.documentElement.scrollWidth, imgs: [...document.images].filter(i => i.complete && i.naturalWidth === 0).map(i => i.src) }));
      if (info.v !== tag) errs.push(tag + ' ' + r + ' verkeerde versie ' + info.v);
      if (info.sw > w + 1) errs.push(tag + ' ' + r + ' horizontale scroll ' + info.sw);
      info.imgs.forEach(s => errs.push(tag + ' ' + r + ' kapotte afbeelding ' + s));
    }
    // Screenshots van de homepage en twee subpagina's
    for (const r of ['', 'cooperatie/', 'assortiment/papier-en-verzenden/']) {
      await p.goto(base + r, { waitUntil: 'networkidle' });
      await p.screenshot({ path: 'test-' + tag + '-' + (r.replace(/\W+/g, '_') || 'home') + '.png', fullPage: true });
    }
  }
  // Mobiel: menu open, submenu open, menu dicht; footerblok open; scrollen.
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  p.on('pageerror', e => errs.push('JS menu ' + e.message));
  await p.goto(base, { waitUntil: 'networkidle' });
  await p.click('[class*="Toggle__ToggleItem"]'); await p.waitForTimeout(500);
  await p.screenshot({ path: 'test-menu-open.png' });
  await p.click('text=Assortiment'); await p.waitForTimeout(500);
  await p.screenshot({ path: 'test-menu-sub.png' });
  await p.mouse.click(33, 73); await p.waitForTimeout(500);
  console.log('menu dicht:', await p.evaluate(() => document.documentElement.style.overflow === ''));
  const t = await p.$('[class*="styles__Toggle-sc-16to5sm-2"]');
  if (t) { await t.scrollIntoViewIfNeeded(); await t.click(); await p.waitForTimeout(400); await p.screenshot({ path: 'test-footer-open.png' }); }
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.evaluate(() => window.scrollTo(0, 400)); await p.waitForTimeout(400);
  console.log('header na scroll:', await p.evaluate(() => document.querySelector('header').className));
  // Slider op desktop
  const d = await b.newPage({ viewport: { width: 1280, height: 900 } });
  await d.goto(base, { waitUntil: 'networkidle' });
  const nx = await d.$('.button-next');
  if (nx) { await nx.scrollIntoViewIfNeeded(); const before = await d.evaluate(() => document.querySelector('.swiper-wrapper').style.transform); await nx.click({ force: true }); await d.waitForTimeout(500); console.log('slider', before, '->', await d.evaluate(() => document.querySelector('.swiper-wrapper').style.transform)); }
  console.log([...new Set(errs)].slice(0, 40).join('\n') || 'geen fouten');
  await b.close();
})();
