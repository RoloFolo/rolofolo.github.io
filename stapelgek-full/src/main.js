// Stacking Mad: stop the floating block above the tower; whatever sticks out is cut off.
// Stapelgek Mini plus tools, goals, lives, special blocks and themes, in English and Dutch.
import {
  AdditiveBlending, BoxGeometry, BufferAttribute, CanvasTexture, Color, DoubleSide, EdgesGeometry, Group,
  LineBasicMaterial, LineSegments, Mesh, MeshBasicMaterial, OrthographicCamera, PlaneGeometry, RepeatWrapping,
  RingGeometry, Scene, Sprite, SpriteMaterial, SRGBColorSpace, Vector3, WebGLRenderer,
} from 'three';
import { store } from './store.js';
import {
  ITEMS, ITEM_IDS, LOADOUT_MAX, MAX_LIVES, addItem, challenge, goals, inventory, itemCount, lives, takeItem, untilTomorrow,
} from './progress.js';
import { audience, privacyOptions, setBirthYear, showPrivacyOptions, showRewardedAd, tellAudience } from './ads.js';
import { NAME, NL, switchLanguage, tr } from './lang.js';

const BASE = 3;          // footprint of the first block
const H = 0.7;           // height of one layer
const PEDESTAL = 6;      // the first block reaches down out of view
const TRAVEL = 4.6;      // how far from the centre a block floats in
const PERFECT = 0.12;    // misses smaller than this snap into place
const GROW = 0.25;       // a perfect streak of 3+ grows the block back by this much
const ISO_UP = 2 / Math.sqrt(6); // screen height of one world unit straight up

const CUT_RED = new Color(0xff1744);

const $ = (id) => document.getElementById(id);
// Themes only change how the game looks; the game itself stays the same.
const THEMES = [
  { id: 'classic', name: tr('Classic', 'Klassiek') },
  { id: 'sky', name: tr('☁️ Sky Journey', '☁️ Hemelreis') },
  { id: 'pixel', name: '🕹️ Pixel Arcade' },
  { id: 'neon', name: tr('🌌 Neon Night', '🌌 Neon Nacht') },
];
const savedTheme = store.get('stapelgekfull-theme', 'classic');
const LOOK = THEMES.some((t) => t.id === savedTheme) ? savedTheme : 'classic';
document.body.classList.add(`look-${LOOK}`);
$('card-toggle').addEventListener('click', () => {
  const folded = $('over').classList.toggle('folded');
  $('card-toggle').textContent = folded ? tr('▴ Show your score', '▴ Toon je score') : tr('▾ See your tower', '▾ Bekijk je toren');
  $('card-toggle').setAttribute('aria-expanded', String(!folded));
});

// ---------- Scene ----------

const renderer = new WebGLRenderer({ antialias: LOOK !== 'pixel', alpha: true });
// Pixel Arcade draws the 3D world at a fraction of the screen resolution, then blows it up into chunky pixels.
renderer.setPixelRatio(LOOK === 'pixel' ? 0.3 : Math.min(window.devicePixelRatio || 1, 2));
document.body.insertBefore(renderer.domElement, $('hud'));

const scene = new Scene();
const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 400);

const world = new Group();
scene.add(world);

const unitBox = new BoxGeometry(1, 1, 1);
// Fixed shade per face instead of lights, so the colours stay bright: top full, right side a bit darker, left darker still.
const unitShaded = new BoxGeometry(1, 1, 1);
{
  const faceShade = [0.84, 0.84, 1, 0.5, 0.68, 0.68]; // +x, -x, +y, -y, +z, -z
  const shades = new Float32Array(24 * 3);
  for (let f = 0; f < 6; f++) for (let v = 0; v < 4; v++) shades.fill(faceShade[f], (f * 4 + v) * 3, (f * 4 + v) * 3 + 3);
  unitShaded.setAttribute('color', new BufferAttribute(shades, 3));
}
const unitEdges = new EdgesGeometry(unitBox);
const unitPlane = new PlaneGeometry(1, 1);
const squareRing = new RingGeometry(0.6, Math.SQRT1_2, 4, 1);
squareRing.rotateZ(Math.PI / 4);
squareRing.rotateX(-Math.PI / 2);

let hue0 = Math.random() * 360;
const hueAt = (level) => (hue0 + level * 9) % 360;
const colorAt = (level) => new Color().setHSL(hueAt(level) / 360, 0.88, 0.6);

const neonHalo = new BoxGeometry(1, 1, 1);
function makeBlock(level, x, y, z, sx, sy, sz) {
  if (LOOK === 'neon') {
    // Neon: a dark glassy block with glowing edges and a soft halo in the same colour.
    const glow = new Color().setHSL(hueAt(level) / 360, 1, 0.62);
    const mesh = new Mesh(unitShaded, new MeshBasicMaterial({ color: glow.clone().multiplyScalar(0.22), vertexColors: true }));
    mesh.add(new LineSegments(unitEdges, new LineBasicMaterial({ color: glow })));
    if (sy <= H) { // the tall first block gets no halo, or it would light up the whole bottom
      const halo = new Mesh(neonHalo, new MeshBasicMaterial({ color: glow, transparent: true, opacity: 0.1, blending: AdditiveBlending, depthWrite: false }));
      halo.scale.set(1.08, 0.96, 1.08);
      mesh.add(halo);
    }
    mesh.position.set(x, y, z);
    mesh.scale.set(sx, sy, sz);
    world.add(mesh);
    return mesh;
  }
  const mesh = new Mesh(unitShaded, new MeshBasicMaterial({ color: colorAt(level), vertexColors: true }));
  mesh.position.set(x, y, z);
  mesh.scale.set(sx, sy, sz);
  world.add(mesh);
  return mesh;
}

function paintSky(level) {
  if (LOOK !== 'classic') return; // the other themes have their own backgrounds
  const h = (hueAt(level) + 170) % 360;
  const sky = $('sky').style;
  sky.setProperty('--sky-top', `hsl(${h}, 95%, 88%)`);
  sky.setProperty('--sky-bottom', `hsl(${(h + 40) % 360}, 85%, 70%)`);
}

// ---------- View ----------

const view = { hh: 10, targetY: 0, worldY: 0, zoom: 1 };
if (LOOK === 'pixel') {
  const c = document.createElement('canvas');
  c.width = 104; c.height = 226;
  const g = c.getContext('2d');
  const bands = ['#0d0b24', '#141038', '#1d1650', '#2a1d66', '#3d2380', '#5a2a8f'];
  bands.forEach((col, i) => { g.fillStyle = col; g.fillRect(0, i * 26, 104, 27); });
  for (let i = 0; i < 6; i++) { g.fillStyle = bands[i + 1] || bands[5]; for (let x = (i % 2); x < 104; x += 2) g.fillRect(x, i * 26 + 25, 1, 1); } // dithered seams
  for (let i = 0; i < 60; i++) { g.fillStyle = i % 7 ? '#ffffff' : '#ffd23f'; g.fillRect((i * 37) % 104, (i * 53) % 140, 1, 1); }
  g.fillStyle = '#ffe9a8'; g.fillRect(74, 22, 14, 14); g.fillRect(72, 25, 18, 8); g.fillRect(77, 20, 8, 18);
  g.fillStyle = '#d9c78a'; g.fillRect(78, 26, 3, 3); g.fillRect(83, 31, 2, 2);
  // a pixel city on the horizon
  const sky = [[0, 18], [8, 30], [14, 22], [22, 40], [30, 26], [38, 34], [46, 20], [54, 44], [62, 28], [70, 36], [80, 24], [88, 38], [96, 30]];
  for (const [x, hgt] of sky) { g.fillStyle = '#120c2c'; g.fillRect(x, 226 - hgt - 40, 9, hgt + 40); g.fillStyle = '#ffd23f'; for (let wy = 226 - hgt - 34; wy < 220; wy += 6) if ((x + wy) % 4 === 0) g.fillRect(x + 3, wy, 2, 2); }
  $('sky').style.background = `url(${c.toDataURL()}) center / 100% 100% no-repeat, #0d0b24`;
}

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const aspect = w / h;
  const hw = Math.max(5.8, 8.5 * aspect);
  view.hh = hw / aspect;
  camera.left = -hw; camera.right = hw; camera.top = view.hh; camera.bottom = -view.hh;
  // Keep the top of the tower a little above the middle of the screen.
  view.targetY = H / 2 - (0.18 * view.hh) / ISO_UP;
  camera.position.set(30, view.targetY + 30, 30);
  camera.lookAt(0, view.targetY, 0);
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}
window.addEventListener('resize', resize);
resize();

// Zoom out so the whole tower fits in the top half of the screen, above the game-over card.
// Hemelreis: at the end the whole journey shows as one picture, with the tower reaching as far as you got.
// Heights map to the picture through a few anchor points (the ground, the moon, the sun), in screen fractions.
const POSTERS = { 1: [[0, 0.905], [100, 0.1]], 2: [[0, 0.915], [100, 0.622], [200, 0.067]] };
function posterY(anchors, h) {
  for (let i = 1; i < anchors.length; i++) {
    const [h0, y0] = anchors[i - 1];
    const [h1, y1] = anchors[i];
    if (h <= h1 || i === anchors.length - 1) return y0 + ((Math.min(h, h1) - h0) / (h1 - h0)) * (y1 - y0);
  }
  return anchors[0][1];
}
function fitToPoster() {
  const h = height();
  const which = h > 100 ? 2 : 1;
  const viewH = window.innerHeight;
  const ground = posterY(POSTERS[which], 0) * viewH;
  const top = posterY(POSTERS[which], h) * viewH;
  const k = (ISO_UP * viewH) / (2 * view.hh); // screen pixels per world unit straight up
  view.zoom = Math.min(1, (ground - top) / ((game.level * H + PEDESTAL) * k));
  view.worldY = view.targetY + PEDESTAL + (viewH / 2 - ground) / (k * view.zoom);
  document.body.classList.add(`poster-${which}`);
  $('p1-flag').style.display = h >= 100 ? '' : 'none';
}

