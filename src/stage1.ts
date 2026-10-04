// Stage 1: over the ocean, across the beach, up a jungle river, into the base. The boss waits at the end.
// Waves fire when the scroll distance passes `at`; the screen is 320 pixels tall and scrolls 30 a second.
import type { World } from './world';
import { ENEMIES, ItemKind } from './enemies';
import { W } from './draw';

export interface Wave {
  at: number;
  run(w: World): void;
}

export const STAGE_LEN = 4600;

const { fighter, gunship, carrier, tank, bunker } = ENEMIES;

/** n fighters diving one after another down column x. */
const dive = (x: number, n = 5, gap = 12) => (w: World) => {
  for (let k = 0; k < n; k++) w.after(k * gap, () => w.spawn(fighter, x, -12, [0, 0, k * 4]));
};

/** A line of fighters sweeping in from one side at height y. */
const sweep = (fromLeft: boolean, y: number, n = 6) => (w: World) => {
  for (let k = 0; k < n; k++) w.after(k * 10, () => w.spawn(fighter, fromLeft ? -12 : W + 12, y, [1, y, k * 3]));
};

/** A V of fighters that dive to row `turn` and climb away again. */
const swoop = (cx: number, turn: number) => (w: World) => {
  const offs = [0, -18, 18, -36, 36];
  offs.forEach((dx, k) => w.after(k * 6, () => w.spawn(fighter, cx + dx, -12, [2, turn, k * 5])));
};

const gun = (x: number, row = 70, drop?: ItemKind) => (w: World) => void w.spawn(gunship, x, -30, [row], drop);
const cargo = (x: number, drop: ItemKind = 'weapon') => (w: World) => void w.spawn(carrier, x, -20, [], drop);

/** Tanks rolling in a column from the top, or across from a side when vx is set. */
const tanks = (x: number, n: number, vx = 0, vy = 0.3, y = -14) => (w: World) => {
  for (let k = 0; k < n; k++) w.after(k * 30, () => w.spawn(tank, x, y, [vx, vy]));
};

/** A bunker with a medal in it. */
const pillbox = (x: number, medal = true) => (w: World) => void w.spawn(bunker, x, -16, [], medal ? 'medal' : undefined);

const both = (...fns: ((w: World) => void)[]) => (w: World) => fns.forEach((f) => f(w));

export const STAGE1: Wave[] = [
  // Open sea.
  { at: 60, run: dive(60) },
  { at: 160, run: dive(180) },
  { at: 260, run: sweep(true, 80) },
  { at: 330, run: cargo(120) },
  { at: 420, run: swoop(120, 140) },
  { at: 520, run: sweep(false, 60) },
  { at: 600, run: both(dive(40, 4), dive(200, 4)) },
  { at: 700, run: gun(120) },
  { at: 860, run: swoop(70, 160) },
  { at: 900, run: swoop(170, 160) },
  // The coast.
  { at: 1000, run: both(tanks(40, 3), cargo(190, 'missile')) },
  { at: 1080, run: sweep(true, 100) },
  { at: 1140, run: tanks(200, 3) },
  { at: 1200, run: both(pillbox(70), pillbox(170)) },
  { at: 1280, run: dive(120, 6, 10) },
  { at: 1380, run: tanks(-12, 4, 0.6, 0, 120) },
  { at: 1460, run: gun(70, 60) },
  { at: 1480, run: gun(170, 80) },
  { at: 1560, run: both(pillbox(40), pillbox(120), pillbox(200)) },
  // Jungle and the river.
  { at: 1700, run: both(swoop(60, 120), swoop(180, 120)) },
  { at: 1780, run: cargo(60) },
  { at: 1860, run: both(tanks(30, 4), tanks(210, 4)) },
  { at: 1980, run: sweep(false, 90, 8) },
  { at: 2060, run: pillbox(120) },
  { at: 2120, run: dive(80, 5) },
  { at: 2160, run: dive(160, 5) },
  { at: 2260, run: gun(120, 70, 'bomb') },
  { at: 2400, run: both(tanks(W + 12, 4, -0.6, 0, 80), sweep(true, 120)) },
  { at: 2500, run: both(pillbox(50), pillbox(190)) },
  { at: 2580, run: cargo(160) },
  { at: 2660, run: both(swoop(120, 180), dive(30, 4), dive(210, 4)) },
  { at: 2800, run: both(gun(60, 60), gun(180, 90)) },
  { at: 2960, run: tanks(120, 5) },
  { at: 3040, run: sweep(true, 70, 8) },
  { at: 3100, run: sweep(false, 110, 8) },
  { at: 3200, run: both(pillbox(30), pillbox(90), pillbox(150), pillbox(210)) },
  // The base.
  { at: 3360, run: cargo(100, 'missile') },
  { at: 3420, run: both(tanks(40, 3), tanks(200, 3)) },
  { at: 3500, run: both(pillbox(60), pillbox(180), swoop(120, 140)) },
  { at: 3600, run: gun(120, 60) },
  { at: 3700, run: both(pillbox(40), pillbox(120), pillbox(200)) },
  { at: 3780, run: both(dive(50, 6, 8), dive(190, 6, 8)) },
  { at: 3880, run: cargo(140) },
  { at: 3960, run: both(tanks(-12, 4, 0.6, 0, 100), tanks(W + 12, 4, -0.6, 0, 160)) },
  { at: 4060, run: both(pillbox(80), pillbox(160)) },
  { at: 4140, run: both(gun(70, 70), gun(170, 70)) },
  { at: 4300, run: both(swoop(80, 150), swoop(160, 150)) },
  { at: 4400, run: cargo(120, 'bomb') },
];
