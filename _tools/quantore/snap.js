// Stap 1: laad elke pagina in Chromium, wacht tot alles is opgebouwd en sla de afgewerkte DOM op,
// met alle CSS (ook die styled-components via CSSOM invoegt) als één <style>, zonder scripts.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const [, , listFile, outDir, conc = '4'] = process.argv;
const VARIANTS = [['d', 1280], ['t', 900], ['m', 390]];
const urls = fs.readFileSync(listFile, 'utf8').split('\n').filter(Boolean);
fs.mkdirSync(outDir, { recursive: true });

function fileFor(u, v) {
  const p = new URL(u).pathname.replace(/\/+$/, '') || '/index';
  return path.join(outDir, encodeURIComponent(p) + '.' + v + '.html');
}

async function snap(ctx, u, v, w) {
  const out = fileFor(u, v);
  if (fs.existsSync(out)) return 'skip';
  const p = await ctx.newPage();
  await p.setViewportSize({ width: w, height: 900 });
  try {
    await p.goto(u, { waitUntil: 'networkidle', timeout: 60000 });
    // Cookie-melding wegklikken als die er is, daarna langzaam scrollen zodat lazy images en animaties starten.
    await p.evaluate(async () => {
      const h = () => document.documentElement.scrollHeight;
      for (let y = 0; y < h(); y += 400) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 120)); }
      window.scrollTo(0, 0);
    });
    await p.waitForLoadState('networkidle').catch(() => {});
    await p.waitForTimeout(1500);
    const html = await p.evaluate(() => {
      let css = '';
      for (const s of document.styleSheets) {
        try { for (const r of s.cssRules) css += r.cssText + '\n/*@@*/\n'; } catch (e) {}
      }
      // Gatsby-afbeeldingen die nog aan het infaden waren: direct zichtbaar.
      document.querySelectorAll('img[data-main-image]').forEach(img => { img.style.opacity = 1; });
      // Afbeeldingen: houd de versie die de browser echt koos, zonder srcset (scheelt honderden downloads).
      document.querySelectorAll('img').forEach(img => {
        if (img.currentSrc && !img.currentSrc.startsWith('data:')) img.setAttribute('src', img.currentSrc);
        img.removeAttribute('srcset'); img.removeAttribute('sizes'); img.removeAttribute('loading');
        img.removeAttribute('data-src'); img.removeAttribute('data-srcset');
      });
      document.querySelectorAll('picture source').forEach(s => s.remove());
      document.querySelectorAll('script, noscript, style, link[rel=stylesheet], link[rel=preload], link[rel=prefetch], link[rel=preconnect], link[rel=dns-prefetch], link[rel=canonical], link[rel=manifest], link[rel=alternate], iframe, meta[name=robots], meta[name=generator]').forEach(n => n.remove());
      return { css, html: '<!doctype html>\n' + document.documentElement.outerHTML };
    });
    fs.writeFileSync(out.replace(/\.html$/, '.css'), html.css);
    fs.writeFileSync(out, html.html);
    return 'ok';
  } finally { await p.close(); }
}

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, locale: 'nl-NL' });
  // Geen tracking laden.
  await ctx.route(/googletagmanager|google-analytics|hotjar|facebook|doubleclick|cookiebot|clarity/, r => r.abort());
  let i = 0, done = 0;
  const fails = [];
  async function worker() {
    while (i < urls.length) {
      const u = urls[i++];
      for (let t = 0; t < 2; t++) {
        try { for (const [v, w] of VARIANTS) await snap(ctx, u, v, w); break; } catch (e) { if (t) fails.push(u + ' ' + e.message.split('\n')[0]); }
      }
      if (++done % 20 === 0) console.log(done + '/' + urls.length);
    }
  }
  await Promise.all(Array.from({ length: +conc }, worker));
  console.log('klaar', done, 'fouten', fails.length); fails.forEach(f => console.log(f));
  await b.close();
})();