function showWholeTower() {
  if (LOOK === 'sky' && height() >= 15) { fitToPoster(); return; }
  const towerHeight = game.level * H;
  view.zoom = Math.min(1, (0.85 * view.hh) / (towerHeight * ISO_UP + 3));
  view.worldY = view.targetY + (0.45 * view.hh) / (view.zoom * ISO_UP) - towerHeight / 2;
}

// ---------- Sound and touch ----------

let audioCtx = null;
let muted = store.get('stapelgekfull-muted', '0') === '1';

function audio() {
  if (muted) return null;
  if (!audioCtx) {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; }
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function tone(freq, duration, type = 'sine', volume = 0.2, slideTo = 0, delay = 0) {
  const ctx = audio();
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + duration);
  gain.gain.setValueAtTime(volume, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + duration + 0.02);
}

const sound = {
  place() { tone(170 + game.level * 3, 0.14, 'triangle', 0.3); },
  cut() { tone(900, 0.16, 'sawtooth', 0.09, 140); tone(170 + game.level * 3, 0.14, 'triangle', 0.25); },
  perfect(combo) {
    const steps = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
    const f = 523.25 * Math.pow(2, steps[Math.min(combo - 1, steps.length - 1)] / 12);
    tone(f, 0.35, 'sine', 0.25);
    tone(f * 2, 0.25, 'sine', 0.08, 0, 0.03);
  },
  over() { tone(320, 0.7, 'sawtooth', 0.12, 60); },
  tool(id) {
    if (id === 'bomb' || id === 'dynamite') {
      tone(140, 0.7, 'sawtooth', 0.25, 30);
      tone(70, 0.9, 'sine', 0.5, 25);
      return;
    }
    [0, 4, 7, 12].forEach((s, i) => tone(660 * Math.pow(2, s / 12), 0.18, 'sine', 0.18, 0, i * 0.06));
  },
};

function buzz(ms) {
  try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* no vibration motor */ }
}

// ---------- Music ----------
// A cheerful chiptune loop, played live by the synthesizer: 8 bars of C - Am - F - G,
// melody, oom-pah bass, offbeat chords and a little drum kit. It speeds up with the game.

const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
const _ = null;
const SONG = {
  chords: [
    { root: 48, triad: [60, 64, 67] }, // C
    { root: 45, triad: [57, 60, 64] }, // Am
    { root: 41, triad: [57, 60, 65] }, // F
    { root: 43, triad: [55, 59, 62] }, // G
  ],
  // Eighth notes, two times four bars: a calm A part and a higher B part that runs back into the start.
  melody: [
    [72, _, 76, 79, 76, _, 72, 74], [76, _, 72, 69, 72, _, 76, 77],
    [77, 76, 74, _, 72, 74, 77, _], [79, _, 77, 74, 71, _, 74, _],
    [84, _, 79, 76, 79, _, 84, 83], [81, _, 76, 72, 76, 81, 79, _],
    [77, 79, 81, _, 79, 77, 76, 74], [74, 76, 77, 79, 83, _, 84, _],
  ],
};
const STEPS = SONG.melody.length * 16; // sixteenth notes per loop

let noiseBuffer = null;
function noise(ctx) {
  if (!noiseBuffer || noiseBuffer.sampleRate !== ctx.sampleRate) {
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.3, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  return noiseBuffer;
}

function voice(ctx, out, freq, t, length, type, volume, attack = 0.005) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(volume, t + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + length);
  osc.connect(gain).connect(out);
  osc.start(t);
  osc.stop(t + length + 0.02);
  return osc;
}

function drum(ctx, out, kind, t) {
  if (kind === 'kick') {
    const osc = voice(ctx, out, 150, t, 0.22, 'sine', 0.9, 0.002);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.18);
    return;
  }
  const src = ctx.createBufferSource();
  src.buffer = noise(ctx);
  const filter = ctx.createBiquadFilter();
  filter.type = kind === 'hat' ? 'highpass' : 'bandpass';
  filter.frequency.value = kind === 'hat' ? 7000 : 1800;
  const gain = ctx.createGain();
  const length = kind === 'hat' ? 0.04 : 0.14;
  gain.gain.setValueAtTime(kind === 'hat' ? 0.18 : 0.45, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + length);
  src.connect(filter).connect(gain).connect(out);
  src.start(t);
  src.stop(t + length + 0.02);
}

// Everything that sounds on one sixteenth note of the loop.
function playStep(ctx, out, step, t, sixteenth) {
  const bar = Math.floor(step / 16) % SONG.melody.length;
  const pos = step % 16;
  const chord = SONG.chords[bar % 4];
  if (pos % 2 === 0) {
    const eighth = pos / 2;
    const note = SONG.melody[bar][eighth];
    if (note) voice(ctx, out, midi(note), t, sixteenth * 1.8, 'square', 0.16);
    // Oom-pah: root, octave, fifth, octave.
    const bass = [chord.root, _, chord.root + 12, _, chord.root + 7, _, chord.root + 12, _][eighth];
    if (bass) voice(ctx, out, midi(bass), t, sixteenth * 1.6, 'triangle', 0.5);
    if (eighth % 2 === 1) for (const n of chord.triad) voice(ctx, out, midi(n), t, sixteenth * 0.9, 'square', 0.035);
    if (eighth === 0 || eighth === 4) drum(ctx, out, 'kick', t);
    if (eighth === 2 || eighth === 6) drum(ctx, out, 'snare', t);
  } else {
    drum(ctx, out, 'hat', t);
  }
}

const MUSIC_VOLUME = 0.3;
const music = {
  on: store.get('stapelgekfull-music', '1') === '1',
  playing: false,
  bpm: 108,
  step: 0,
  nextTime: 0,
  out: null,
  timer: 0,

  // Starts the loop, or only changes the tempo when it is already playing.
  start(bpm = this.bpm) {
    this.bpm = bpm;
    const ctx = audio();
    if (!ctx || !this.on || this.playing) return;
    this.playing = true;
    this.out = ctx.createGain();
    this.out.gain.setValueAtTime(0.0001, ctx.currentTime);
    this.out.gain.exponentialRampToValueAtTime(MUSIC_VOLUME, ctx.currentTime + 0.8);
    this.out.connect(ctx.destination);
    this.step = 0;
    this.nextTime = ctx.currentTime + 0.05;
    this.timer = setInterval(() => this.schedule(), 25);
    this.schedule();
  },

  stop(fade = 0.5) {
    if (!this.playing) return;
    this.playing = false;
    clearInterval(this.timer);
    const out = this.out;
    const now = audioCtx.currentTime;
    out.gain.cancelScheduledValues(now);
    out.gain.setValueAtTime(out.gain.value, now);
    out.gain.exponentialRampToValueAtTime(0.0001, now + fade);
    setTimeout(() => out.disconnect(), fade * 1000 + 200);
  },

  // Schedule a little ahead of time, so the beat stays steady.
  schedule() {
    const ctx = audioCtx;
    while (this.nextTime < ctx.currentTime + 0.12) {
      const sixteenth = 60 / this.bpm / 4;
      playStep(ctx, this.out, this.step, this.nextTime, sixteenth);
      this.nextTime += sixteenth;
      this.step = (this.step + 1) % STEPS;
    }
  },
};
const bpmFor = (speed) => Math.round(116 + (speed - START_SPEED) * 8);

// ---------- Settings ----------
// One gear button opens a small panel with sound, music and the version; the game waits while it is open.

let paused = false;
function paintSound() {
  for (const [id, on] of [['set-sound', !muted], ['set-music', music.on && !muted]]) {
    $(id).classList.toggle('on', on);
    $(id).setAttribute('aria-pressed', String(on));
  }
}
paintSound();
$('set-lang').addEventListener('click', switchLanguage);
$('set-privacy').addEventListener('click', () => { openSettings(false); showPrivacyOptions(); });

// The music rests while a video plays. When there is no video to be had, Joop says so.
let musicBeforeAd = false;
window.addEventListener('ad-start', () => { musicBeforeAd = music.playing; music.stop(0.1); });
window.addEventListener('ad-end', () => { if (musicBeforeAd) music.start(); });
window.addEventListener('ad-unavailable', () => {
  joop.say([tr('No video available right now. Try again in a little while!', 'Er is nu even geen filmpje. Probeer het straks nog eens!')]);
});
$('set-version').textContent = tr(`${NAME} version ${__VERSION__}`, `${NAME} versie ${__VERSION__}`);

function openSettings(open) {
  $('set-privacy').hidden = !privacyOptions(); // known only once Google has answered
  $('settings').hidden = !open;
  $('settings-btn').setAttribute('aria-expanded', String(open));
  paused = open && game.state === 'play';
  $('set-paused').hidden = !paused;
}
$('settings-btn').addEventListener('click', () => openSettings($('settings').hidden));
// A tap outside the panel only closes it, so it never drops a block by accident.
window.addEventListener('pointerdown', (e) => {
  if ($('settings').hidden || e.target.closest('#settings, #settings-btn')) return;
  e.stopPropagation();
  e.preventDefault();
  openSettings(false);
}, true);

$('set-sound').addEventListener('click', () => {
  muted = !muted;
  store.set('stapelgekfull-muted', muted ? '1' : '0');
  if (muted) music.stop(0.1); else music.start();
  paintSound();
});
$('set-music').addEventListener('click', () => {
  if (muted) { muted = false; store.set('stapelgekfull-muted', '0'); music.on = false; }
  music.on = !music.on;
  store.set('stapelgekfull-music', music.on ? '1' : '0');
  if (music.on) music.start(); else music.stop(0.2);
  paintSound();
});
// Browsers only allow sound after a tap, so the menu music starts on the first one.
window.addEventListener('pointerdown', () => { if (game.state !== 'over') music.start(); }, { once: true });
document.addEventListener('visibilitychange', () => {
  if (!audioCtx) return;
  if (document.hidden) audioCtx.suspend(); else if (!muted) audioCtx.resume();
});
if (location.search.includes('debug')) window.stapelgekfullMusic = { playStep, STEPS, music };

// ---------- Special blocks: diamond and gold ----------

function canvasTexture(draw) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  draw(c.getContext('2d'));
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  tex.wrapS = tex.wrapT = RepeatWrapping;
  return tex;
}

