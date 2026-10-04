// The stage boss: a flying fortress. Phase 1 its two cannon pods, phase 2 the opened core,
// phase 3 the core in a rage, spiralling.
import type { World } from './world';
import { ENEMIES, Enemy } from './enemies';
import { aimed, fan, ring, shoot, canFire } from './bullets';
import { sfx } from './audio';
import { W } from './draw';

/** Pod and core offsets from the boss centre, matching the sprite. */
export const POD_X = 38;
export const POD_Y = 18;
export const CORE_Y = 2;
const CANNON_HP = 160;
const CORE_HP = 600;
const HOVER_Y = 74;

export class Boss {
  x = W / 2;
  y = -60;
  t = 0;
  phase: 0 | 1 | 2 | 3 = 0;
  /** Frames since death, or -1 while alive. */
  dying = -1;
  pods: Enemy[];
  core: Enemy;
  body: Enemy;
  private spin = 0;
  /** Full health of one pod, and of the core: tougher every loop. */
  podMax: number;
  coreMax: number;

  constructor(w: World) {
    const part = ENEMIES.part;
    const tough = 1 + 0.3 * (w.loop - 1);
    this.podMax = CANNON_HP * tough;
    this.coreMax = CORE_HP * tough;
    this.pods = [-1, 1].map((side) => {
      const e = w.spawn(part, this.x + side * POD_X, this.y + POD_Y, [side]);
      e.hp = this.podMax;
      e.r = 14;
      return e;
    });
    this.core = w.spawn(part, this.x, this.y + CORE_Y, [0]);
    this.core.hp = this.coreMax;
    this.core.armored = true;
    this.core.r = 14;
    // The hull: soaks up shots, never breaks.
    this.body = w.spawn(part, this.x, this.y - 8, [9]);
    this.body.armored = true;
    this.body.hp = Infinity;
    this.body.r = 36;
    this.parts.forEach((e) => (e.seen = true));
  }

  get parts() {
    return [...this.pods, this.core, this.body];
  }

  get open() {
    return this.phase >= 2;
  }

  update(w: World) {
    this.t++;
    if (this.dying >= 0) return this.updateDying(w);

    if (this.phase === 0) {
      this.y += (HOVER_Y - this.y) * 0.025;
      if (this.t > 180) {
        this.phase = 1;
        this.t = 0;
      }
    } else if (this.phase === 1) {
      this.x = W / 2 + Math.sin(this.t / 90) * 34;
      for (const pod of this.pods) {
        if (pod.dead) continue;
        const side = pod.p[0];
        const k = (this.t + (side > 0 ? 40 : 0)) % 100;
        if (k === 0) aimed(w, pod.x, pod.y + 10, 3, 0.2, 2.2);
        if (this.t % 200 === 120 + (side > 0 ? 30 : 0)) fan(w, pod.x, pod.y + 10, side * -0.2, 7, 0.18, 1.6, true);
      }
      if (this.pods.every((p) => p.dead)) {
        this.phase = 2;
        this.t = 0;
        this.core.armored = false;
        w.shake = 20;
        sfx.bigBoom();
      }
    } else if (this.phase === 2) {
      this.x += (W / 2 - this.x) * 0.02;
      if (this.t % 70 === 30) ring(w, this.x, this.y + CORE_Y, 14 + w.loop * 2, 1.5, this.t / 30);
      if (this.t % 70 === 0) aimed(w, this.x, this.y + 20, 3, 0.12, 2.6, true);
      if (this.core.hp < this.coreMax * 0.5) {
        this.phase = 3;
        this.t = 0;
        sfx.warning();
      }
    } else {
      this.x = W / 2 + Math.sin(this.t / 50) * 60;
      if (this.t % 5 === 0 && canFire(w, this.x, this.y)) {
        this.spin += 0.27;
        for (let k = 0; k < 3; k++) shoot(w, this.x, this.y + CORE_Y, this.spin + (k * Math.PI * 2) / 3, 1.5);
        sfx.enemyShot();
      }
      if (this.t % 90 === 45) aimed(w, this.x, this.y + 20, 5, 0.16, 2.4, true);
    }
    this.place();
  }

  private place() {
    for (const pod of this.pods) {
      pod.x = this.x + pod.p[0] * POD_X;
      pod.y = this.y + POD_Y;
    }
    this.core.x = this.x;
    this.core.y = this.y + CORE_Y;
    this.body.x = this.x;
    this.body.y = this.y - 14;
  }

  partDestroyed(w: World, e: Enemy) {
    w.blast(e.x, e.y, true, false);
    w.debris(e.x, e.y, 20, '#bcbcbc');
    w.shake = Math.max(w.shake, 16);
    if (e === this.core) {
      this.dying = 0;
      this.body.dead = true;
      w.bullets = [];
      w.addScore(50000);
      w.popup(this.x, this.y + 30, '50000');
    }
  }

  private updateDying(w: World) {
    this.dying++;
    this.y += 0.3;
    if (this.dying % 6 === 0) {
      w.blast(this.x + (w.rng() - 0.5) * 110, this.y + (w.rng() - 0.5) * 70, w.rng() < 0.4, false);
      w.shake = 6;
    }
    if (this.dying === 150) {
      for (let k = 0; k < 6; k++) w.blast(this.x + (w.rng() - 0.5) * 60, this.y + (w.rng() - 0.5) * 40, true, false);
      w.debris(this.x, this.y, 60, '#bcbcbc');
      w.whiteout = 10;
      w.shake = 40;
    }
    if (this.dying === 160) w.stageClear();
  }

  get gone() {
    return this.dying >= 150;
  }
}
