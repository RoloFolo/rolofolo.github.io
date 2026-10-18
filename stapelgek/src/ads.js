// Rewarded video ads, always the player's own choice.
// The Android app can supply a bridge (window.StapelgekAds.show(id)) that plays a real AdMob video and answers
// with window.stapelgekAdDone(id, rewarded). Until that exists, a test screen stands in for the video.

const TEST_SECONDS = 5;
let pending = null;
let nextId = 1;

window.stapelgekAdDone = (id, rewarded) => {
  if (pending && pending.id === id) {
    const { resolve } = pending;
    pending = null;
    resolve(!!rewarded);
  }
};

export function showRewardedAd(reason) {
  if (pending) return Promise.resolve(false);
  return new Promise((resolve) => {
    const id = nextId++;
    pending = { id, resolve };
    const bridge = window.StapelgekAds;
    if (bridge && typeof bridge.show === 'function') bridge.show(id);
    else testVideo(id, reason);
  });
}

function testVideo(id, reason) {
  const el = document.getElementById('ad');
  const bar = document.getElementById('ad-bar');
  const count = document.getElementById('ad-count');
  document.getElementById('ad-reason').textContent = reason;
  el.classList.add('show');
  const started = performance.now();
  let closed = false;
  const tick = () => {
    if (closed) return;
    const t = Math.min(1, (performance.now() - started) / (TEST_SECONDS * 1000));
    bar.style.width = `${t * 100}%`;
    count.textContent = Math.ceil(TEST_SECONDS * (1 - t));
    if (t < 1) { requestAnimationFrame(tick); return; }
    finish(true);
  };
  const finish = (rewarded) => {
    closed = true;
    el.classList.remove('show');
    document.getElementById('ad-skip').onclick = null;
    window.stapelgekAdDone(id, rewarded);
  };
  document.getElementById('ad-skip').onclick = () => finish(false);
  requestAnimationFrame(tick);
}