// Facets in icy blues with a few white glints.
const diamondTexture = canvasTexture((g) => {
  g.fillStyle = '#c9f6ff';
  g.fillRect(0, 0, 128, 128);
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 4; x++) {
      for (let k = 0; k < 2; k++) {
        g.fillStyle = `hsl(${188 + Math.random() * 24}, 95%, ${70 + Math.random() * 26}%)`;
        g.beginPath();
        const px = x * 32, py = y * 32;
        if (k === 0) { g.moveTo(px, py); g.lineTo(px + 32, py); g.lineTo(px, py + 32); } else { g.moveTo(px + 32, py); g.lineTo(px + 32, py + 32); g.lineTo(px, py + 32); }
        g.fill();
      }
    }
  }
  g.fillStyle = '#ffffff';
  for (const [x, y, r] of [[24, 30, 7], [92, 20, 5], [70, 84, 8], [18, 100, 4], [110, 104, 5]]) {
    g.beginPath();
    g.moveTo(x, y - r * 2); g.lineTo(x + r / 2, y - r / 2); g.lineTo(x + r * 2, y); g.lineTo(x + r / 2, y + r / 2);
    g.lineTo(x, y + r * 2); g.lineTo(x - r / 2, y + r / 2); g.lineTo(x - r * 2, y); g.lineTo(x - r / 2, y - r / 2);
    g.fill();
  }
});

// Polished gold with diagonal shine.
const goldTexture = canvasTexture((g) => {
  const grad = g.createLinearGradient(0, 0, 128, 128);
  grad.addColorStop(0, '#fff1a8');
  grad.addColorStop(0.35, '#ffc928');
  grad.addColorStop(0.7, '#f0a500');
  grad.addColorStop(1, '#ffe27a');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  g.fillStyle = 'rgba(255, 255, 255, 0.45)';
  for (const off of [-40, 30, 70]) {
    g.beginPath();
    g.moveTo(off, 128); g.lineTo(off + 18, 128); g.lineTo(off + 146, 0); g.lineTo(off + 128, 0);
    g.fill();
  }
});

function specialMaterial(kind) {
  return new MeshBasicMaterial({ map: kind === 'diamond' ? diamondTexture : goldTexture, vertexColors: true });
}

// ---------- Game state ----------

const START_SPEED = 4.2;
const SPEED_STEP = 0.12;
const MAX_SPEED = 10;
const MAGNET_PULL = 0.45; // with the magnet, misses up to this much still snap into place
const PUMP_GROW = 0.7;
const SLOW_BLOCKS = 5;
const MAGNET_BLOCKS = 3;
const LIFE_HEIGHT = 40;   // reaching this height in a game earns a life

const game = {
  state: 'menu',      // menu | play | over
  mode: 'easy',       // easy: always the same speed | hard: faster with every block
  speed: 0,
  level: 0,           // layers stacked on the first block
  top: null,          // { x, z, sx, sz } of the highest layer
  history: [],        // every layer from the first block up: { x, z, sx, sz, mesh }
  moving: null,       // the block floating in
  combo: 0,
  startedAt: 0,
  pieces: [],         // cut-off and blown-up parts tumbling down
  effects: [],        // flashes, rings and sparks
};

// Records per mode and the last 10 scores. The record from before the modes existed was a hard game.
const best = {
  easy: parseInt(store.get('stapelgekfull-best-easy', '0'), 10) || 0,
  hard: parseInt(store.get('stapelgekfull-best-hard', store.get('stapelgekfull-best', '0')), 10) || 0,
};
let scores = store.json('stapelgekfull-scores', []);
const MODE_NAME = { easy: tr('Easy', 'Makkelijk'), hard: tr('Hard', 'Moeilijk') };
const pedestal = makeBlock(0, 0, -PEDESTAL / 2, 0, BASE, PEDESTAL, BASE);

const height = () => game.level + 1;

function reset() {
  for (const layer of game.history.slice(1)) world.remove(layer.mesh);
  for (const mesh of [...game.pieces.map((p) => p.mesh), ...game.effects.map((e) => e.mesh)]) world.remove(mesh);
  if (game.moving) world.remove(game.moving.mesh);
  if (game.marker) world.remove(game.marker);
  hue0 = Math.random() * 360;
  if (LOOK !== 'neon') pedestal.material.color.copy(colorAt(0));
  paintSky(0);
  const top = { x: 0, z: 0, sx: BASE, sz: BASE };
  Object.assign(game, {
    level: 0, top, history: [{ ...top, mesh: pedestal }], moving: null, combo: 0, warnedNarrow: false,
    pieces: [], effects: [],
    bar: {}, loot: {}, slowLeft: 0, magnetLeft: 0, awarded: new Set(), golden: false,
    stats: { height: 1, maxCombo: 0, perfects: 0, mode: game.mode },
    recorded: false, continued: false, doubled: false, lifeForHeight: false, lifeForRecord: false,
    challenge: null, marker: null,
  });
  view.worldY = 0;
  view.zoom = 1;
  document.body.classList.remove('poster-1', 'poster-2');
  $('over').classList.remove('folded');
  setScore();
}

function spawn(speed, kind = 'normal') {
  const axis = Math.random() < 0.5 ? 'x' : 'z';
  const side = Math.random() < 0.5 ? -1 : 1;
  const { x, z, sx, sz } = game.top;
  const mesh = makeBlock(game.level + 1, x, 0, z, sx, H, sz);
  if (kind === 'golden') mesh.material = specialMaterial('golden');
  // A new block ignores taps until it first reaches the tower, so a tap meant for the block before never wastes it.
  game.moving = { mesh, kind, axis, offset: kind === 'golden' ? 0 : side * TRAVEL, dir: -side, speed, age: 0, sx, sz, entering: kind !== 'golden' };
  placeMoving();
  paintStop();
}

// While a golden block falls by itself, the STOP button turns gold: no need to tap.
function paintStop() {
  const golden = !!game.moving && game.moving.kind === 'golden';
  const button = $('stop');
  button.classList.toggle('golden', golden);
  button.textContent = golden ? tr('GOLD!', 'GOUD!') : 'STOP!';
}

function placeMoving() {
  const m = game.moving;
  // A golden block drops straight down; the others float in from the side.
  const lift = m.kind === 'golden' ? 9 * Math.pow(1 - Math.min(m.age / 0.5, 1), 2) : 1.6 * Math.pow(1 - Math.min(m.age / 0.4, 1), 3);
  m.mesh.position.y = (game.level + 1) * H - H / 2 + lift;
  if (m.axis === 'x') { m.mesh.position.x = game.top.x + m.offset; m.mesh.position.z = game.top.z; } else { m.mesh.position.z = game.top.z + m.offset; m.mesh.position.x = game.top.x; }
}

// The tower stands in the village: while the ground is in view it moves exactly with the tower's foot,
// with a strip of grass and tulips in front of it. Once the village is gone, the journey up takes over.
const foot = new Vector3();
let skyRef = null;
function paintSkyLayers() {
  foot.set(0, -PEDESTAL, 0);
  world.localToWorld(foot);
  foot.project(camera);
  const footY = ((1 - foot.y) / 2) * window.innerHeight;
  const viewH = window.innerHeight;
  const byGround = footY - 0.95 * viewH;
  const h = height();
  const screens = h <= 100 ? Math.min(1, Math.max(0, (h - 8) / 92)) * 3 : 3 + Math.min(1, (h - 100) / 100) * 4;
  const byHeight = screens * viewH;
  $('journey').style.transform = `translateY(${Math.max(byGround, byHeight)}px)`;
  // Front to back: tulips, the river, the village. Farther layers sink a little slower, which gives depth.
  if (skyRef === null || height() === 1) skyRef = footY;
  const sink = footY - skyRef;
  // The tulips reach above the back of the tower's foot, so it stands in the field and not in the water.
  $('front').style.transform = `translateY(${footY - 66}px)`;
  $('river').style.transform = `translateY(${footY - 140 - sink * 0.15}px)`;
  $('village').style.transform = `translateY(${footY - 246 - sink * 0.3}px)`;
  $('sun').style.opacity = Math.max(0, 1 - (height() - 30) / 20); // gone by the time you reach space
}

// Sky journey: the scenery scrolls from the village at the bottom up to the moon at 100.
// The journey comes in chapters of 100; the meter starts over in every chapter.
const CHAPTERS = [
  { title: tr('1 · To the moon', '1 · Naar de maan'), icons: ['🌙', '🚀', '✈️', '☁️', '🏡'] },
  { title: tr('2 · Solar system', '2 · Zonnestelsel'), icons: ['☀️', '🪐', '☄️', '🔴', '🌙'] },
];
let shownChapter = 0;
function paintJourney(h) {
  const chapter = h > 100 ? 1 : 0;
  if (chapter !== shownChapter) {
    shownChapter = chapter;
    $('meter-title').textContent = CHAPTERS[chapter].title;
    $('meter').querySelectorAll('span').forEach((el, i) => { el.textContent = CHAPTERS[chapter].icons[i]; });
  }
  const p = chapter ? Math.min(1, (h - 100) / 100) : Math.min(1, Math.max(0, (h - 1) / 99));
  $('moon-flag').setAttribute('opacity', h >= 100 ? '1' : '0');
  if ((h === 100 || h === 200) && game.state === 'play') showChapter(h);
  $('meter-pin').style.bottom = `${p * 100}%`;
  $('meter-pin').textContent = h;
}

function showChapter(h) {
  const el = $('chapter');
  el.querySelector('.ch-big').textContent = h === 100 ? tr('🌙 ON THE MOON!', '🌙 OP DE MAAN!') : tr('☀️ AT THE SUN!', '☀️ BIJ DE ZON!');
  el.querySelector('.ch-small').textContent = h === 100 ? tr('Chapter 2 · The solar system', 'Hoofdstuk 2 · Het zonnestelsel') : tr('Chapter 3 · The Milky Way', 'Hoofdstuk 3 · De Melkweg');
  el.classList.add('show');
  $('callout').style.visibility = 'hidden'; // the chapter banner gets the stage to itself
  clearTimeout(showChapter.timer);
  showChapter.timer = setTimeout(() => { el.classList.remove('show'); $('callout').style.visibility = ''; }, 2600);
}

