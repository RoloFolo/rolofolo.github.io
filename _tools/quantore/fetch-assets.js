// Stap 3: download alle afbeeldingen, lettertypes en iconen met curl (die de proxy gebruikt).
// Gebruik: node fetch-assets.js assets.json <outDir>/_assets
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const [, , list, dir] = process.argv;
const items = JSON.parse(fs.readFileSync(list, 'utf8'));
let i = 0, ok = 0, bytes = 0;
const fails = [];
function curl(url, out) {
  return new Promise((res, rej) => execFile('curl', ['-sSfL', '--retry', '2', '--max-time', '60', '-A', 'Mozilla/5.0', '-o', out, url], err => err ? rej(err) : res()));
}
async function worker() {
  while (i < items.length) {
    const [url, name] = items[i++];
    const out = path.join(dir, name);
    if (fs.existsSync(out) && fs.statSync(out).size > 0) { ok++; continue; }
    try { await curl(url, out); ok++; bytes += fs.statSync(out).size; }
    catch (e) { fails.push(url + ' ' + String(e.message).split('\n')[1]); try { fs.unlinkSync(out); } catch (x) {} }
  }
}
Promise.all(Array.from({ length: 8 }, worker)).then(() => {
  console.log('ok', ok, '/', items.length, 'nieuw MB', (bytes / 1e6).toFixed(1), 'fouten', fails.length);
  fails.slice(0, 20).forEach(f => console.log(f));
});
