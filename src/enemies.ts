// Enemy types: hit points, score, sprite and how each one moves and shoots.
import type { World } from './world';
import { aimed, aimAt, fan, ring } from './bullets';
import { W, H } from './draw';

export type ItemKind = 'weapon' | 'missile' | 'bomb' | 'medal';

export interface Enemy {
  def: EnemyDef;
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  /** Frames alive. */
  t: number;
  /** Frames left of the white hit flash. */
  flash: number;
  dead: boolean;
  /** Turret aim, 0 = straight down. */
  aim: number;
  /** Behaviour parameters, per type. */
  p: number[];
  drop?: ItemKind;
  /** Hit radius, when not the type's own. */
  r?: number;
  /** Shots bounce off (boss armour). */
  armored?: boolean;
  /** Has been on screen, so leaving it means it's gone. */
  seen: boolean;
}

export interface EnemyDef {
  name: string;
  sprite: string;
  hp: number;
  score: number;
  /** Hit radius. */
  r: number;
  /** On the ground: scrolls with the terrain, can't ram the player, leaves a wreck. */
  ground: boolean;
  /** Big ones get a big explosion. */
  big?: boolean;
  update(e: Enemy, w: World): void;
}

const loopShots = (w: World) => (w.loop > 1 ? 1 : 0);

/**
 * Small fighter. p[0] picks the flight path:
 * 0 dive straight down, curving toward the player; 1 sweep across from the side (p[1] = row);
 * 2 swoop: dive to p[1], turn and climb away.
 */
const fighter: EnemyDef = {
  name: 'fighter',
  sprite: 'enemies/fighter',
  hp: 2,
  score: 100,
  r: 9,
  ground: false,
  update(e, w) {
    const [path, row] = e.p;
    if (path === 0) {
      if (e.t === 0) e.vy = 2.4;
      if (e.y > 70 && e.y < 200) e.vx += Math.sign(w.player.x - e.x) * 0.05;
      e.vx = Math.max(-1.6, Math.min(1.6, e.vx));
    } else if (path === 1) {
      if (e.t === 0) e.vx = e.x < W / 2 ? 2.2 : -2.2;
      e.vy = Math.cos(e.t / 14) * 0.9 + (row - e.y) * 0.02;
    } else {
      if (e.t === 0) e.vy = 3.2;
      if (e.y > row || e.vy < 3) e.vy -= 0.1;
      e.vy = Math.max(-3.2, e.vy);
      e.vx += Math.sign(W / 2 - e.x) * 0.03 * (e.vy < 0 ? 1 : 0);
    }
    if (e.t === 36 + (e.p[2] ?? 0)) aimed(w, e.x, e.y, 1 + loopShots(w) * 2, 0.25, 2.2);
  },
};

/** Heavy gunship: flies in to row p[0], hovers firing spreads, then lumbers off the bottom. */
const gunship: EnemyDef = {
  name: 'gunship',
  sprite: 'enemies/gunship',
  hp: 45,
  score: 2000,
  r: 20,
  ground: false,
  big: true,
  update(e, w) {
    const row = e.p[0] ?? 70;
    if (e.t < 400) e.vy = Math.max(0, (row - e.y) * 0.04);
    else e.vy = Math.min(0.9, e.vy + 0.01);
    e.vx = Math.sin(e.t / 60) * 0.5;
    if (e.y < 10 || e.t > 520) return;
    if (e.t % 80 === 40) aimed(w, e.x, e.y + 14, 5 + loopShots(w) * 2, 0.22, 2.0);
    if (e.t % 80 === 0) {
      fan(w, e.x - 12, e.y + 10, 0, 3, 0.35, 1.6, true);
      fan(w, e.x + 12, e.y + 10, 0, 3, 0.35, 1.6, true);
    }
  },
};

/** Power-up carrier: drifts down slowly and drops its cargo when shot down. */
const carrier: EnemyDef = {
  name: 'carrier',
  sprite: 'enemies/carrier',
  hp: 12,
  score: 500,
  r: 12,
  ground: false,
  update(e) {
    e.vy = e.t < 60 ? 1.2 : 0.55;
    e.vx = Math.sin(e.t / 40) * 0.6;
  },
};

/** Tank: rolls along the ground in direction (p[0], p[1]) and aims its turret at the player. */
const tank: EnemyDef = {
  name: 'tank',
  sprite: 'enemies/tank',
  hp: 7,
  score: 300,
  r: 9,
  ground: true,
  update(e, w) {
    e.vx = e.p[0] ?? 0;
    e.vy = w.scroll + (e.p[1] ?? 0);
    turn(e, aimAt(w, e.x, e.y), 0.05);
    const period = w.loop > 1 ? 70 : 100;
    if (e.t % period === period - 1 && e.y > 16) fan(w, e.x, e.y, e.aim, 1 + loopShots(w), 0.2, 1.8);
  },
};

/** Bunker: a fixed gun emplacement. Aimed bursts, and on later loops rings. */
const bunker: EnemyDef = {
  name: 'bunker',
  sprite: 'enemies/bunker',
  hp: 18,
  score: 1000,
  r: 13,
  ground: true,
  update(e, w) {
    e.vx = 0;
    e.vy = w.scroll;
    turn(e, aimAt(w, e.x, e.y), 0.04);
    if (e.y < 20) return;
    const k = e.t % 120;
    if (k === 60 || k === 70 || k === 80) fan(w, e.x, e.y, e.aim, 1, 0, 2.4);
    if (w.loop > 1 && k === 110) ring(w, e.x, e.y, 10, 1.4, e.t / 50);
  },
};

/** A piece of the boss: positioned by the boss, never moves by itself. */
const part: EnemyDef = {
  name: 'part',
  sprite: '',
  hp: 1,
  score: 5000,
  r: 12,
  ground: false,
  big: true,
  update() {},
};

/** Turns the turret toward `want` by at most `rate` radians. */
function turn(e: Enemy, want: number, rate: number) {
  let d = want - e.aim;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  e.aim += Math.max(-rate, Math.min(rate, d));
}

export const ENEMIES = { fighter, gunship, carrier, tank, bunker, part };
export type EnemyName = keyof typeof ENEMIES;

export function makeEnemy(def: EnemyDef, x: number, y: number, p: number[] = []): Enemy {
  return { def, x, y, vx: 0, vy: 0, hp: def.hp, t: 0, flash: 0, dead: false, aim: 0, p, seen: false };
}

/** Off screen for good: it has been seen and has left, or it never arrived. */
export function gone(e: Enemy) {
  const m = 40;
  const out = e.x < -m || e.x > W + m || e.y < -m - 40 || e.y > H + m;
  return (e.seen && out) || e.t > 60 * 30;
}