function setScore(bump) {
  if (LOOK === 'sky') paintJourney(height());
  const el = $('score');
  el.textContent = height();
  if (bump) {
    el.classList.remove('bump');
    void el.offsetWidth;
    el.classList.add('bump');
  }
}

function callout(text, kind = '') {
  const el = $('callout');
  el.textContent = text;
  el.className = kind;
  void el.offsetWidth;
  el.className = `go ${kind}`;
}

// ---------- Placing a block ----------

function drop() {
  if (paused || game.state !== 'play' || !game.moving || game.moving.kind === 'golden' || game.moving.entering) return;
  if (performance.now() - game.startedAt < 150) return;
  const m = game.moving;
  const top = game.top;
  const onX = m.axis === 'x';
  const centre = onX ? top.x : top.z;
  const size = onX ? top.sx : top.sz;
  const ownSize = onX ? m.sx : m.sz;
  const delta = m.offset;
  const y = (game.level + 1) * H - H / 2;
  game.moving = null;
  m.mesh.position.y = y;

  if (Math.abs(delta) >= (size + ownSize) / 2) {
    // Missed completely: the whole block falls, unless a lifebuoy saves the game.
    addPiece(m.mesh, m.axis, Math.sign(delta) || 1);
    if (useFromBar('buoy')) {
      callout(tr('SAVED!', 'GERED!'));
      sound.tool();
      joop.chat(tr('Saved by the life buoy! One more chance.', 'Gered door de reddingsboei! Nog een kans.'), { cheer: true, force: true });
      spawn(game.speed);
      return;
    }
    gameOver();
    return;
  }

  if (m.kind === 'diamond') {
    // A diamond is never cut: it lands centred on the tower at its own size.
    game.combo += 1;
    sound.perfect(game.combo);
    callout(tr('DIAMOND!', 'DIAMANT!'));
    buzz(30);
    settle(m, { x: top.x, z: top.z, sx: m.sx, sz: m.sz }, true);
    return;
  }

  let newCentre = centre;
  let newSize = size;
  const pull = game.magnetLeft > 0 ? MAGNET_PULL : PERFECT;
  if (Math.abs(delta) <= pull) {
    game.combo += 1;
    if (game.combo >= 3) newSize = Math.min(BASE, size + GROW);
    sound.perfect(game.combo);
    callout(game.combo > 1 ? `PERFECT ×${game.combo}` : 'PERFECT!');
    buzz(25);
    if (game.combo === 3) joop.chat(pick(LINES.streak), { cheer: true });
    else joop.chat(pick(LINES.perfect), { chance: 0.3 });
  } else {
    game.combo = 0;
    const side = Math.sign(delta);
    const overlap = size - Math.abs(delta);
    newCentre = centre + delta / 2;
    newSize = overlap;
    // The part that sticks out becomes its own block, flashes red and falls.
    const cutSize = Math.abs(delta);
    const cutCentre = newCentre + side * (overlap / 2 + cutSize / 2);
    const cut = onX
      ? makeBlock(game.level + 1, cutCentre, y, top.z, cutSize, H, top.sz)
      : makeBlock(game.level + 1, top.x, y, cutCentre, top.sx, H, cutSize);
    addPiece(cut, m.axis, side);
    addSlice(m.axis, newCentre + side * overlap / 2, y, onX ? top.z : top.x, onX ? top.sz : top.sx);
    sound.cut();
    buzz(40);
    if (overlap < 0.8 && !game.warnedNarrow) {
      game.warnedNarrow = true;
      joop.chat(pick(LINES.narrow));
    } else if (cutSize > size * 0.4) {
      joop.chat(pick(LINES.bigCut), { chance: 0.6 });
    }
  }

  const placed = onX
    ? { x: newCentre, z: top.z, sx: newSize, sz: top.sz }
    : { x: top.x, z: newCentre, sx: top.sx, sz: newSize };
  settle(m, placed, game.combo > 0);
}

// The golden block lands by itself: perfect, never cut.
function landGolden() {
  const m = game.moving;
  game.moving = null;
  game.combo += 1;
  sound.perfect(game.combo);
  callout(tr('GOLD!', 'GOUD!'));
  buzz(30);
  settle(m, { ...game.top }, true);
}

function settle(m, placed, perfect) {
  const y = (game.level + 1) * H - H / 2;
  m.mesh.position.set(placed.x, y, placed.z);
  m.mesh.scale.set(placed.sx, H, placed.sz);
  if (perfect) addRing(placed, y + H / 2);
  else sound.place();
  if (game.magnetLeft > 0) game.magnetLeft -= 1;
  if (game.slowLeft > 0) game.slowLeft -= 1;

  game.level += 1;
  game.top = { x: placed.x, z: placed.z, sx: placed.sx, sz: placed.sz };
  game.history[game.level] = { ...game.top, mesh: m.mesh };
  game.stats.height = Math.max(game.stats.height, height());
  game.stats.maxCombo = Math.max(game.stats.maxCombo, game.combo);
  if (perfect) game.stats.perfects += 1;
  goals.count('blocks');
  if (game.challenge && !game.challenge.won && height() > game.challenge.target) beatJoop();
  view.worldY = -game.level * H;
  setScore(true);
  paintSky(game.level);
  // Hard gets faster with every block; easy keeps the same speed all game.
  if (game.mode === 'hard') game.speed = Math.min(MAX_SPEED, game.speed + SPEED_STEP);
  music.bpm = bpmFor(game.speed);

  const golden = rewardsFor(height());
  spawn(game.speed, golden ? 'golden' : 'normal');
  checkGoals();
  paintEffects();
}

// ---------- Opa Joop's challenge ----------

// A pink band around the tower at Joop's height, with his name and score beside it.
function addJoopMarker(target) {
  const marker = new Group();
  const band = new Mesh(squareRing, new MeshBasicMaterial({ color: 0xff3d8b, transparent: true, opacity: 0.9, depthWrite: false }));
  band.scale.set(BASE * 1.35, 1, BASE * 1.35);
  marker.add(band);
  const label = new Sprite(new SpriteMaterial({ map: labelTexture(`Joop: ${target}`), depthTest: false }));
  label.scale.set(2.6, 0.9, 1);
  label.position.set(-2.9, 0.4, 2.9); // to the left of the tower on screen
  marker.add(label);
  marker.position.y = (target - 1) * H + 0.02; // on top of Joop's last block
  world.add(marker);
  game.marker = marker;
  game.markerBand = band;
}

function labelTexture(text) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 88;
  const g = c.getContext('2d');
  // A pill; older WebViews have no roundRect, so it is drawn with arcs.
  const pill = (x, y, w, h) => {
    const r = h / 2;
    g.beginPath();
    g.arc(x + r, y + r, r, Math.PI / 2, Math.PI * 1.5);
    g.arc(x + w - r, y + r, r, Math.PI * 1.5, Math.PI / 2);
    g.closePath();
    g.fill();
  };
  g.fillStyle = '#1b1440';
  pill(4, 10, 248, 74);
  g.fillStyle = '#ff3d8b';
  pill(4, 4, 248, 72);
  g.fillStyle = '#ffffff';
  g.font = '900 40px Nunito, "Arial Rounded MT Bold", Arial, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 128, 42);
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

function beatJoop() {
  game.challenge.won = true;
  const today = challenge.win();
  for (const id of today.reward) grant(id, 1);
  if (game.markerBand) game.markerBand.material.color.setHex(0x2ee59d);
  callout(tr('YOU BEAT JOOP!', 'JOOP VERSLAGEN!'));
  sound.perfect(8);
  buzz([40, 30, 80]);
  joop.chat(tr('You beat me! Here is your reward: ', 'Je hebt me verslagen! Hier is je beloning: ') + today.reward.map((id) => ITEMS[id].icon).join(' '), { cheer: true, force: true });
  paintChallengeHud();
}

function paintChallengeHud() {
  const el = $('challenge-hud');
  if (!game.challenge) { el.textContent = ''; return; }
  el.textContent = game.challenge.won ? tr('✅ You beat Joop!', '✅ Joop verslagen!') : tr(`🏁 Beat Joop: ${game.challenge.target}`, `🏁 Versla Joop: ${game.challenge.target}`);
}

function challengeLine(c) {
  const reward = c.reward.map((id) => ITEMS[id].icon).join(' ');
  return tr(`Today I got ${c.target} in ${MODE_NAME[c.mode]}. Can you go higher? Then you get ${reward}`, `Ik haalde vandaag ${c.target} in ${MODE_NAME[c.mode]}. Kun jij hoger? Dan krijg je ${reward}`);
}

function paintChallenge() {
  const c = challenge.today(scores);
  const button = $('challenge-btn');
  button.classList.toggle('won', c.won);
  const streak = challenge.streak;
  const flame = streak > 1 ? tr(` · 🔥 ${streak} days in a row`, ` · 🔥 ${streak} dagen op rij`) : '';
  $('challenge-sub').textContent = c.won
    ? tr(`Beaten! A new challenge tomorrow${flame}`, `Verslagen! Morgen een nieuwe uitdaging${flame}`)
    : tr(`Joop got ${c.target} in ${MODE_NAME[c.mode]} · reward `, `Joop haalde ${c.target} in ${MODE_NAME[c.mode]} · beloning `) + c.reward.map((id) => ITEMS[id].icon).join(' ') + flame;
}

// Milestones, each once per game: a diamond at 50, 100, 150 ..., a golden block at 75, 125, 175 ...
function rewardsFor(h) {
  if (game.awarded.has(h)) return false;
  game.awarded.add(h);
  let golden = false;
  let said = false;
  if (h >= 50 && h % 50 === 0) {
    grant('diamond', 1);
    joop.chat(h === 50 ? tr('50 high! Here, a diamond block. Tap 💎 when you need it.', '50 hoog! Hier, een diamanten blok. Tik op 💎 als je hem nodig hebt.') : tr(`${h} high! Another diamond for you!`, `${h} hoog! Nog een diamant voor jou!`), { cheer: true, force: true });
    said = true;
  } else if (h >= 75 && (h - 75) % 50 === 0) {
    golden = true;
    joop.chat(tr('A golden block! It lands perfectly all by itself.', 'Een gouden blok! Die valt vanzelf perfect op zijn plek.'), { cheer: true, force: true });
    said = true;
  }
  if (h === LIFE_HEIGHT && !game.lifeForHeight) {
    game.lifeForHeight = true;
    lives.add(1);
    callout(tr('+1 LIFE ❤️', '+1 LEVEN ❤️'));
    if (!said) joop.chat(tr(`${LIFE_HEIGHT} high! That earns you an extra life.`, `${LIFE_HEIGHT} hoog! Daar krijg je een extra leven voor.`), { cheer: true, force: true });
    said = true;
  }
  if (!said && (h % 10 === 0 || h === 25)) joop.chat(LINES.milestone[h] || tr(`${h} high! Keep going!`, `${h} hoog! Ga zo door!`), { cheer: true, force: true });
  return golden;
}

