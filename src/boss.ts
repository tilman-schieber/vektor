// Stage bosses. Every boss has the same three acts: phase 1 its gun pods, phase 2 the opened
// core, phase 3 the core in a rage below half health. A BossDef gives the layout and the patterns.
import type { World } from './world';
import { ENEMIES, Enemy } from './enemies';
import { aimed, aimAt, fan, ring, shoot, canFire } from './bullets';
import { sfx } from './audio';
import { W } from './draw';

export interface BossDef {
  sprite: string;
  /** The same picture with the core hatch open. */
  openSprite: string;
  /** Sits on the ground: no shadow, can't be rammed. */
  ground: boolean;
  /** Gun pod centres relative to the boss centre. */
  pods: [number, number][];
  /** Pods carry a gun barrel drawn in code that tracks the player. */
  turrets: boolean;
  podHp: number;
  coreHp: number;
  coreY: number;
  /** The armoured hull that soaks up shots: centre y offset and radius. Keep it behind the core. */
  bodyY: number;
  bodyR: number;
  /** Where it settles after coming on screen. */
  hoverY: number;
  /** Movement and fire for one frame of phases 1-3. */
  act(b: Boss, w: World): void;
}

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
  spin = 0;
  /** Full health of one pod, and of the core: tougher every loop. */
  podMax: number;
  coreMax: number;

  constructor(w: World, readonly def: BossDef) {
    const part = def.ground ? ENEMIES.groundPart : ENEMIES.part;
    const tough = 1 + 0.3 * (w.loop - 1);
    this.podMax = def.podHp * tough;
    this.coreMax = def.coreHp * tough;
    this.pods = def.pods.map(([dx, dy], i) => {
      const e = w.spawn(part, this.x + dx, this.y + dy, [i]);
      e.hp = this.podMax;
      e.r = 14;
      return e;
    });
    this.core = w.spawn(part, this.x, this.y + def.coreY, [-1]);
    this.core.hp = this.coreMax;
    this.core.armored = true;
    this.core.r = 14;
    // The hull: soaks up shots, never breaks.
    this.body = w.spawn(part, this.x, this.y + def.bodyY, [-2]);
    this.body.armored = true;
    this.body.hp = Infinity;
    this.body.r = def.bodyR;
    this.parts.forEach((e) => (e.seen = true));
  }

  get parts() {
    return [...this.pods, this.core, this.body];
  }

  get open() {
    return this.phase >= 2;
  }

  /** Where pod i sits now. */
  podPos(i: number): [number, number] {
    const [dx, dy] = this.def.pods[i];
    return [this.x + dx, this.y + dy];
  }

  get coreX() {
    return this.x;
  }

  get coreY() {
    return this.y + this.def.coreY;
  }

  update(w: World) {
    this.t++;
    if (this.dying >= 0) return this.updateDying(w);

    if (this.phase === 0) {
      this.y += (this.def.hoverY - this.y) * 0.025;
      if (this.t > 180) {
        this.phase = 1;
        this.t = 0;
      }
    } else {
      this.def.act(this, w);
      if (this.phase === 1 && this.pods.every((p) => p.dead)) {
        this.phase = 2;
        this.t = 0;
        this.core.armored = false;
        w.shake = 20;
        sfx.bigBoom();
      } else if (this.phase === 2 && this.core.hp < this.coreMax * 0.5) {
        this.phase = 3;
        this.t = 0;
        sfx.warning();
      }
    }
    this.place(w);
  }

  private place(w: World) {
    this.pods.forEach((pod, i) => ([pod.x, pod.y] = this.podPos(i)));
    // Pods track the player with their guns.
    for (const pod of this.pods) pod.aim = aimAt(w, pod.x, pod.y);
    this.core.x = this.coreX;
    this.core.y = this.coreY;
    this.body.x = this.x;
    this.body.y = this.y + this.def.bodyY;
  }

  partDestroyed(w: World, e: Enemy) {
    w.blast(e.x, e.y, true, this.def.ground);
    w.debris(e.x, e.y, 20, this.def.ground ? '#8a7050' : '#bcbcbc');
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
    this.y += this.def.ground ? w.scroll : 0.3;
    if (this.dying % 6 === 0) {
      w.blast(this.x + (w.rng() - 0.5) * 110, this.y + (w.rng() - 0.5) * 70, w.rng() < 0.4, this.def.ground);
      w.shake = 6;
    }
    if (this.dying === 150) {
      for (let k = 0; k < 6; k++) w.blast(this.x + (w.rng() - 0.5) * 60, this.y + (w.rng() - 0.5) * 40, true, this.def.ground);
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

// ---------- stage 1: the flying fortress ----------

export const FORTRESS: BossDef = {
  sprite: 'boss/boss',
  openSprite: 'boss/boss_open',
  ground: false,
  pods: [
    [-38, 18],
    [38, 18],
  ],
  turrets: false,
  podHp: 160,
  coreHp: 600,
  coreY: 2,
  bodyY: -24,
  bodyR: 32,
  hoverY: 74,
  act(b, w) {
    const c = b.core;
    if (b.phase === 1) {
      b.x = W / 2 + Math.sin(b.t / 90) * 34;
      b.pods.forEach((pod, i) => {
        if (pod.dead) return;
        const side = i ? 1 : -1;
        const k = (b.t + (side > 0 ? 40 : 0)) % 100;
        if (k === 0) aimed(w, pod.x, pod.y + 10, 3, 0.2, 2.2);
        if (b.t % 200 === 120 + (side > 0 ? 30 : 0)) fan(w, pod.x, pod.y + 10, side * -0.2, 5, 0.26, 1.5, true);
      });
    } else if (b.phase === 2) {
      b.x += (W / 2 - b.x) * 0.02;
      if (b.t % 70 === 30) ring(w, c.x, c.y, 14 + w.loop * 2, 1.5, b.t / 30);
      if (b.t % 70 === 0) aimed(w, b.x, b.y + 20, 3, 0.12, 2.6, true);
    } else {
      b.x = W / 2 + Math.sin(b.t / 50) * 60;
      if (b.t % 5 === 0 && canFire(w, b.x, b.y)) {
        b.spin += 0.27;
        for (let k = 0; k < 3; k++) shoot(w, c.x, c.y, b.spin + (k * Math.PI * 2) / 3, 1.5);
        sfx.enemyShot();
      }
      if (b.t % 90 === 45) aimed(w, b.x, b.y + 20, 5, 0.16, 2.4, true);
    }
  },
};

// ---------- stage 2: the desert crawler ----------

export const CRAWLER: BossDef = {
  sprite: 'boss/boss2',
  openSprite: 'boss/boss2_open',
  ground: true,
  pods: [
    [-28, 20],
    [27, 20],
    [-28, -18],
    [27, -18],
  ],
  turrets: true,
  podHp: 90,
  coreHp: 640,
  coreY: -1,
  // The hull sits behind the core, so shots from below reach the core first.
  bodyY: -30,
  bodyR: 34,
  hoverY: 90,
  act(b, w) {
    const c = b.core;
    // It grinds forward and back on its tracks.
    b.x = W / 2 + Math.sin(b.t / 140) * 22;
    b.y = 90 + Math.sin(b.t / 70) * 8;
    if (b.phase === 1) {
      b.pods.forEach((pod, i) => {
        if (pod.dead) return;
        if ((b.t + i * 23) % 92 === 0) fan(w, pod.x + Math.sin(pod.aim) * 10, pod.y + Math.cos(pod.aim) * 10, pod.aim, 2, 0.14, 2.0);
      });
      if (b.t % 240 === 200) ring(w, c.x, c.y, 10 + w.loop * 2, 1.2, b.t / 40, true);
    } else if (b.phase === 2) {
      // A fan that sweeps side to side, and aimed shells.
      if (b.t % 50 === 0) fan(w, c.x, c.y + 10, Math.sin(b.t / 60) * 0.5, 5, 0.24, 1.6);
      if (b.t % 90 === 45) aimed(w, c.x, c.y + 10, 3, 0.18, 2.4, true);
    } else {
      // Two spirals turning against each other.
      if (b.t % 7 === 0 && canFire(w, c.x, c.y)) {
        b.spin += 0.21;
        for (let k = 0; k < 2; k++) {
          shoot(w, c.x, c.y, b.spin + k * Math.PI, 1.3);
          shoot(w, c.x, c.y, -b.spin + k * Math.PI + 0.5, 1.3);
        }
        sfx.enemyShot();
      }
      if (b.t % 60 === 30) aimed(w, c.x, c.y + 10, 1, 0, 2.6, true);
    }
  },
};

// ---------- stage 3: the battleship ----------

export const BATTLESHIP: BossDef = {
  sprite: 'boss/boss3',
  openSprite: 'boss/boss3_open',
  ground: true,
  pods: [
    [0, 45],
    [0, 27],
    [0, -27],
    [0, -47],
  ],
  turrets: true,
  podHp: 85,
  coreHp: 680,
  coreY: 1,
  bodyY: -40,
  bodyR: 30,
  hoverY: 104,
  act(b, w) {
    const c = b.core;
    b.x = W / 2 + Math.sin(b.t / 160) * 18;
    if (b.phase === 1) {
      b.pods.forEach((pod, i) => {
        if (pod.dead) return;
        if ((b.t + i * 27) % 110 === 0) fan(w, pod.x + Math.sin(pod.aim) * 10, pod.y + Math.cos(pod.aim) * 10, pod.aim, 3, 0.12, 2.0);
      });
      // Broadsides from both beams.
      if (b.t % 260 === 200) {
        fan(w, b.x - 20, b.y, 0.8, 5, 0.15, 1.5, true);
        fan(w, b.x + 20, b.y, -0.8, 5, 0.15, 1.5, true);
      }
    } else if (b.phase === 2) {
      if (b.t % 40 === 0) aimed(w, c.x, c.y + 12, 3, 0.16, 2.2);
      if (b.t % 90 === 60) ring(w, c.x, c.y, 16 + w.loop * 2, 1.3, b.t / 45);
    } else {
      // A flower of rings, each turned a little further.
      if (b.t % 18 === 0) {
        b.spin += 0.13;
        ring(w, c.x, c.y, 10, 1.25, b.spin);
      }
      if (b.t % 70 === 35) aimed(w, c.x, c.y + 12, 1, 0, 2.6, true);
    }
  },
};
