// What the player keeps between games: the toolbox, the goals and the lives of the day.
import { store } from './store.js';

export const ITEMS = {
  diamond: { icon: '💎', name: 'Diamant', info: 'Je blok wordt een diamant, zo groot als vóór je laatste snee. Wordt nooit gesneden.' },
  pump: { icon: '🎈', name: 'Pomp', info: 'Maakt de bovenkant van je toren weer een stuk breder.' },
  slow: { icon: '🐌', name: 'Slakje', info: 'De volgende 5 blokken op halve snelheid.' },
  magnet: { icon: '🧲', name: 'Magneet', info: 'Trekt de volgende 3 blokken recht als je dichtbij zit.' },
  buoy: { icon: '🛟', name: 'Reddingsboei', info: 'Helemaal mis? Dan krijg je nog een kans. Werkt vanzelf.' },
  bomb: { icon: '💣', name: 'Bom', info: 'Blaast 5 lagen weg: lager, maar weer breed.' },
  dynamite: { icon: '🧨', name: 'Dynamiet', info: 'Blaast 10 lagen weg: veel lager, maar weer breed.' },
};
export const ITEM_IDS = Object.keys(ITEMS);
export const LOADOUT_MAX = 3;

// ---------- Toolbox ----------

export const inventory = store.json('stapelgekfull-items', {});
for (const id of ITEM_IDS) inventory[id] = Math.max(0, inventory[id] | 0);
const saveInventory = () => store.setJson('stapelgekfull-items', inventory);

export function addItem(id, n = 1) {
  inventory[id] += n;
  saveInventory();
}
export function takeItem(id) {
  if (inventory[id] <= 0) return false;
  inventory[id] -= 1;
  saveInventory();
  return true;
}
export const itemCount = () => ITEM_IDS.reduce((sum, id) => sum + inventory[id], 0);

// ---------- Lives: 5 a day, more for a record, 40 high or a video ----------

export const MAX_LIVES = 5;
const LIVES_CAP = 9;
export const VIDEOS_PER_DAY = 5;
const dayName = (d) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
const today = () => dayName(new Date());
const yesterday = () => { const d = new Date(); d.setDate(d.getDate() - 1); return dayName(d); };
const livesData = store.json('stapelgekfull-lives', { day: '', n: MAX_LIVES, videos: 0 });

export const lives = {
  refresh() {
    if (livesData.day === today()) return;
    livesData.day = today();
    livesData.n = Math.max(livesData.n, MAX_LIVES);
    livesData.videos = 0;
    store.setJson('stapelgekfull-lives', livesData);
  },
  get count() { this.refresh(); return livesData.n; },
  get videosLeft() { this.refresh(); return VIDEOS_PER_DAY - livesData.videos; },
  use() {
    this.refresh();
    if (livesData.n <= 0) return false;
    livesData.n -= 1;
    store.setJson('stapelgekfull-lives', livesData);
    return true;
  },
  add(n = 1, fromVideo = false) {
    this.refresh();
    livesData.n = Math.min(LIVES_CAP, livesData.n + n);
    if (fromVideo) livesData.videos += 1;
    store.setJson('stapelgekfull-lives', livesData);
  },
};

// Time until the lives come back, as "3 uur en 12 minuten".
export function untilTomorrow() {
  const now = new Date();
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const min = Math.ceil((midnight - now) / 60000);
  const h = Math.floor(min / 60);
  return h ? `${h} uur en ${min % 60} minuten` : `${min} minuten`;
}

// ---------- Goals ----------
// Three at a time. "game" goals must be reached in one game, "total" goals add up over all games.
// Every goal done makes the next ones a bit harder.

const GOAL_KINDS = {
  height: { text: (n) => `Bouw een toren van ${n}`, base: 15, step: 8 },
  streak: { text: (n) => `Haal ${n}× perfect op rij`, base: 3, step: 1 },
  perfects: { text: (n) => `Haal ${n} perfects in één potje`, base: 5, step: 3 },
  hard: { text: (n) => `Haal ${n} hoog in Moeilijk`, base: 12, step: 6 },
  games: { text: (n) => `Speel ${n} potjes`, base: 3, step: 2, total: true },
  blocks: { text: (n) => `Stapel in totaal ${n} blokken`, base: 80, step: 60, total: true },
  tools: { text: (n) => `Gebruik ${n}× gereedschap`, base: 2, step: 1, total: true },
};
const REWARD_WEIGHTS = { pump: 4, slow: 4, magnet: 4, buoy: 3, bomb: 3, dynamite: 1, diamond: 1 };