function addPiece(mesh, axis, side, blast = false) {
  const flash = new LineSegments(unitEdges, new LineBasicMaterial({ color: 0xffffff, transparent: true }));
  mesh.add(flash);
  mesh.material.transparent = true;
  const piece = { mesh, flash, axis, side, age: 0, vy: 0, base: mesh.material.color.clone() };
  if (blast) {
    // Blown up: flies off in a random direction, spinning.
    const a = Math.random() * Math.PI * 2;
    const speed = 4 + Math.random() * 6;
    piece.v = [Math.cos(a) * speed, 6 + Math.random() * 8, Math.sin(a) * speed];
    piece.spin = [(Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10];
    piece.age = 0.18;
  }
  game.pieces.push(piece);
}

function addSlice(axis, at, y, other, otherSize) {
  const mesh = new Mesh(unitPlane, new MeshBasicMaterial({
    color: 0xffffff, transparent: true, side: DoubleSide, blending: AdditiveBlending, depthWrite: false,
  }));
  if (axis === 'x') { mesh.position.set(at, y, other); mesh.rotation.y = Math.PI / 2; } else { mesh.position.set(other, y, at); }
  mesh.scale.set(otherSize + 0.6, H + 0.6, 1);
  world.add(mesh);
  game.effects.push({ mesh, age: 0, life: 0.35, kind: 'slice', sx: otherSize + 0.6 });
  const hex = colorAt(game.level + 1).getHex();
  if (LOOK === 'pixel') sparks(axis === 'x' ? at : other, y, axis === 'x' ? other : at, axis, otherSize, [hex, 0xffffff, hex, 0x1b1440], 26, 2.2);
  else if (LOOK === 'neon') sparks(axis === 'x' ? at : other, y, axis === 'x' ? other : at, axis, otherSize, [0xffffff, 0x3ef0ff, 0xff3df0], 22);
  else sparks(axis === 'x' ? at : other, y, axis === 'x' ? other : at, axis, otherSize, [0xffffff, 0xff3d6e], 12);
}

function sparks(x, y, z, axis, spread, colors, count, size = 1) {
  for (let i = 0; i < count; i++) {
    const spark = new Mesh(unitBox, new MeshBasicMaterial({ color: colors[i % colors.length], transparent: true }));
    const along = (Math.random() - 0.5) * spread;
    spark.position.set(x + (axis === 'z' ? along : 0), y + (Math.random() - 0.5) * H, z + (axis === 'x' ? along : 0));
    spark.scale.setScalar((0.08 + Math.random() * 0.08) * size);
    world.add(spark);
    game.effects.push({
      mesh: spark, age: 0, life: 0.5 + Math.random() * 0.3, kind: 'spark',
      v: [(Math.random() - 0.5) * 6, 2 + Math.random() * 5, (Math.random() - 0.5) * 6],
    });
  }
}

function addRing(placed, y, color = 0xffffff) {
  const mesh = new Mesh(squareRing, new MeshBasicMaterial({ color, transparent: true, depthWrite: false }));
  mesh.position.set(placed.x, y + 0.01, placed.z);
  mesh.scale.set(placed.sx, 1, placed.sz);
  world.add(mesh);
  game.effects.push({ mesh, age: 0, life: 0.6, kind: 'ring', sx: placed.sx, sz: placed.sz });
}

// ---------- Tools ----------

// Items the player can use this game: the ones packed before the start plus the ones won while playing.
function grant(id, n, why) {
  addItem(id, n);
  game.bar[id] = (game.bar[id] || 0) + n;
  game.loot[id] = (game.loot[id] || 0) + n;
  if (why) callout(`${ITEMS[id].icon} ${why}`);
  paintTools();
}

function useFromBar(id) {
  if (!(game.bar[id] > 0) || !takeItem(id)) return false;
  game.bar[id] -= 1;
  goals.count('tools');
  paintTools();
  return true;
}

function useTool(id) {
  if (game.state !== 'play' || !game.moving || game.moving.kind === 'golden' || !(game.bar[id] > 0)) return;
  const m = game.moving;
  if (id === 'diamond') {
    if (m.kind === 'diamond') return;
    // As big as the tower was before its last cut.
    const area = (l) => l.sx * l.sz;
    let size = null;
    for (let i = game.level - 1; i >= 0; i--) {
      if (area(game.history[i]) > area(game.top) + 0.01) { size = game.history[i]; break; }
    }
    m.sx = size ? size.sx : Math.min(BASE, game.top.sx + 0.5);
    m.sz = size ? size.sz : Math.min(BASE, game.top.sz + 0.5);
    m.kind = 'diamond';
    m.mesh.material = specialMaterial('diamond');
    m.grow = 0;
    sparks(m.mesh.position.x, m.mesh.position.y, m.mesh.position.z, 'x', 1.5, [0xffffff, 0x7fe7ff], 14);
    joop.chat(tr("A diamond! I'm not cutting that one.", 'Een diamant! Die snijd ik echt niet door.'), { force: true });
  } else if (id === 'pump') {
    if (game.level === 0 || (game.top.sx >= BASE && game.top.sz >= BASE)) { joop.chat(tr('Your tower is already as wide as it gets!', 'Je toren is al op zijn breedst!'), { force: true }); return; }
    const layer = game.history[game.level];
    layer.sx = game.top.sx = Math.min(BASE, game.top.sx + PUMP_GROW);
    layer.sz = game.top.sz = Math.min(BASE, game.top.sz + PUMP_GROW);
    layer.mesh.scale.set(layer.sx, H, layer.sz);
    if (m.kind === 'normal') { m.sx = layer.sx; m.sz = layer.sz; m.mesh.scale.set(m.sx, H, m.sz); }
    addRing(game.top, game.level * H, 0xffe14d);
    joop.chat(tr('Pffff... pumped up! Nice and wide again.', 'Pffff... opgeblazen! Weer lekker breed.'), { force: true });
  } else if (id === 'slow') {
    game.slowLeft += SLOW_BLOCKS;
    joop.chat(tr("Snail's pace! Nice and easy now.", 'Slakkengang! Rustig aan nu.'), { force: true });
  } else if (id === 'magnet') {
    game.magnetLeft += MAGNET_BLOCKS;
    joop.chat(tr('Magnet on! Close is good enough.', 'Magneet aan! Dichtbij is goed genoeg.'), { force: true });
  } else if (id === 'bomb' || id === 'dynamite') {
    if (game.level === 0) { joop.chat(tr("There's nothing to blow up yet!", 'Er valt nog niks op te blazen!'), { force: true }); return; }
    blast(id === 'bomb' ? 5 : 10);
  } else {
    return;
  }
  useFromBar(id);
  sound.tool(id);
  checkGoals();
  paintEffects();
}

// Blow up the top layers: the tower gets lower, but the block that is left on top is wider again.
function blast(layers) {
  const n = Math.min(layers, game.level);
  const m = game.moving;
  game.moving = null;
  addPiece(m.mesh, m.axis, 1, true);
  for (let i = game.level; i > game.level - n; i--) addPiece(game.history[i].mesh, 'x', 1, true);
  game.level -= n;
  game.history.length = game.level + 1;
  const { x, z, sx, sz } = game.history[game.level];
  game.top = { x, z, sx, sz };
  game.combo = 0;
  view.worldY = -game.level * H;
  setScore(true);
  paintSky(game.level);
  callout(n >= 10 ? tr('KABOOM!', 'KABOEM!') : tr('BOOM!', 'BOEM!'), 'cut');
  buzz([80, 30, 160]);
  joop.chat(n >= 10 ? tr('KABOOM! Ten layers up in the air!', 'KABOEM! Tien lagen de lucht in!') : tr('Boom! Plenty of room again.', 'Boem! Weer lekker veel ruimte.'), { force: true });
  spawn(game.speed);
}

function paintTools() {
  const bar = $('tools');
  bar.innerHTML = '';
  for (const id of ITEM_IDS) {
    const n = game.bar[id] || 0;
    if (!n) continue;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `tool${id === 'buoy' ? ' passive' : ''}`;
    b.setAttribute('aria-label', `${ITEMS[id].name} (${n})`);
    b.innerHTML = `<span class="icon">${ITEMS[id].icon}</span><span class="n">${n}</span>`;
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (id === 'buoy') joop.chat(tr('The life buoy works by itself when you miss completely.', 'De reddingsboei werkt vanzelf als je helemaal mist.'), { force: true });
      else useTool(id);
    });
    bar.append(b);
  }
}

function paintEffects() {
  const parts = [];
  if (game.slowLeft > 0) parts.push(`🐌 ${game.slowLeft}`);
  if (game.magnetLeft > 0) parts.push(`🧲 ${game.magnetLeft}`);
  $('effects').textContent = parts.join('   ');
}

// ---------- Goals ----------

function checkGoals() {
  const done = goals.collect(game.state === 'play' ? game.stats : null);
  for (const g of done) {
    const item = ITEMS[g.reward];
    if (game.state === 'play') grant(g.reward, g.amount, tr('GOAL REACHED!', 'DOEL GEHAALD!'));
    else addItem(g.reward, g.amount);
    const what = `${g.amount > 1 ? `${g.amount}× ` : tr('a ', 'een ')}${item.name.toLowerCase()} ${item.icon}`;
    joop.chat(tr(`Goal reached! You get ${what}`, `Doel gehaald! Je krijgt ${what}`), { cheer: true, force: true });
  }
  paintGoals();
}

