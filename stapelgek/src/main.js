// Stapelgek: stop the floating block above the tower; whatever sticks out is cut off.
import {
  AdditiveBlending, BoxGeometry, BufferAttribute, Color, DoubleSide, EdgesGeometry, Group, LineBasicMaterial,
  LineSegments, Mesh, MeshBasicMaterial, OrthographicCamera, PlaneGeometry, RingGeometry, Scene, WebGLRenderer,
} from 'three';

const BASE = 3;          // footprint of the first block
const H = 0.7;           // height of one layer
const PEDESTAL = 6;      // the first block reaches down out of view
const TRAVEL = 4.6;      // how far from the centre a block floats in
const PERFECT = 0.12;    // misses smaller than this snap into place
const GROW = 0.25;       // a perfect streak of 3+ grows the block back by this much
const ISO_UP = 2 / Math.sqrt(6); // screen height of one world unit straight up

const CUT_RED = new Color(0xff1744);

const $ = (id) => document.getElementById(id);

const store = {
  get(key, fallback) {
    try { const v = localStorage.getItem(key); return v === null ? fallback : v; } catch (e) { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, value); } catch (e) { /* private mode: nothing to keep */ }
  },
};

// ---------- Scene ----------

const renderer = new WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
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

function makeBlock(level, x, y, z, sx, sy, sz) {
  const mesh = new Mesh(unitShaded, new MeshBasicMaterial({ color: colorAt(level), vertexColors: true }));
  mesh.position.set(x, y, z);
  mesh.scale.set(sx, sy, sz);
  world.add(mesh);
  return mesh;
}

function paintSky(level) {
  const h = (hueAt(level) + 170) % 360;
  const sky = $('sky').style;
  sky.setProperty('--sky-top', `hsl(${h}, 95%, 88%)`);
  sky.setProperty('--sky-bottom', `hsl(${(h + 40) % 360}, 85%, 70%)`);
}

// ---------- View ----------

const view = { hh: 10, targetY: 0, worldY: 0, zoom: 1 };

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
function showWholeTower() {
  const towerHeight = game.level * H;
  view.zoom = Math.min(1, (0.85 * view.hh) / (towerHeight * ISO_UP + 3));
  view.worldY = view.targetY + (0.45 * view.hh) / (view.zoom * ISO_UP) - towerHeight / 2;
}

// ---------- Sound and touch ----------

let audioCtx = null;
let muted = store.get('stapelgek-muted', '0') === '1';

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
  on: store.get('stapelgek-music', '1') === '1',
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

function paintSound() {
  $('icon-on').style.display = muted ? 'none' : '';
  $('icon-off').style.display = muted ? '' : 'none';
  $('music').classList.toggle('off', !music.on || muted);
}
paintSound();
$('mute').addEventListener('click', () => {
  muted = !muted;
  store.set('stapelgek-muted', muted ? '1' : '0');
  if (muted) music.stop(0.1); else music.start();
  paintSound();
});
$('music').addEventListener('click', () => {
  if (muted) { muted = false; store.set('stapelgek-muted', '0'); music.on = false; }
  music.on = !music.on;
  store.set('stapelgek-music', music.on ? '1' : '0');
  if (music.on) music.start(); else music.stop(0.2);
  paintSound();
});
// Browsers only allow sound after a tap, so the menu music starts on the first one.
window.addEventListener('pointerdown', () => { if (game.state !== 'over') music.start(); }, { once: true });
document.addEventListener('visibilitychange', () => {
  if (!audioCtx) return;
  if (document.hidden) audioCtx.suspend(); else if (!muted) audioCtx.resume();
});
if (location.search.includes('debug')) window.stapelgekMusic = { playStep, STEPS, music };

// ---------- Game state ----------

const game = {
  state: 'menu',      // menu | play | over
  mode: 'easy',       // easy: the speed only goes up after a perfect block | hard: faster with every block
  speed: 0,
  level: 0,           // layers stacked on the first block
  top: null,          // { x, z, sx, sz } of the highest layer
  moving: null,       // the block floating in
  combo: 0,
  startedAt: 0,
  blocks: [],
  pieces: [],         // cut-off parts tumbling down
  effects: [],        // flashes, rings and sparks
};