const goalData = store.json('stapelgekfull-goals', { tier: 0, list: [] });
const saveGoals = () => store.setJson('stapelgekfull-goals', goalData);

function rollReward(random = Math.random) {
  const total = Object.values(REWARD_WEIGHTS).reduce((a, b) => a + b, 0);
  let r = random() * total;
  for (const [id, w] of Object.entries(REWARD_WEIGHTS)) { r -= w; if (r < 0) return id; }
  return 'pump';
}

function newGoal() {
  const taken = new Set(goalData.list.map((g) => g.kind));
  const kinds = Object.keys(GOAL_KINDS).filter((k) => !taken.has(k));
  const kind = kinds[Math.floor(Math.random() * kinds.length)];
  const def = GOAL_KINDS[kind];
  const level = goalData.tier + Math.floor(Math.random() * 2);
  return { kind, n: def.base + def.step * level, have: 0, reward: rollReward(), amount: goalData.tier >= 6 ? 2 : 1 };
}

goalData.list = goalData.list.filter((g) => GOAL_KINDS[g.kind] && ITEMS[g.reward]);
while (goalData.list.length < 3) goalData.list.push(newGoal());
saveGoals();

export const goals = {
  get list() { return goalData.list; },
  text(g) { return GOAL_KINDS[g.kind].text(g.n); },
  isTotal(g) { return !!GOAL_KINDS[g.kind].total; },
  // Progress of a goal, given the stats of the game being played (or none, in the menu).
  progress(g, stats) {
    if (this.isTotal(g)) return Math.min(g.have, g.n);
    if (!stats) return 0;
    const value = { height: stats.height, streak: stats.maxCombo, perfects: stats.perfects, hard: stats.mode === 'hard' ? stats.height : 0 }[g.kind];
    return Math.min(value || 0, g.n);
  },
  // Count something for the "total" goals.
  count(kind, n = 1) {
    for (const g of goalData.list) if (g.kind === kind) g.have += n;
    saveGoals();
  },
  // Returns the goals just reached, already swapped for new ones.
  collect(stats) {
    const done = goalData.list.filter((g) => this.progress(g, stats) >= g.n);
    if (!done.length) return [];
    goalData.list = goalData.list.filter((g) => !done.includes(g));
    goalData.tier += done.length;
    while (goalData.list.length < 3) goalData.list.push(newGoal());
    saveGoals();
    return done;
  },
};

// ---------- Opa Joop's daily challenge ----------
// Each day Joop sets a height a bit above what you usually reach. Beat it once for two tools.

// The same day always gives the same challenge.
function seeded(text) {
  let h = 2166136261;
  for (const c of text) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const challengeData = store.json('stapelgekfull-challenge', { day: '', mode: 'easy', target: 0, reward: [], won: false, streak: 0, lastWon: '' });

export const challenge = {
  // Today's challenge, made from the scores of your last games the first time it is asked for.
  today(recent) {
    const day = today();
    if (challengeData.day !== day) {
      const random = seeded(`stapelgek-${day}`);
      const mode = random() < 0.7 ? 'easy' : 'hard';
      const own = recent.filter((r) => r.m === mode).map((r) => r.s);
      const pool = (own.length ? own : recent.map((r) => r.s * (mode === 'hard' ? 0.7 : 1))).sort((a, b) => b - a).slice(0, 5);
      const usual = pool.length ? pool.reduce((a, b) => a + b, 0) / pool.length : 15;
      const target = Math.round(Math.min(200, Math.max(10, usual * (0.95 + random() * 0.35))));
      Object.assign(challengeData, { day, mode, target, reward: [rollReward(random), rollReward(random)], won: false });
      store.setJson('stapelgekfull-challenge', challengeData);
    }
    return challengeData;
  },
  // Days in a row won, counting today or yesterday.
  get streak() {
    return challengeData.lastWon === today() || challengeData.lastWon === yesterday() ? challengeData.streak : 0;
  },
  win() {
    if (challengeData.won) return challengeData;
    challengeData.streak = challengeData.lastWon === yesterday() ? challengeData.streak + 1 : 1;
    challengeData.lastWon = today();
    challengeData.won = true;
    store.setJson('stapelgekfull-challenge', challengeData);
    return challengeData;
  },
};
