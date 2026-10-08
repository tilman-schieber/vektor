// Enemy bullets and the patterns that fire them.
import type { World } from './world';
import { W, H } from './draw';
import { sfx } from './audio';

export interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Hit radius; big bullets are drawn larger too. */
  r: number;
  big: boolean;
  t: number;
  dead: boolean;
  /** A lava bomb: at this age it bursts into a ring. */
  burst?: number;
  /** A dropped bomb: bursts into this many instead (a cross of 4), and is drawn as a bomb. */
  burstN?: number;
  /** An ice bomb: bursts into frost shards. */
  frosty?: boolean;
  /** A flame: gone at this age. */
  life?: number;
  /** A needle: coasts to a stop, hangs in the air until this age, then streaks off along `ang`. */
  hang?: number;
  /** Needle: its heading, 0 straight down. */
  ang?: number;
  /** Needle: the top speed it streaks off at. */
  dash?: number;
  /** A frost shard: how far (radians) its heading swings either side of `ang` as it snakes along. */
  weave?: number;
  /** Frost shard: its speed, and where in the swing it starts. */
  spd?: number;
  phase?: number;
  /** Needle: while it hangs it turns to follow the player, and goes where the player was at release. */
  track?: boolean;
}

/** Bullets aren't fired from off screen or point-blank under the player's nose. */
export function canFire(w: World, x: number, y: number) {
  return x > 4 && x < W - 4 && y > 4 && y < H - 24 && w.player.alive;
}

export function shoot(w: World, x: number, y: number, ang: number, speed: number, big = false) {
  const s = speed * w.bulletSpeed;
  w.bullets.push({ x, y, vx: Math.sin(ang) * s, vy: Math.cos(ang) * s, r: big ? 3 : 2, big, t: 0, dead: false });
}

/** Angle from (x, y) toward the player: 0 is straight down. */
export function aimAt(w: World, x: number, y: number) {
  return Math.atan2(w.player.x - x, w.player.y - y);
}

/** n bullets fanned `spread` radians apart, centred on `ang`. */
export function fan(w: World, x: number, y: number, ang: number, n: number, spread: number, speed: number, big = false) {
  if (!canFire(w, x, y)) return;
  for (let k = 0; k < n; k++) shoot(w, x, y, ang + (k - (n - 1) / 2) * spread, speed, big);
  sfx.enemyShot();
}

export const aimed = (w: World, x: number, y: number, n: number, spread: number, speed: number, big = false) =>
  fan(w, x, y, aimAt(w, x, y), n, spread, speed, big);

export function ring(w: World, x: number, y: number, n: number, speed: number, offset = 0, big = false) {
  if (!canFire(w, x, y)) return;
  for (let k = 0; k < n; k++) shoot(w, x, y, offset + (k / n) * Math.PI * 2, speed, big);
  sfx.enemyShot();
}

/** A lava bomb lobbed at angle `ang`: after `fuse` frames it bursts into a ring of n. */
export function lob(w: World, x: number, y: number, ang: number, speed: number, fuse: number) {
  if (!canFire(w, x, y)) return undefined;
  shoot(w, x, y, ang, speed, true);
  const b = w.bullets[w.bullets.length - 1];
  b.burst = fuse;
  sfx.enemyShot();
  return b;
}

/** A spurt of flame toward `ang`: fast, spread out, and burnt out after a short way. */
export function flame(w: World, x: number, y: number, ang: number) {
  if (!canFire(w, x, y)) return;
  for (let k = 0; k < 3; k++) {
    shoot(w, x, y, ang + (w.rng() - 0.5) * 0.5, 2.4 + w.rng() * 0.8);
    w.bullets[w.bullets.length - 1].life = 34 + Math.floor(w.rng() * 10);
  }
}

/**
 * A needle: thrown out at `drift` along `ang`, it coasts to a stop and hangs for `hang` frames,
 * then streaks off at up to `dash`. A tracking needle points at the player while it hangs and
 * locks on when it goes, so step aside once they fly.
 */
export function needle(w: World, x: number, y: number, ang: number, drift: number, hang: number, dash: number, track = true) {
  if (!canFire(w, x, y)) return;
  w.bullets.push({ x, y, vx: Math.sin(ang) * drift, vy: Math.cos(ang) * drift, r: 2, big: false, t: 0, dead: false, hang, ang, dash: dash * w.bulletSpeed, track });
}

/** n needles fanned `spread` apart round `ang`. */
export function needles(w: World, x: number, y: number, ang: number, n: number, spread: number, drift: number, hang: number, dash: number, track = true) {
  if (!canFire(w, x, y)) return;
  for (let k = 0; k < n; k++) needle(w, x, y, ang + (k - (n - 1) / 2) * spread, drift, hang, dash, track);
  sfx.enemyShot();
}

/** Moves a needle one frame: coast, hang and turn, then speed up. */
export function stepNeedle(w: World, b: Bullet) {
  if (b.t < b.hang!) {
    b.vx *= 0.93;
    b.vy *= 0.93;
    if (b.track) b.ang = aimAt(w, b.x, b.y);
    return;
  }
  if (b.t === b.hang) sfx.needle();
  const s = Math.min(b.dash!, Math.hypot(b.vx, b.vy) + 0.14);
  b.vx = Math.sin(b.ang!) * s;
  b.vy = Math.cos(b.ang!) * s;
}

/** A frost shard: flies along `ang` but snakes from side to side, `weave` radians each way. */
export function frost(w: World, x: number, y: number, ang: number, speed: number, weave = 0.5, phase = 0) {
  if (!canFire(w, x, y)) return;
  const spd = speed * w.bulletSpeed;
  w.bullets.push({ x, y, vx: 0, vy: 0, r: 2, big: false, t: 0, dead: false, ang, spd, weave, phase });
  stepFrost(w.bullets[w.bullets.length - 1]);
}

/** Frost shards swing through a full weave in this many frames. */
const WEAVE_PERIOD = 60;

export function stepFrost(b: Bullet) {
  const a = b.ang! + b.weave! * Math.sin(((b.t / WEAVE_PERIOD) * 2 + (b.phase ?? 0)) * Math.PI);
  b.vx = Math.sin(a) * b.spd!;
  b.vy = Math.cos(a) * b.spd!;
}

/** A bomb dropped from a bay: falls slowly, then after `fuse` frames bursts into a cross of four. */
export function bomb(w: World, x: number, y: number, fuse: number) {
  if (!canFire(w, x, y)) return;
  w.bullets.push({ x, y, vx: 0, vy: 1.1 * w.bulletSpeed, r: 3, big: true, t: 0, dead: false, burst: fuse, burstN: 4 });
}
