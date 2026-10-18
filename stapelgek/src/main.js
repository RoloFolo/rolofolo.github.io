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

function paintMute() {
  $('icon-on').style.display = muted ? 'none' : '';
  $('icon-off').style.display = muted ? '' : 'none';
}
paintMute();
$('mute').addEventListener('click', () => {
  muted = !muted;
  store.set('stapelgek-muted', muted ? '1' : '0');
  paintMute();
});

// ---------- Game state ----------

const game = {
  state: 'menu',      // menu | play | over
  level: 0,           // layers stacked on the first block
  top: null,          // { x, z, sx, sz } of the highest layer
  moving: null,       // the block floating in
  combo: 0,
  startedAt: 0,
  blocks: [],
  pieces: [],         // cut-off parts tumbling down
  effects: [],        // flashes, rings and sparks
};

let best = parseInt(store.get('stapelgek-best', '0'), 10) || 0;
const pedestal = makeBlock(0, 0, -PEDESTAL / 2, 0, BASE, PEDESTAL, BASE);

function reset() {
  for (const mesh of [...game.blocks, ...game.pieces.map((p) => p.mesh), ...game.effects.map((e) => e.mesh)]) {
    world.remove(mesh);
  }
  if (game.moving) world.remove(game.moving.mesh);
  hue0 = Math.random() * 360;
  pedestal.material.color.copy(colorAt(0));
  paintSky(0);
  Object.assign(game, { level: 0, top: { x: 0, z: 0, sx: BASE, sz: BASE }, moving: null, combo: 0, blocks: [], pieces: [], effects: [] });
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

const speedAt = (level) => Math.min(10, 4.2 + level * 0.12);

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
  spawn(speedAt(game.level));
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

// ---------- Screens ----------

function showScreen(id) {
  for (const s of document.querySelectorAll('.screen')) s.classList.toggle('show', s.id === id);
  $('hud').classList.toggle('show', id === null);
  $('stop').classList.toggle('show', id === null);
}

function menu() {
  reset();
  game.state = 'menu';
  $('menu-best').textContent = best ? `Record: ${best} blokken` : 'Hoe hoog kom jij?';
  spawn(1.6);
  showScreen('menu');
}

function start() {
  audio();
  if (game.state === 'over') reset();
  if (!game.moving) spawn(speedAt(0));
  game.moving.speed = speedAt(0);
  game.state = 'play';
  game.startedAt = performance.now();
  showScreen(null);
}

function gameOver() {
  game.state = 'over';
  sound.over();
  buzz([60, 40, 120]);
  const score = game.level + 1;
  const isBest = score > best;
  if (isBest) { best = score; store.set('stapelgek-best', String(best)); }
  $('over-score').textContent = score;
  $('new-best').classList.toggle('show', isBest && score > 1);
  $('over-best').textContent = `Record: ${best}`;
  showWholeTower();
  setTimeout(() => { if (game.state === 'over') showScreen('over'); }, 700);
}

$('start').addEventListener('click', start);
$('again').addEventListener('click', start);
$('to-menu').addEventListener('click', menu);

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
    else start();
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