function paintGoals() {
  const stats = game.state === 'play' || game.state === 'over' ? game.stats : null;
  for (const el of [$('goals-hud'), $('menu-goals')]) {
    el.innerHTML = '';
    for (const g of goals.list) {
      const li = document.createElement('li');
      const have = goals.progress(g, stats);
      const reward = ITEMS[g.reward].icon + (g.amount > 1 ? `×${g.amount}` : '');
      li.innerHTML = `<span class="g-text"></span><span class="g-have">${have}/${g.n}</span><span class="g-reward">${reward}</span>`;
      li.querySelector('.g-text').textContent = goals.text(g);
      li.style.setProperty('--done', `${(have / g.n) * 100}%`);
      el.append(li);
    }
  }
}

// ---------- Joop ----------

const pick = (list) => list[Math.floor(Math.random() * list.length)];

const LINES = {
  intro: [
    tr("Hi! I'm Joop, the stacking champion of the family.", 'Hoi! Ik ben Joop, stapelkampioen van de familie.'),
    tr('Here comes a block floating in. Press STOP when it hangs right above your tower.', 'Zo komt er een blok aangezweefd. Druk op STOP als hij precies boven je toren hangt.'),
    tr("Does a bit stick out? Snip snap, I'll just cut it off!", 'Steekt er een stukje uit? Snip snap, dat snij ik er gewoon af!'),
    tr('Spot on is PERFECT. Three in a row? Then your block grows a little again.', 'Precies goed is PERFECT. Drie keer op rij? Dan groeit je blok weer een beetje.'),
    tr('Reach your goals and earn tools: a bomb, a pump, a snail and lots more. Your goals are under the 🎯 at the top right.', 'Haal je doelen en verdien gereedschap: een bom, een pomp, een slakje en nog veel meer. Je doelen staan onder de 🎯 rechtsboven.'),
    tr('You have 5 lives a day. A new record or 40 high earns you an extra life.', 'Je hebt 5 levens per dag. Een nieuw record of 40 hoog levert een extra leven op.'),
    tr('Pick Easy or Hard. In Hard it keeps getting faster. Good luck!', 'Kies Makkelijk of Moeilijk. Bij Moeilijk gaat het steeds sneller. Succes!'),
  ],
  news: [
    tr('New! Under the 🎯 at the top right are three goals. Reach them and you get tools.', 'Nieuw! Onder de 🎯 rechtsboven staan drie doelen. Haal ze en je krijgt gereedschap.'),
    tr('At 50 high you get a diamond, and at 75 a golden block drops in.', 'Bij 50 hoog krijg je een diamant, en bij 75 valt er een gouden blok.'),
    tr('Heads up: you have 5 lives a day. Tomorrow you get 5 again.', 'Let op: je hebt 5 levens per dag. Morgen krijg je er weer 5.'),
  ],
  hello: [
    tr('Fancy a round of stacking?', 'Zin in een potje stapelen?'),
    tr('How high will you go today?', 'Hoe hoog kom jij vandaag?'),
    tr("I've already straightened my tie. Bring it on!", 'Ik heb mijn stropdas al rechtgetrokken. Kom maar op!'),
    tr('Tap me if you want to hear how it works again.', 'Tik op mij als je de uitleg nog een keer wilt horen.'),
    tr('Fifty years married, but stacking is still exciting!', 'Vijftig jaar getrouwd, maar stapelen blijft spannend!'),
    tr('Tap the 🎯 at the top right. Your goals are there, and they earn you tools!', 'Tik eens op de 🎯 rechtsboven. Daar staan je doelen, en die leveren gereedschap op!'),
  ],
  start: {
    easy: [tr('Take it easy, we have all the time in the world!', 'Rustig aan, we hebben alle tijd!'), tr('Easy is a fine achievement too!', 'Makkelijk is ook heel knap hoor!'), tr('Nice and steady, at your own pace.', 'Lekker in je eigen tempo.')],
    hard: [tr('Hard? Hats off! It keeps getting faster.', 'Moeilijk? Petje af! Het gaat steeds sneller.'), tr('Hold on tight, this is going to be fast!', 'Hou je vast, dit wordt snel!'), tr('Real tough cookies pick Hard!', 'Echte bikkels kiezen Moeilijk!')],
  },
  perfect: [tr('Beautiful!', 'Prachtig!'), tr('Very neat!', 'Keurig netjes!'), tr('As straight as my tie!', 'Zo recht als mijn stropdas!'), tr("I couldn't have done it better myself!", 'Dat had ik zelf niet beter gekund!'), tr('Spot on!', 'Precies goed!'), tr('Craftsmanship!', 'Vakwerk!')],
  streak: [tr('Three in a row! Your block grows again!', 'Drie op rij! Je blok groeit weer!'), tr("You're on a roll!", 'Je bent op dreef!'), tr('What a stacker you are!', 'Wat een stapelaar ben jij!')],
  bigCut: [tr('Oops, that was a big piece!', 'Oei, dat was een flink stuk!'), tr('Snip snap! Better luck with the next one.', 'Snip snap! De volgende beter.'), tr("Don't worry, just keep stacking!", 'Niet getreurd, gewoon doorstapelen!'), tr('Ouch, there goes a piece!', 'Au, daar gaat een stuk!')],
  narrow: [tr("It's getting narrow, huh? Concentrate!", 'Hij wordt wel smal, hè? Concentratie!'), tr("Careful now, it's only a narrow little block!", 'Voorzichtig nu, het is nog maar een smal blokje!')],
  milestone: {
    10: tr('Ten high! Nice start!', 'Tien hoog! Mooi begin!'),
    25: tr('25 high! A silver tower!', '25 hoog! Een zilveren toren!'),
    100: tr("100! I'm speechless. Almost.", '100! Ik ben sprakeloos. Bijna.'),
  },
};

function overLine(score, isBest) {
  if (isBest && score > 2) return { text: tr(`Congratulations! A new record: ${score} blocks!`, `Gefeliciteerd! Een nieuw record: ${score} blokken!`), cheer: true };
  if (score < 5) return { text: pick([tr('Oh well, everyone starts small. Once more!', 'Ach, iedereen begint klein. Nog een keer!'), tr('Practice makes perfect. Try again!', 'Oefening baart kunst. Probeer het nog eens!')]) };
  if (score < 15) return { text: pick([tr('Well done! Even higher next time?', 'Goed bezig! Volgende keer nog hoger?'), tr('Neat! I see talent.', 'Netjes! Ik zie talent.')]) };
  if (score < 30) return { text: pick([tr("Great job! I'm proud of you.", 'Knap gedaan! Ik ben trots op je.'), tr('What a tower! Congratulations!', 'Wat een toren! Gefeliciteerd!')]), cheer: true };
  return { text: pick([tr('Incredible! Congratulations, champ!', 'Ongelooflijk! Gefeliciteerd, kampioen!'), tr('I could learn a thing or two from that. Bravo!', 'Daar kan ik nog wat van leren. Bravo!')]), cheer: true };
}

const joop = {
  el: $('joop'),
  balloon: $('balloon'),
  queue: [],
  timer: 0,
  quietUntil: 0,

  // Show Joop next to the open card or above the STOP button while playing.
  place() {
    const playing = game.state === 'play' && !document.querySelector('.screen.show');
    const anchor = playing ? $('stop') : document.querySelector('.screen.show .card');
    const small = window.innerHeight < 720;
    const size = playing ? 86 : game.state === 'over' ? 104 : small ? 100 : 124;
    this.el.style.setProperty('--joop-size', `${size}px`);
    if (anchor) {
      const top = anchor.getBoundingClientRect().top;
      this.el.style.bottom = `${window.innerHeight - top + (game.state === 'over' ? -10 : 8)}px`;
    }
    this.el.classList.toggle('no-tap', playing);
  },

  show(visible) {
    this.el.classList.toggle('hidden', !visible);
    if (!visible) this.hush();
  },

  // Say a list of lines one after another; tapping the balloon skips to the next.
  say(lines, { cheer = false, hold = 0 } = {}) {
    this.queue = [...lines];
    this.cheer = cheer;
    this.hold = hold;
    this.next();
  },

  next() {
    clearTimeout(this.timer);
    const text = this.queue.shift();
    if (!text) { this.hush(); return; }
    this.el.classList.toggle('cheer', this.cheer);
    this.balloon.innerHTML = '';
    this.balloon.append(text);
    if (this.queue.length) {
      const more = document.createElement('span');
      more.className = 'more';
      more.textContent = tr('tap for more ›', 'tik voor meer ›');
      this.balloon.append(more);
    }
    this.balloon.classList.remove('show');
    void this.balloon.offsetWidth;
    this.balloon.classList.add('show');
    this.el.classList.add('talking');
    const talkFor = Math.min(2200, 300 + text.length * 45);
    setTimeout(() => this.el.classList.remove('talking'), talkFor);
    const readFor = this.hold || 1800 + text.length * 55;
    this.timer = setTimeout(() => this.next(), this.queue.length ? readFor + 1200 : readFor);
  },

  hush() {
    clearTimeout(this.timer);
    this.queue = [];
    this.balloon.classList.remove('show');
    this.el.classList.remove('talking', 'cheer');
    if (game.state === 'play') this.el.classList.add('hidden');
  },

  // During play Joop pops in now and then, never twice within a few seconds.
  chat(text, { cheer = false, chance = 1, force = false } = {}) {
    const now = performance.now();
    if (!force && (now < this.quietUntil || Math.random() > chance)) return;
    this.quietUntil = now + 4500;
    this.el.classList.remove('hidden');
    this.say([text], { cheer, hold: 2200 });
  },
};

$('joop-figure').addEventListener('click', () => {
  if (game.state === 'menu') joop.say(LINES.intro);
});
joop.balloon.addEventListener('click', () => joop.next());
window.addEventListener('resize', () => joop.place());

// ---------- Screens ----------

function showScreen(id) {
  document.body.classList.toggle('playing', id === null);
  for (const s of document.querySelectorAll('.screen')) s.classList.toggle('show', s.id === id);
  $('hud').classList.toggle('show', id === null);
  $('stop').classList.toggle('show', id === null);
  $('tools').classList.toggle('show', id === null);
  joop.place();
  setTimeout(() => joop.place(), 400); // again once the card has popped in
  joop.show(id === 'menu' || id === 'over' || id === 'loadout' || id === 'nolives');
}