// Records per mode and the last 10 scores. The record from before the modes existed was a hard game.
const best = {
  easy: parseInt(store.get('stapelgek-best-easy', '0'), 10) || 0,
  hard: parseInt(store.get('stapelgek-best-hard', store.get('stapelgek-best', '0')), 10) || 0,
};
let scores = [];
try { scores = JSON.parse(store.get('stapelgek-scores', '[]')) || []; } catch (e) { scores = []; }
const MODE_NAME = { easy: 'Makkelijk', hard: 'Moeilijk' };
const pedestal = makeBlock(0, 0, -PEDESTAL / 2, 0, BASE, PEDESTAL, BASE);

function reset() {
  for (const mesh of [...game.blocks, ...game.pieces.map((p) => p.mesh), ...game.effects.map((e) => e.mesh)]) {
    world.remove(mesh);
  }
  if (game.moving) world.remove(game.moving.mesh);
  hue0 = Math.random() * 360;
  pedestal.material.color.copy(colorAt(0));
  paintSky(0);
  Object.assign(game, { level: 0, top: { x: 0, z: 0, sx: BASE, sz: BASE }, moving: null, combo: 0, warnedNarrow: false, blocks: [], pieces: [], effects: [] });
  view.worldY = 0;
  view.zoom = 1;
  setScore();
}

function spawn(speed) {
  const axis = Math.random() < 0.5 ? 'x' : 'z';
  const side = Math.random() < 0.5 ? -1 : 1;
  const { x, z, sx, sz } = game.top;
  const level = game.level + 1;
  const mesh = makeBlock(level, x, 0, z, sx, H, sz);
  game.moving = { mesh, axis, offset: side * TRAVEL, dir: -side, speed, age: 0 };
  placeMoving();
}

const START_SPEED = 4.2;
const SPEED_STEP = 0.12;
const MAX_SPEED = 10;

function placeMoving() {
  const m = game.moving;
  const lift = 1.6 * Math.pow(1 - Math.min(m.age / 0.4, 1), 3);
  m.mesh.position.y = (game.level + 1) * H - H / 2 + lift;
  if (m.axis === 'x') m.mesh.position.x = game.top.x + m.offset;
  else m.mesh.position.z = game.top.z + m.offset;
}

