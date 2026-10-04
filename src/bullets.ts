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
  /** A flame: gone at this age. */
  life?: number;
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
  if (!canFire(w, x, y)) return;
  shoot(w, x, y, ang, speed, true);
  w.bullets[w.bullets.length - 1].burst = fuse;
  sfx.enemyShot();
}

/** A spurt of flame toward `ang`: fast, spread out, and burnt out after a short way. */
export function flame(w: World, x: number, y: number, ang: number) {
  if (!canFire(w, x, y)) return;
  for (let k = 0; k < 3; k++) {
    shoot(w, x, y, ang + (w.rng() - 0.5) * 0.5, 2.4 + w.rng() * 0.8);
    w.bullets[w.bullets.length - 1].life = 34 + Math.floor(w.rng() * 10);
  }
}