function bestLine() {
  if (!best.easy && !best.hard) return tr('How high can you go?', 'Hoe hoog kom jij?');
  return `Record: ${MODE_NAME.easy} ${best.easy} · ${MODE_NAME.hard} ${best.hard}`;
}

function paintLives() {
  const n = lives.count;
  const hearts = n <= MAX_LIVES ? '❤️'.repeat(n) + '🤍'.repeat(MAX_LIVES - n) : `❤️ × ${n}`;
  for (const el of document.querySelectorAll('.lives-hearts')) el.textContent = hearts;
  for (const el of document.querySelectorAll('.life-video')) el.hidden = n >= MAX_LIVES || lives.videosLeft <= 0;
}

function menu() {
  reset();
  game.state = 'menu';
  $('menu-best').textContent = bestLine();
  $('menu-kit-n').textContent = itemCount() || '';
  $('menu-goals-n').textContent = goals.list.length;
  paintLives();
  paintGoals();
  paintChallenge();
  spawn(1.6);
  showScreen('menu');
  music.start(108);
  if (store.get('stapelgekfull-intro', '0') !== '1') {
    store.set('stapelgekfull-intro', '1');
    store.set('stapelgekfull-news-2', '1');
    joop.say(LINES.intro);
  } else if (store.get('stapelgekfull-news-2', '0') !== '1') {
    store.set('stapelgekfull-news-2', '1');
    joop.say(LINES.news);
  } else {
    const c = challenge.today(scores);
    joop.say([!c.won && Math.random() < 0.6 ? challengeLine(c) : pick(LINES.hello)]);
  }
}

// Choose a mode: check the lives, then pack tools if there are any.
let chosen = {};
let asChallenge = false;
function prepare(mode, joopChallenge = false) {
  asChallenge = joopChallenge;
  game.mode = mode;
  store.set('stapelgekfull-mode', mode);
  if (lives.count <= 0) { showNoLives(); return; }
  if (!itemCount()) { begin({}); return; }
  chosen = {};
  paintLoadout();
  showScreen('loadout');
  joop.say([tr(`Pick up to ${LOADOUT_MAX} tools for this game. Whatever you don't use, you keep.`, `Kies maximaal ${LOADOUT_MAX} stuks gereedschap voor dit potje. Wat je niet gebruikt, houd je.`)]);
}

function paintLoadout() {
  const grid = $('loadout-grid');
  grid.innerHTML = '';
  const total = Object.values(chosen).reduce((a, b) => a + b, 0);
  for (const id of ITEM_IDS) {
    const have = inventory[id];
    const sel = chosen[id] || 0;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `kit${sel ? ' picked' : ''}`;
    b.disabled = !have;
    b.innerHTML = `<span class="icon">${ITEMS[id].icon}</span><span class="kit-name"></span><span class="kit-info"></span><span class="kit-n">${sel ? tr(`${sel} packed · `, `${sel} mee · `) : ''}${tr(`${have} in your box`, `${have} in je kist`)}</span>`;
    b.querySelector('.kit-name').textContent = ITEMS[id].name;
    b.querySelector('.kit-info').textContent = ITEMS[id].info;
    b.addEventListener('click', () => {
      if (sel < have && total < LOADOUT_MAX) chosen[id] = sel + 1;
      else if (sel) chosen[id] = 0; // tapping a full pick empties it again
      paintLoadout();
    });
    grid.append(b);
  }
  $('loadout-count').textContent = tr(`${total} of ${LOADOUT_MAX} picked`, `${total} van ${LOADOUT_MAX} gekozen`);
}

function begin(pack) {
  if (!lives.use()) { showNoLives(); return; }
  audio();
  if (game.state === 'over') reset();
  game.stats.mode = game.mode;
  game.bar = { ...pack };
  if (asChallenge) {
    game.challenge = { target: challenge.today(scores).target, won: false };
    addJoopMarker(game.challenge.target);
  }
  paintChallengeHud();
  game.speed = START_SPEED;
  music.start(bpmFor(game.speed));
  if (!game.moving) spawn(game.speed);
  game.moving.speed = game.speed;
  game.state = 'play';
  game.startedAt = performance.now();
  const chip = $('mode-chip');
  chip.textContent = MODE_NAME[game.mode].toUpperCase();
  chip.classList.toggle('hard', game.mode === 'hard');
  goals.count('games');
  showScreen(null);
  paintTools();
  paintEffects();
  checkGoals();
  joop.quietUntil = 0;
  joop.chat(game.challenge ? tr(`I got ${game.challenge.target}. Bring it on, kiddo!`, `Ik haalde ${game.challenge.target}. Kom maar op, kleintje!`) : pick(LINES.start[game.mode]));
}

// The toolbox to look in from the menu: what you have and what each tool does.
function showToolbox() {
  const list = $('toolbox-list');
  list.innerHTML = '';
  for (const id of ITEM_IDS) {
    const li = document.createElement('li');
    if (!inventory[id]) li.className = 'none';
    li.innerHTML = `<span class="icon">${ITEMS[id].icon}</span><span class="what"><b></b><span></span></span><span class="have">×${inventory[id]}</span>`;
    li.querySelector('b').textContent = ITEMS[id].name;
    li.querySelector('.what span').textContent = ITEMS[id].info;
    list.append(li);
  }
  const n = itemCount();
  $('toolbox-count').textContent = n ? tr(`${n} tool${n > 1 ? 's' : ''} in your box`, `${n} stuks gereedschap in je kist`) : tr('Your box is still empty. Reach a goal!', 'Je kist is nog leeg. Haal een doel!');
  showScreen('toolbox');
}

function showNoLives() {
  paintLives();
  $('nolives-wait').textContent = tr(`In ${untilTomorrow()} you get ${MAX_LIVES} lives again.`, `Over ${untilTomorrow()} krijg je weer ${MAX_LIVES} levens.`);
  showScreen('nolives');
  joop.say([lives.videosLeft > 0 ? tr('All gone! Watch a video for an extra life, or come back tomorrow.', 'Op is op! Kijk een filmpje voor een extra leven, of kom morgen terug.') : tr('All gone! You can play again tomorrow.', 'Op is op! Morgen mag je weer.')]);
}

async function videoForLife(after) {
  if (lives.videosLeft <= 0) return;
  const ok = await showRewardedAd(tr('After this video you get 1 extra life.', 'Na dit filmpje krijg je 1 leven extra.'));
  if (!ok) return;
  lives.add(1, true);
  paintLives();
  joop.say([tr('An extra life! Have fun.', 'Een extra leven! Veel plezier.')], { cheer: true });
  if (after) after();
}

function gameOver() {
  game.state = 'over';
  sound.over();
  music.stop(0.3);
  buzz([60, 40, 120]);
  joop.hush();
  const score = game.stats.height;
  const isBest = score > best[game.mode];
  if (isBest) {
    best[game.mode] = score;
    store.set(`stapelgekfull-best-${game.mode}`, String(score));
  }
  // A game that went on after a video keeps one line on the scoreboard.
  if (game.recorded) scores.shift();
  scores.unshift({ s: score, m: game.mode, t: Date.now() });
  scores = scores.slice(0, 10);
  store.setJson('stapelgekfull-scores', scores);
  game.recorded = true;
  let lifeLine = '';
  if (isBest && score > 2 && !game.lifeForRecord) {
    game.lifeForRecord = true;
    lives.add(1);
    lifeLine = tr('New record: +1 life ❤️', 'Nieuw record: +1 leven ❤️');
  }
  checkGoals();
  $('over-score').textContent = score;
  $('new-best').classList.toggle('show', isBest && score > 1);
  $('over-best').textContent = `Record ${MODE_NAME[game.mode]}: ${best[game.mode]}`;
  $('over-life').textContent = lifeLine;
  paintLoot();
  paintLives();
  $('continue').hidden = game.continued;
  showWholeTower();
  setTimeout(() => {
    if (game.state !== 'over') return;
    showScreen('over');
    music.start(100);
    const c = game.challenge;
    let line = overLine(score, isBest);
    if (c && c.won) line = { text: tr(`You beat Grandpa with ${score}! I'll challenge you again tomorrow.`, `Je hebt opa verslagen met ${score}! Morgen daag ik je weer uit.`), cheer: true };
    else if (c) line = { text: pick([
      tr(`Haha, Grandpa wins! I got ${c.target}, you ${score}. Again?`, `Haha, opa wint! Ik haalde ${c.target}, jij ${score}. Nog een keer?`),
      tr(`So close! ${c.target + 1 - score} more blocks and you'd have had me. Try again!`, `Bijna! Nog ${c.target + 1 - score} blokken en je had me. Probeer het nog eens!`),
    ]) };
    joop.say([line.text], { cheer: line.cheer });
  }, 700);
}

function paintLoot() {
  const ids = ITEM_IDS.filter((id) => game.loot[id]);
  $('loot').textContent = ids.length ? `${tr('Loot', 'Buit')}: ${ids.map((id) => `${ITEMS[id].icon}×${game.loot[id]}`).join('  ')}` : '';
  $('double').hidden = !ids.length || game.doubled;
}

// Watch a video to double what this game earned.
async function doubleLoot() {
  const ok = await showRewardedAd(tr('After this video your loot is doubled.', 'Na dit filmpje krijg je je buit dubbel.'));
  if (!ok) return;
  game.doubled = true;
  for (const id of ITEM_IDS) if (game.loot[id]) { addItem(id, game.loot[id]); game.loot[id] *= 2; }
  paintLoot();
  joop.say([tr('Twice as much! Your toolbox is bursting.', 'Dubbel zoveel! Je gereedschapskist puilt uit.')], { cheer: true });
}

// Watch a video to carry on with the same tower, once per game.
async function continueGame() {
  const ok = await showRewardedAd(tr('After this video you can carry on with your tower.', 'Na dit filmpje mag je verder met je toren.'));
  if (!ok) return;
  game.continued = true;
  document.body.classList.remove('poster-1', 'poster-2');
  $('over').classList.remove('folded');
  game.state = 'play';
  game.startedAt = performance.now();
  view.zoom = 1;
  view.worldY = -game.level * H;
  showScreen(null);
  music.start(bpmFor(game.speed));
  spawn(game.speed);
  paintTools();
  joop.chat(tr('Here we go again! Pay attention now.', 'Daar gaan we weer! Nu goed opletten.'), { force: true });
}