function setScore(bump) {
  const el = $('score');
  el.textContent = game.level + 1;
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
  if (game.state !== 'play' || !game.moving || performance.now() - game.startedAt < 150) return;
  const m = game.moving;
  game.moving = null;
  const top = game.top;
  const onX = m.axis === 'x';
  const centre = onX ? top.x : top.z;
  const size = onX ? top.sx : top.sz;
  const delta = m.offset;
  const y = (game.level + 1) * H - H / 2;
  m.mesh.position.y = y;

  if (Math.abs(delta) >= size) {
    // Missed completely: the whole block falls.
    addPiece(m.mesh, m.axis, Math.sign(delta) || 1);
    gameOver();
    return;
  }

  let newCentre = centre;
  let newSize = size;
  if (Math.abs(delta) <= PERFECT) {
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
  m.mesh.position.set(placed.x, y, placed.z);
  m.mesh.scale.set(placed.sx, H, placed.sz);
  if (game.combo > 0) addRing(placed, y + H / 2);
  else sound.place();

  game.blocks.push(m.mesh);
  game.top = placed;
  game.level += 1;
  view.worldY = -game.level * H;
  setScore(true);
  paintSky(game.level);
  // Hard gets faster with every block; easy only after a perfect one, so a miss never speeds things up.
  if (game.mode === 'hard' || game.combo > 0) game.speed = Math.min(MAX_SPEED, game.speed + SPEED_STEP);
  spawn(game.speed);
  music.bpm = bpmFor(game.speed);
  const height = game.level + 1;
  if (height % 10 === 0 || height === 25 || height === 75) joop.chat(LINES.milestone[height] || `${height} hoog! Ga zo door!`, { cheer: true, force: true });
}

function addPiece(mesh, axis, side) {
  const flash = new LineSegments(unitEdges, new LineBasicMaterial({ color: 0xffffff, transparent: true }));
  mesh.add(flash);
  mesh.material.transparent = true;
  game.pieces.push({ mesh, flash, axis, side, age: 0, vy: 0, base: mesh.material.color.clone() });
}

function addSlice(axis, at, y, other, otherSize) {
  const mesh = new Mesh(unitPlane, new MeshBasicMaterial({
    color: 0xffffff, transparent: true, side: DoubleSide, blending: AdditiveBlending, depthWrite: false,
  }));
  if (axis === 'x') { mesh.position.set(at, y, other); mesh.rotation.y = Math.PI / 2; } else { mesh.position.set(other, y, at); }
  mesh.scale.set(otherSize + 0.6, H + 0.6, 1);
  world.add(mesh);
  game.effects.push({ mesh, age: 0, life: 0.35, kind: 'slice', sx: otherSize + 0.6 });

  for (let i = 0; i < 12; i++) {
    const spark = new Mesh(unitBox, new MeshBasicMaterial({ color: i % 2 ? 0xffffff : 0xff3d6e, transparent: true }));
    const along = (Math.random() - 0.5) * otherSize;
    if (axis === 'x') spark.position.set(at, y + (Math.random() - 0.5) * H, other + along);
    else spark.position.set(other + along, y + (Math.random() - 0.5) * H, at);
    spark.scale.setScalar(0.08 + Math.random() * 0.08);
    world.add(spark);
    game.effects.push({
      mesh: spark, age: 0, life: 0.5 + Math.random() * 0.3, kind: 'spark',
      v: [(Math.random() - 0.5) * 6, 2 + Math.random() * 5, (Math.random() - 0.5) * 6],
    });
  }
}

function addRing(placed, y) {
  const mesh = new Mesh(squareRing, new MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false }));
  mesh.position.set(placed.x, y + 0.01, placed.z);
  mesh.scale.set(placed.sx, 1, placed.sz);
  world.add(mesh);
  game.effects.push({ mesh, age: 0, life: 0.6, kind: 'ring', sx: placed.sx, sz: placed.sz });
}

// ---------- Joop ----------

const pick = (list) => list[Math.floor(Math.random() * list.length)];

const LINES = {
  intro: [
    'Hoi! Ik ben Joop, stapelkampioen van de familie.',
    'Zo komt er een blok aangezweefd. Druk op STOP als hij precies boven je toren hangt.',
    'Steekt er een stukje uit? Snip snap, dat snij ik er gewoon af!',
    'Precies goed is PERFECT. Drie keer op rij? Dan groeit je blok weer een beetje.',
    'Kies Makkelijk of Moeilijk. Bij Moeilijk gaat het steeds sneller. Succes!',
  ],
  hello: [
    'Zin in een potje stapelen?',
    'Hoe hoog kom jij vandaag?',
    'Ik heb mijn stropdas al rechtgetrokken. Kom maar op!',
    'Tik op mij als je de uitleg nog een keer wilt horen.',
    'Vijftig jaar getrouwd, maar stapelen blijft spannend!',
  ],
  start: {
    easy: ['Rustig aan, we hebben alle tijd!', 'Makkelijk is ook heel knap hoor!', 'Lekker in je eigen tempo.'],
    hard: ['Moeilijk? Petje af! Het gaat steeds sneller.', 'Hou je vast, dit wordt snel!', 'Echte bikkels kiezen Moeilijk!'],
  },
  perfect: ['Prachtig!', 'Keurig netjes!', 'Zo recht als mijn stropdas!', 'Dat had ik zelf niet beter gekund!', 'Precies goed!', 'Vakwerk!'],
  streak: ['Drie op rij! Je blok groeit weer!', 'Je bent op dreef!', 'Wat een stapelaar ben jij!'],
  bigCut: ['Oei, dat was een flink stuk!', 'Snip snap! De volgende beter.', 'Niet getreurd, gewoon doorstapelen!', 'Au, daar gaat een stuk!'],
  narrow: ['Hij wordt wel smal, hè? Concentratie!', 'Voorzichtig nu, het is nog maar een smal blokje!'],
  milestone: {
    10: 'Tien hoog! Mooi begin!',
    25: '25 hoog! Een zilveren toren!',
    50: '50 hoog! Een gouden toren, net als ons huwelijk!',
    75: '75! Ik krijg er hoogtevrees van!',
    100: '100! Ik ben sprakeloos. Bijna.',
  },
};

