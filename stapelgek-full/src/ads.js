// Rewarded video ads, always the player's own choice.
// The Android app supplies a bridge (window.StapelgekFullAds.show(id)) that plays a real AdMob video and answers
// with window.stapelgekfullAdDone(id, rewarded, why); why is 'none' when no video could be had.
// In a browser a test screen stands in for the video.
// The page hears 'ad-start' and 'ad-end' around a video, and 'ad-unavailable' when there was none.

const TEST_SECONDS = 5;
let pending = null;
let nextId = 1;

window.stapelgekfullAdDone = (id, rewarded, why) => {
  if (pending && pending.id === id) {
    const { resolve } = pending;
    pending = null;
    window.dispatchEvent(new Event('ad-end'));
    if (why === 'none') window.dispatchEvent(new Event('ad-unavailable'));
    resolve(!!rewarded);
  }
};

const bridge = () => (window.StapelgekFullAds && typeof window.StapelgekFullAds.show === 'function' ? window.StapelgekFullAds : null);

// Europe and the UK: the settings offer a way to change the ads choice.
export const privacyOptions = () => { try { return !!(bridge() && bridge().privacyOptions()); } catch (e) { return false; } };
export const showPrivacyOptions = () => bridge() && bridge().showPrivacyOptions();

export function showRewardedAd(reason) {
  if (pending) return Promise.resolve(false);
  return new Promise((resolve) => {
    const id = nextId++;
    pending = { id, resolve };
    window.dispatchEvent(new Event('ad-start'));
    if (bridge()) bridge().show(id);
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
    window.stapelgekfullAdDone(id, rewarded);
  };
  document.getElementById('ad-skip').onclick = () => finish(false);
  requestAnimationFrame(tick);
}