let scoresFrom = 'menu';
function showScores(from) {
  scoresFrom = from;
  const list = $('board');
  list.innerHTML = '';
  const fmt = (t) => {
    try {
      return new Date(t).toLocaleString(NL ? 'nl-NL' : 'en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    } catch (e) { return ''; }
  };
  scores.forEach((row, i) => {
    const li = document.createElement('li');
    if (i === 0 && from === 'over') li.className = 'latest';
    const pts = document.createElement('span'); pts.className = 'pts'; pts.textContent = row.s;
    const unit = document.createElement('span'); unit.className = 'unit'; unit.textContent = tr('blocks', 'blokken');
    const chip = document.createElement('span'); chip.className = `chip ${row.m}`; chip.textContent = MODE_NAME[row.m] || '';
    const when = document.createElement('span'); when.className = 'when'; when.textContent = fmt(row.t);
    li.append(pts, unit, chip, when);
    list.append(li);
  });
  $('board-empty').style.display = scores.length ? 'none' : '';
  $('board-best').textContent = bestLine();
  showScreen('scores');
}

game.mode = store.get('stapelgekfull-mode', 'easy') === 'hard' ? 'hard' : 'easy';
// The download link is for the website; inside the app (loaded from file://) it has no use.
if (location.protocol === 'file:') $('get-app').remove();
$('start-easy').addEventListener('click', () => prepare('easy'));
$('start-hard').addEventListener('click', () => prepare('hard'));
$('again').addEventListener('click', () => prepare(game.mode, !!(game.challenge && !game.challenge.won)));
$('to-menu').addEventListener('click', menu);
$('menu-help').addEventListener('click', () => joop.say(LINES.intro));
$('menu-scores').addEventListener('click', () => showScores('menu'));
$('over-scores').addEventListener('click', () => showScores('over'));
$('scores-back').addEventListener('click', () => showScreen(scoresFrom));
$('loadout-go').addEventListener('click', () => begin(chosen));
$('loadout-none').addEventListener('click', () => begin({}));
$('loadout-back').addEventListener('click', () => showScreen(game.state === 'over' ? 'over' : 'menu'));
$('menu-kit').addEventListener('click', showToolbox);
$('challenge-face').append($('joop-figure').querySelector('svg').cloneNode(true));
$('challenge-btn').addEventListener('click', () => {
  const c = challenge.today(scores);
  if (c.won) joop.say([tr("You already beat me today! I'll think up a new challenge tomorrow.", 'Je hebt me vandaag al verslagen! Morgen bedenk ik een nieuwe uitdaging.')], { cheer: true });
  else prepare(c.mode, true);
});
$('toolbox-back').addEventListener('click', () => showScreen('menu'));
$('menu-goals-btn').addEventListener('click', () => { paintGoals(); showScreen('goals'); });
$('goals-back').addEventListener('click', () => showScreen('menu'));

// Theme picker: a new theme gets a NEW sticker on the button until you have looked.
if (store.get('stapelgekfull-themes-seen', '') === '1') $('themes-new').remove();
for (const t of THEMES) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = `theme${t.id === LOOK ? ' on' : ''}`;
  b.setAttribute('aria-pressed', String(t.id === LOOK));
  b.innerHTML = `<img src="themes/${t.id}.jpg" alt=""><span>${t.name}</span>`;
  b.addEventListener('click', () => {
    if (t.id === LOOK) { showScreen('menu'); return; }
    store.set('stapelgekfull-theme', t.id);
    location.reload(); // every theme sets up its own scene, so start fresh
  });
  $('theme-grid').append(b);
}
$('menu-themes').addEventListener('click', () => {
  store.set('stapelgekfull-themes-seen', '1');
  $('themes-new')?.remove();
  showScreen('themes');
});
$('themes-back').addEventListener('click', () => showScreen('menu'));
$('nolives-back').addEventListener('click', () => showScreen(game.state === 'over' ? 'over' : 'menu'));
$('nolives-video').addEventListener('click', () => videoForLife(() => prepare(game.mode)));
$('menu-video').addEventListener('click', () => videoForLife());
$('double').addEventListener('click', doubleLoot);
$('continue').addEventListener('click', continueGame);

const stopButton = $('stop');
stopButton.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  e.stopPropagation();
  stopButton.classList.add('down');
  drop();
});
for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) stopButton.addEventListener(ev, () => stopButton.classList.remove('down'));
renderer.domElement.addEventListener('pointerdown', drop);
window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (e.code === 'Space' || e.code === 'Enter' || e.code === 'ArrowDown') {
    e.preventDefault();
    const open = document.querySelector('.screen.show');
    if (game.state === 'play' && !open) drop();
    else if (open && open.id === 'loadout') begin(chosen);
    else if (open && (open.id === 'menu' || open.id === 'over')) prepare(game.mode);
  }
});

// ---------- Loop ----------

let last = performance.now();
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;

  const m = game.moving;
  if (m && game.state !== 'over' && !paused) {
    m.age += dt;
    if (m.kind === 'golden') {
      if (m.age >= 0.5 && game.state === 'play') { placeMoving(); landGolden(); }
    } else {
      const speed = m.speed * (game.slowLeft > 0 ? 0.5 : 1);
      m.offset += m.dir * speed * dt;
      if (m.entering) {
        const reach = m.axis === 'x' ? (game.top.sx + m.sx) / 2 : (game.top.sz + m.sz) / 2;
        if (Math.abs(m.offset) < reach) m.entering = false;
      }
      if (Math.abs(m.offset) > TRAVEL) {
        m.offset = Math.sign(m.offset) * TRAVEL;
        m.dir = -m.dir;
      }
    }
    if (game.moving === m) {
      // A block turned to diamond grows to its new size.
      if (m.grow !== undefined && m.grow < 1) {
        m.grow = Math.min(1, m.grow + dt * 4);
        const pop = 1 + Math.sin(m.grow * Math.PI) * 0.15;
        m.mesh.scale.set(m.mesh.scale.x + (m.sx - m.mesh.scale.x) * m.grow, H * pop, m.mesh.scale.z + (m.sz - m.mesh.scale.z) * m.grow);
      }
      placeMoving();
    }
  }
  diamondTexture.offset.x = (diamondTexture.offset.x + dt * 0.05) % 1; // a slow shimmer on every diamond

  for (let i = game.pieces.length - 1; i >= 0; i--) {
    const p = game.pieces[i];
    p.age += dt;
    const mat = p.mesh.material;
    // First a short white-then-red flash in place, so you see exactly what is cut off.
    if (p.age < 0.08) mat.color.setRGB(1, 1, 1);
    else mat.color.copy(p.base).lerp(CUT_RED, Math.max(0, 1 - (p.age - 0.08) / 1.2));
    p.flash.material.color.setHex(p.age < 0.08 ? 0xffffff : 0xff2a55);
    if (p.v) {
      p.v[1] -= 26 * dt;
      p.mesh.position.x += p.v[0] * dt;
      p.mesh.position.y += p.v[1] * dt;
      p.mesh.position.z += p.v[2] * dt;
      p.mesh.rotation.x += p.spin[0] * dt;
      p.mesh.rotation.y += p.spin[1] * dt;
      p.mesh.rotation.z += p.spin[2] * dt;
    } else if (p.age > 0.18) {
      p.vy -= 26 * dt;
      p.mesh.position.y += p.vy * dt;
      if (p.axis === 'x') { p.mesh.position.x += p.side * 1.6 * dt; p.mesh.rotation.z -= p.side * 2.4 * dt; } else { p.mesh.position.z += p.side * 1.6 * dt; p.mesh.rotation.x += p.side * 2.4 * dt; }
    }
    const fade = Math.max(0, Math.min(1, 1 - (p.age - 1.1) / 0.6));
    mat.opacity = fade;
    p.flash.material.opacity = fade;
    if (p.age > 1.7) {
      world.remove(p.mesh);
      game.pieces.splice(i, 1);
    }
  }

  for (let i = game.effects.length - 1; i >= 0; i--) {
    const e = game.effects[i];
    e.age += dt;
    const t = e.age / e.life;
    if (e.kind === 'slice') {
      e.mesh.material.opacity = 1 - t;
      e.mesh.scale.x = e.sx * (1 + t * 0.5);
    } else if (e.kind === 'ring') {
      const s = 1 + t * 0.6;
      e.mesh.scale.set(e.sx * s, 1, e.sz * s);
      e.mesh.material.opacity = 1 - t;
    } else {
      e.v[1] -= 20 * dt;
      e.mesh.position.x += e.v[0] * dt;
      e.mesh.position.y += e.v[1] * dt;
      e.mesh.position.z += e.v[2] * dt;
      e.mesh.material.opacity = 1 - t;
    }
    if (t >= 1) {
      world.remove(e.mesh);
      game.effects.splice(i, 1);
    }
  }

  // The tower slides down as it grows; on game over the camera pulls back to show all of it.
  const ease = 1 - Math.exp(-dt * 7);
  world.position.y += (view.worldY - world.position.y) * ease;
  if (Math.abs(camera.zoom - view.zoom) > 0.0005) {
    camera.zoom += (view.zoom - camera.zoom) * ease;
    camera.updateProjectionMatrix();
  }

  if (LOOK === 'sky') paintSkyLayers();
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

if (location.search.includes('debug')) window.stapelgekfull = { game, grant, useTool, lives, goals, inventory };
// The first start asks for the birth year, the same neutral way for everyone, before the ads may start.
function askAge() {
  reset();
  const pickYear = $('age-year');
  const now = new Date().getFullYear();
  for (let y = now; y >= now - 100; y--) pickYear.add(new Option(String(y), String(y)));
  pickYear.addEventListener('change', () => { $('age-ok').disabled = !pickYear.value; });
  $('age-ok').addEventListener('click', () => {
    if (!pickYear.value) return;
    setBirthYear(Number(pickYear.value));
    menu();
  });
  showScreen('age');
}
if (audience()) { tellAudience(); menu(); } else askAge();
requestAnimationFrame(frame);