function overLine(score, isBest) {
  if (isBest && score > 2) return { text: `Gefeliciteerd! Een nieuw record: ${score} blokken!`, cheer: true };
  if (score < 5) return { text: pick(['Ach, iedereen begint klein. Nog een keer!', 'Oefening baart kunst. Probeer het nog eens!']) };
  if (score < 15) return { text: pick(['Goed bezig! Volgende keer nog hoger?', 'Netjes! Ik zie talent.']) };
  if (score < 30) return { text: pick(['Knap gedaan! Ik ben trots op je.', 'Wat een toren! Gefeliciteerd!']), cheer: true };
  return { text: pick(['Ongelooflijk! Gefeliciteerd, kampioen!', 'Daar kan ik nog wat van leren. Bravo!']), cheer: true };
}

const joop = {
  el: $('joop'),
  balloon: $('balloon'),
  queue: [],
  timer: 0,
  quietUntil: 0,

  // Show Joop next to the open card (menu, game over) or above the STOP button while playing.
  place() {
    const anchor = game.state === 'play' ? $('stop') : document.querySelector('.screen.show .card');
    const size = game.state === 'play' ? 86 : game.state === 'over' ? 104 : 124;
    this.el.style.setProperty('--joop-size', `${size}px`);
    if (anchor) {
      const top = anchor.getBoundingClientRect().top;
      this.el.style.bottom = `${window.innerHeight - top + (game.state === 'over' ? -10 : 8)}px`;
    }
    this.el.classList.toggle('no-tap', game.state === 'play');
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
      more.textContent = 'tik voor meer ›';
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
    this.say([text], { cheer, hold: 1900 });
  },
};

$('joop-figure').addEventListener('click', () => {
  if (game.state === 'menu') joop.say(LINES.intro);
});
joop.balloon.addEventListener('click', () => joop.next());
window.addEventListener('resize', () => joop.place());

// ---------- Screens ----------

function showScreen(id) {
  for (const s of document.querySelectorAll('.screen')) s.classList.toggle('show', s.id === id);
  $('hud').classList.toggle('show', id === null);
  $('stop').classList.toggle('show', id === null);
  joop.place();
  setTimeout(() => joop.place(), 400); // again once the card has popped in
  joop.show(id === 'menu' || id === 'over');
}

function bestLine() {
  if (!best.easy && !best.hard) return 'Hoe hoog kom jij?';
  return `Record: Makkelijk ${best.easy} · Moeilijk ${best.hard}`;
}

function menu() {
  reset();
  game.state = 'menu';
  $('menu-best').textContent = bestLine();
  spawn(1.6);
  showScreen('menu');
  music.start(108);
  if (store.get('stapelgek-intro', '0') !== '1') {
    store.set('stapelgek-intro', '1');
    joop.say(LINES.intro);
  } else {
    joop.say([pick(LINES.hello)]);
  }
}

function start(mode = game.mode) {
  audio();
  game.mode = mode;
  store.set('stapelgek-mode', mode);
  if (game.state === 'over') reset();
  game.speed = START_SPEED;
  music.start(bpmFor(game.speed));
  if (!game.moving) spawn(game.speed);
  game.moving.speed = game.speed;
  game.state = 'play';
  game.startedAt = performance.now();
  const chip = $('mode-chip');
  chip.textContent = MODE_NAME[mode].toUpperCase();
  chip.classList.toggle('hard', mode === 'hard');
  showScreen(null);
  joop.quietUntil = 0;
  joop.chat(pick(LINES.start[mode]));
}

