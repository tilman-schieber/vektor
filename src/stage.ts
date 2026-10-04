// What makes a stage, and the building blocks of its waves.
// Waves fire when the scroll distance passes `at`; the screen is 320 pixels tall and scrolls 30 a second.
import type { World } from './world';
import type { Ground } from './terrain';
import type { BossDef } from './boss';
import { ENEMIES, ItemKind } from './enemies';
import { W, H } from './draw';

export interface Wave {
  at: number;
  run(w: World): void;
}

export interface Stage {
  name: string;
  /** Scroll distance at which the boss is called in. */
  length: number;
  waves: Wave[];
  ground: Ground;
  boss: BossDef;
  /** Music key, in semitones from A minor. */
  key: number;
}

type Run = (w: World) => void;
const { fighter, gunship, carrier, tank, bunker, interceptor, bomber, artillery, destroyer, drone } = ENEMIES;

/** n fighters diving one after another down column x. */
export const dive = (x: number, n = 5, gap = 12): Run => (w) => {
  for (let k = 0; k < n; k++) w.after(k * gap, () => w.spawn(fighter, x, -12, [0, 0, k * 4]));
};

/** A line of fighters sweeping in from one side at height y. */
export const sweep = (fromLeft: boolean, y: number, n = 6): Run => (w) => {
  for (let k = 0; k < n; k++) w.after(k * 10, () => w.spawn(fighter, fromLeft ? -12 : W + 12, y, [1, y, k * 3]));
};

/** A V of fighters that dive to row `turn` and climb away again. */
export const swoop = (cx: number, turn: number): Run => (w) => {
  const offs = [0, -18, 18, -36, 36];
  offs.forEach((dx, k) => w.after(k * 6, () => w.spawn(fighter, cx + dx, -12, [2, turn, k * 5])));
};

export const gun = (x: number, row = 70, drop?: ItemKind): Run => (w) => void w.spawn(gunship, x, -30, [row], drop);
export const cargo = (x: number, drop: ItemKind = 'weapon'): Run => (w) => void w.spawn(carrier, x, -20, [], drop);

/** Tanks rolling in a column from the top, or across from a side when vx is set. */
export const tanks = (x: number, n: number, vx = 0, vy = 0.3, y = -14): Run => (w) => {
  for (let k = 0; k < n; k++) w.after(k * 30, () => w.spawn(tank, x, y, [vx, vy]));
};

/** A bunker with a medal in it. */
export const pillbox = (x: number, medal = true): Run => (w) => void w.spawn(bunker, x, -16, [], medal ? 'medal' : undefined);

/** An artillery gun with a medal in it. */
export const battery = (x: number, medal = true): Run => (w) => void w.spawn(artillery, x, -16, [], medal ? 'medal' : undefined);

/**
 * n interceptors up from behind, one after another, turning at row `turn`. They come up the side
 * away from the player, so they never appear underneath the ship.
 */
export const scramble = (n = 3, turn = 70): Run => (w) => {
  const x = w.player.x < W / 2 ? W - 36 : 36;
  for (let k = 0; k < n; k++) w.after(k * 14, () => w.spawn(interceptor, x + (x < W / 2 ? k : -k) * 14, H + 14, [0, turn + k * 12]));
};

export const heavy = (x: number, drop?: ItemKind): Run => (w) => void w.spawn(bomber, x, -36, [], drop);

/** A ring of n drones that flies in around (cx, top), circles, then breaks off one by one. */
export const swarm = (cx: number, n = 8, radius = 30): Run => (w) => {
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2;
    w.spawn(drone, cx + Math.cos(a) * radius, -40 + Math.sin(a) * radius, [cx, -40, a, radius, 170 + k * 10]);
  }
};

/** A destroyer coming down column x, sailing up at `speed` (so slower than the ground) and drifting by vx. */
export const ship = (x: number, speed = 0.25, vx = 0): Run => (w) => void w.spawn(destroyer, x, -34, [speed, vx]);

export const both = (...fns: Run[]): Run => (w) => fns.forEach((f) => f(w));