function gameOver() {
  game.state = 'over';
  sound.over();
  music.stop(0.3);
  buzz([60, 40, 120]);
  joop.hush();
  const score = game.level + 1;
  const isBest = score > best[game.mode];
  if (isBest) {
    best[game.mode] = score;
    store.set(`stapelgek-best-${game.mode}`, String(score));
  }
  scores.unshift({ s: score, m: game.mode, t: Date.now() });
  scores = scores.slice(0, 10);
  store.set('stapelgek-scores', JSON.stringify(scores));
  $('over-score').textContent = score;
  $('new-best').classList.toggle('show', isBest && score > 1);
  $('over-best').textContent = `Record ${MODE_NAME[game.mode]}: ${best[game.mode]}`;
  showWholeTower();
  setTimeout(() => {
    if (game.state !== 'over') return;
    showScreen('over');
    music.start(100);
    const line = overLine(score, isBest);
    joop.say([line.text], { cheer: line.cheer });
  }, 700);
}

let scoresFrom = 'menu';
function showScores(from) {
  scoresFrom = from;
  const list = $('board');
  list.innerHTML = '';
  const fmt = (t) => {
    try {
      return new Date(t).toLocaleString('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    } catch (e) { return ''; }
  };
  scores.forEach((row, i) => {
    const li = document.createElement('li');
    if (i === 0 && from === 'over') li.className = 'latest';
    const pts = document.createElement('span'); pts.className = 'pts'; pts.textContent = row.s;
    const unit = document.createElement('span'); unit.className = 'unit'; unit.textContent = 'blokken';
    const chip = document.createElement('span'); chip.className = `chip ${row.m}`; chip.textContent = MODE_NAME[row.m] || '';
    const when = document.createElement('span'); when.className = 'when'; when.textContent = fmt(row.t);
    li.append(pts, unit, chip, when);
    list.append(li);
  });
  $('board-empty').style.display = scores.length ? 'none' : '';
  $('board-best').textContent = bestLine();
  showScreen('scores');
}

game.mode = store.get('stapelgek-mode', 'easy') === 'hard' ? 'hard' : 'easy';
// The download link is for the website; inside the app (loaded from file://) it has no use.
if (location.protocol === 'file:') $('get-app').remove();
$('start-easy').addEventListener('click', () => start('easy'));
$('start-hard').addEventListener('click', () => start('hard'));
$('again').addEventListener('click', () => start());
$('to-menu').addEventListener('click', menu);
$('menu-help').addEventListener('click', () => joop.say(LINES.intro));
$('menu-scores').addEventListener('click', () => showScores('menu'));
$('over-scores').addEventListener('click', () => showScores('over'));
$('scores-back').addEventListener('click', () => showScreen(scoresFrom));

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
    if (game.state === 'play') drop();
    else if (game.state === 'menu' || $('over').classList.contains('show')) start();
  }
});

// ---------- Loop ----------

let last = performance.now();
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;

  const m = game.moving;
  if (m && game.state !== 'over') {
    m.age += dt;
    m.offset += m.dir * m.speed * dt;
    if (Math.abs(m.offset) > TRAVEL) {
      m.offset = Math.sign(m.offset) * TRAVEL;
      m.dir = -m.dir;
    }
    placeMoving();
  }

  for (let i = game.pieces.length - 1; i >= 0; i--) {
    const p = game.pieces[i];
    p.age += dt;
    const mat = p.mesh.material;
    // First a short white-then-red flash in place, so you see exactly what is cut off.
    if (p.age < 0.08) mat.color.setRGB(1, 1, 1);
    else mat.color.copy(p.base).lerp(CUT_RED, Math.max(0, 1 - (p.age - 0.08) / 1.2));
    p.flash.material.color.setHex(p.age < 0.08 ? 0xffffff : 0xff2a55);
    if (p.age > 0.18) {
      const t = dt;
      p.vy -= 26 * t;
      p.mesh.position.y += p.vy * t;
      if (p.axis === 'x') { p.mesh.position.x += p.side * 1.6 * t; p.mesh.rotation.z -= p.side * 2.4 * t; } else { p.mesh.position.z += p.side * 1.6 * t; p.mesh.rotation.x += p.side * 2.4 * t; }
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

  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

if (location.search.includes('debug')) window.stapelgek = game;
menu();
requestAnimationFrame(frame);
