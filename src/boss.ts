// Stage bosses. Every boss has the same three acts: phase 1 its gun pods, phase 2 the opened
// core, phase 3 the core in a rage below half health. A BossDef gives the layout and the patterns.
import type { World } from './world';
import { ENEMIES, Enemy } from './enemies';
import { aimed, aimAt, fan, ring, shoot, canFire, lob, flame, needle, needles, frost, bomb } from './bullets';
import { sfx } from './audio';
import { W, H } from './draw';
import { spr } from './sprites';

export interface BossDef {
  /** Shown on the warning card. */
  name: string;
  sprite: string;
  /** The same picture with the core hatch open. */
  openSprite: string;
  /** Sits on the ground: no shadow, can't be rammed. */
  ground: boolean;
  /** Gun pod centres relative to the boss centre. */
  pods: [number, number][];
  /** Pods carry a gun barrel drawn in code that tracks the player: all of them, or these indices. */
  turrets: boolean | number[];
  /** Extra per-frame offset of pod i, for parts that move (a walker's legs). */
  podOffset?(b: Boss, i: number): [number, number];
  /** Parts of the sprite (from y down, in sprite pixels) that move with a pod's offset. */
  limbs?: Limb[];
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

export interface Limb {
  x: number;
  y: number;
  w: number;
  h: number;
  pod: number;
}

export class Boss {
  x = W / 2;
  y: number;
  t = 0;
  phase: 0 | 1 | 2 | 3 = 0;
  /** Frames since death, or -1 while alive. */
  dying = -1;
  pods: Enemy[];
  core: Enemy;
  body: Enemy;
  spin = 0;
  /** Special attacks, for the bosses that have them. A beam aims for BEAM_AIM frames, then fires. */
  beam: { t: number; ang: number; twin?: boolean } | null = null;
  /** Mortar shells on their way down: where they land, and frames since launch. */
  marks: { x: number; y: number; t: number }[] = [];
  /** A searchlight's heading (0 straight down), or null when off. */
  light: number | null = null;
  /** Frames the player has been in the searchlight. */
  spotted = 0;
  /** A big attack charging up: frames charged, and the core's health when it began. */
  charge: { t: number; hp: number } | null = null;
  /** Frames left of the all-out beam that follows a full charge. */
  mega = 0;
  /** Frames left stunned after its charge was broken: it holds fire. */
  stun = 0;
  /** Full health of one pod, and of the core: tougher every loop. */
  podMax: number;
  coreMax: number;

  constructor(w: World, readonly def: BossDef) {
    // Starts just above the screen, however tall it is.
    this.y = -spr(def.sprite).height / 2 - 8;
    const part = def.ground ? ENEMIES.groundPart : ENEMIES.part;
    const tough = (1 + 0.3 * (w.loop - 1)) * w.toughness;
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
    // Shots bounce off the guns until it has come in and the fight starts.
    this.pods.forEach((e) => (e.armored = true));
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
    const [ox, oy] = this.def.podOffset?.(this, i) ?? [0, 0];
    return [this.x + dx + ox, this.y + dy + oy];
  }

  /** Pod i has a gun barrel. */
  hasGun(i: number) {
    const t = this.def.turrets;
    return t === true || (Array.isArray(t) && t.includes(i));
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
        this.pods.forEach((e) => (e.armored = false));
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
  name: 'SKY FORTRESS',
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
    // Escort fighters launch in pairs off the rear deck and swoop down at you.
    const escorts = (every: number) => {
      if (b.t % every !== every - 1 || !w.player.alive) return;
      for (const side of [-1, 1]) {
        const e = w.spawn(ENEMIES.fighter, b.x + side * 20, b.y - 30, [2, 190 + side * 10, 20]);
        e.seen = true;
      }
    };
    if (b.phase === 1) {
      b.x = W / 2 + Math.sin(b.t / 90) * 34;
      b.pods.forEach((pod, i) => {
        if (pod.dead) return;
        const side = i ? 1 : -1;
        const k = (b.t + (side > 0 ? 40 : 0)) % 100;
        if (k === 0) aimed(w, pod.x, pod.y + 10, 3, 0.2, 2.2);
        if (b.t % 200 === 120 + (side > 0 ? 30 : 0)) fan(w, pod.x, pod.y + 10, side * -0.2, 5, 0.26, 1.5, true);
      });
      escorts(260);
    } else if (b.phase === 2) {
      // The bomb bay opens: rows of bombs fall and burst into crosses. Stand between them.
      b.x += (W / 2 - b.x) * 0.02;
      if (b.t % 100 === 40) for (let k = -2; k <= 2; k++) bomb(w, c.x + k * 22, c.y + 14, 30 + Math.abs(k) * 6 + Math.floor(w.rng() * 20));
      if (b.t % 100 === 90) aimed(w, b.x, b.y + 20, 3, 0.12, 2.6, true);
    } else {
      b.x = W / 2 + Math.sin(b.t / 50) * 60;
      if (b.t % 5 === 0 && canFire(w, b.x, b.y)) {
        b.spin += 0.27;
        for (let k = 0; k < 3; k++) shoot(w, c.x, c.y, b.spin + (k * Math.PI * 2) / 3, 1.5);
        sfx.enemyShot();
      }
      if (b.t % 90 === 45) aimed(w, b.x, b.y + 20, 3, 0.2, 2.4, true);
      escorts(220);
    }
  },
};

// ---------- stage 2: the desert crawler ----------

export const CRAWLER: BossDef = {
  name: 'DESERT CRAWLER',
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
    // It grinds back and forth on its tracks; once open it turns to follow you, faster in a rage.
    if (b.phase === 1) b.x = W / 2 + Math.sin(b.t / 140) * 22;
    else b.x += Math.max(-1, Math.min(1, (w.player.x - b.x) * 0.01)) * (b.phase === 3 ? 0.7 : 0.35);
    b.x = Math.max(W / 2 - 60, Math.min(W / 2 + 60, b.x));
    b.y = 90 + Math.sin(b.t / 70) * 8;
    if (b.phase === 1) {
      // Front turrets throw needles that lock on; rear turrets fire plain pairs.
      b.pods.forEach((pod, i) => {
        if (pod.dead) return;
        const gx = pod.x + Math.sin(pod.aim) * 10, gy = pod.y + Math.cos(pod.aim) * 10;
        if (i < 2 && (b.t + i * 55) % 110 === 0) needles(w, gx, gy, pod.aim, 3, 0.35, 1.6, 30, 3.2);
        if (i >= 2 && (b.t + i * 23) % 92 === 0) fan(w, gx, gy, pod.aim, 2, 0.14, 2.0);
      });
      // Now and then a curtain of needles thrown wide across the screen, all turning on you at once.
      if (b.t % 300 === 240) needles(w, c.x, c.y + 10, 0, 9, 0.28, 4.5, 44, 3.0);
    } else if (b.phase === 2) {
      // A ring of needles that hangs round the hull, then bursts outward; between them, a trio that locks on.
      if (b.t % 90 === 0) needles(w, c.x, c.y, b.t / 50, 12 + w.loop * 2, (Math.PI * 2) / (12 + w.loop * 2), 3, 34, 2.4, false);
      if (b.t % 90 === 50) needles(w, c.x, c.y + 10, aimAt(w, c.x, c.y), 3, 0.3, 1.4, 26, 3.2);
    } else {
      // A spiral of needles that freeze in place and then fly on, and a fan of locks every so often.
      if (b.t % 8 === 0 && canFire(w, c.x, c.y)) {
        b.spin += 0.5;
        needle(w, c.x, c.y, b.spin, 2, 26, 2.2, false);
        needle(w, c.x, c.y, b.spin + Math.PI, 2, 26, 2.2, false);
      }
      if (b.t % 120 === 60) needles(w, c.x, c.y + 10, aimAt(w, c.x, c.y), 5, 0.3, 1.6, 30, 3.0);
    }
  },
};

// ---------- stage 3: the battleship ----------

export const BATTLESHIP: BossDef = {
  name: 'FROST BATTLESHIP',
  sprite: 'boss/boss3',
  openSprite: 'boss/boss3_open',
  ground: true,
  pods: [
    [0, 57],
    [0, 30],
    [0, -38],
    [0, -65],
  ],
  turrets: true,
  podHp: 95,
  coreHp: 720,
  coreY: -5,
  bodyY: -52,
  bodyR: 26,
  hoverY: 98,
  act(b, w) {
    const c = b.core;
    b.x = W / 2 + Math.sin(b.t / 160) * 18;
    // Once open it steams forward toward you and back again.
    const toY = b.phase === 1 ? 98 : 98 + (1 - Math.cos(b.t / 110)) * 22;
    b.y += (toY - b.y) * 0.05;
    if (b.phase === 1) {
      b.pods.forEach((pod, i) => {
        if (pod.dead) return;
        // The bow gun sends a snake of frost shards slithering after you.
        if (i === 0 && b.t % 170 === 80) {
          const a = pod.aim;
          for (let k = 0; k < 6; k++) w.after(k * 6, () => !pod.dead && frost(w, pod.x, pod.y + 10, a, 1.9, 0.45));
        } else if (i > 0 && (b.t + i * 27) % 110 === 0) fan(w, pod.x + Math.sin(pod.aim) * 10, pod.y + Math.cos(pod.aim) * 10, pod.aim, 3, 0.12, 2.0);
      });
      // Broadsides of frost from both beams, snaking out to the sides.
      if (b.t % 260 === 200)
        for (let k = 0; k < 5; k++) {
          frost(w, b.x - 20, b.y + (k - 2) * 12, 0.9, 1.5, 0.35, k * 0.4);
          frost(w, b.x + 20, b.y + (k - 2) * 12, -0.9, 1.5, 0.35, k * 0.4);
        }
    } else if (b.phase === 2) {
      // A curtain of frost straight down across the beam, swaying together; aimed shots between.
      if (b.t % 64 === 0) for (let k = -3; k <= 3; k++) frost(w, c.x + k * 18, c.y + 10, 0, 1.4, 0.4);
      if (b.t % 64 === 32) aimed(w, c.x, c.y + 12, 3, 0.16, 2.2);
    } else {
      // A snowflake: six arms of frost, each burst turned a little further, and aimed shells.
      if (b.t % 22 === 0) {
        b.spin += 0.19;
        for (let k = 0; k < 6; k++) frost(w, c.x, c.y, b.spin + (k * Math.PI) / 3, 1.3, 0.3);
      }
      if (b.t % 70 === 35) aimed(w, c.x, c.y + 12, 1, 0, 2.6, true);
    }
  },
};

// ---------- stage 4: the walker ----------

/** The walker's stride: a leg's swing, 0..2π. Leg 0 and leg 1 are half a stride apart. */
const stride = (b: Boss, leg: number) => b.t / 30 + leg * Math.PI;

export const WALKER: BossDef = {
  name: 'GIANT WALKER',
  sprite: 'boss/boss4',
  openSprite: 'boss/boss4_open',
  ground: true,
  // Shoulder cannons, then the legs.
  pods: [
    [-42, -22],
    [42, -22],
    [-22, 12],
    [21, 12],
  ],
  turrets: [0, 1],
  podOffset: (b, i) => (i < 2 ? [0, 0] : [0, Math.round(Math.sin(stride(b, i - 2)) * 4)]),
  limbs: [
    { x: 30, y: 78, w: 26, h: 42, pod: 2 },
    { x: 72, y: 78, w: 28, h: 42, pod: 3 },
  ],
  podHp: 110,
  coreHp: 720,
  coreY: -16,
  bodyY: -40,
  bodyR: 20,
  hoverY: 92,
  act(b, w) {
    const c = b.core;
    // With both legs shot away it sinks to its knees and stops walking.
    const kneel = b.pods[2].dead && b.pods[3].dead;
    if (kneel) b.y += (104 - b.y) * 0.05;
    else {
      b.x = W / 2 + Math.sin(b.t / 200) * 20;
      b.y = 92 + Math.abs(Math.sin(b.t / 30)) * 2;
      // Each time a foot comes down the ground shakes, and a live leg sends out a ring.
      for (const leg of [0, 1]) {
        const now = Math.sin(stride(b, leg)), before = Math.sin(stride(b, leg) - 1 / 30);
        if (!(before > 0 && now <= 0)) continue;
        const pod = b.pods[2 + leg];
        w.shake = Math.max(w.shake, pod.dead ? 2 : 5);
        if (!pod.dead && b.phase === 1) ring(w, pod.x, pod.y + 8, 8 + w.loop * 2, 1.1, b.t / 20, true);
      }
    }
    if (b.phase === 1) {
      // A searchlight on its head sweeps the street. Caught in it, the cannons open up.
      b.light = Math.sin(b.t / 75) * 0.75;
      const [hx, hy] = walkerHead(b);
      const lit = w.player.alive && w.player.y > hy && Math.abs(aimAt(w, hx, hy) - b.light) < LIGHT_SPREAD;
      b.spotted = lit ? b.spotted + 1 : Math.max(0, b.spotted - 2);
      if (b.spotted === SPOTTED) sfx.spotted();
      [0, 1].forEach((i) => {
        const pod = b.pods[i];
        if (pod.dead) return;
        const gx = pod.x + Math.sin(pod.aim) * 10, gy = pod.y + Math.cos(pod.aim) * 10;
        if (b.spotted >= SPOTTED) {
          if ((b.t + i * 6) % 12 === 0) aimed(w, gx, gy, 1, 0, 2.8);
        } else if ((b.t + i * 60) % 120 === 0) fan(w, gx, gy, pod.aim, 3, 0.2, 1.9);
      });
      return;
    }
    b.light = null;
    // From here on the core charges a beam: it aims, then fires and swings slowly after you.
    const period = b.phase === 2 ? 200 : 170;
    if (b.t % period === 40) b.beam = { t: 0, ang: aimAt(w, c.x, c.y + 8) };
    if (b.beam) {
      const beam = b.beam;
      const want = aimAt(w, c.x, c.y + 8);
      // It tracks you while it aims, locks when the line turns white, and swings slowly once it burns.
      const turn = beam.t < BEAM_AIM - BEAM_LOCK ? 0.03 : beam.t < BEAM_AIM ? 0 : 0.0045;
      beam.ang += Math.max(-turn, Math.min(turn, want - beam.ang));
      if (beam.t === BEAM_AIM) sfx.beam();
      if (beam.t >= BEAM_AIM) {
        w.shake = Math.max(w.shake, 2);
        if (beamHits(w, c.x, c.y + 8, beam.ang)) w.hurt();
      }
      if (++beam.t >= BEAM_AIM + BEAM_FIRE) b.beam = null;
    }
    if (b.phase === 2) {
      // Between beams, a stream of shots hosed side to side.
      if (!b.beam && b.t % 7 === 0) shoot(w, c.x, c.y + 8, Math.sin(b.t / 40) * 0.9, 2.2);
      if (b.t % 120 === 60) ring(w, c.x, c.y, 12 + w.loop * 2, 1.3, b.t / 30);
    } else {
      // In a rage it also calls down mortars: a marker where each shell will land, then the blast.
      if (b.t % 40 === 20 && w.player.alive) {
        const x = Math.max(16, Math.min(W - 16, w.player.x + (w.rng() - 0.5) * 70));
        const y = Math.max(140, Math.min(H - 30, w.player.y + (w.rng() - 0.5) * 50));
        b.marks.push({ x, y, t: 0 });
        sfx.mortar();
      }
    }
    for (const m of b.marks) {
      if (++m.t < MORTAR_FUSE) continue;
      w.blast(m.x, m.y, false, true);
      w.debris(m.x, m.y, 8, '#8a7050');
      if (Math.hypot(w.player.x - m.x, w.player.y - m.y) < MORTAR_R) w.hurt();
    }
    b.marks = b.marks.filter((m) => m.t < MORTAR_FUSE);
  },
};

/** Searchlight: the cone's half-width, and how many frames in it before the cannons open up. */
export const LIGHT_SPREAD = 0.17;
const SPOTTED = 12;
/** Beam: frames aiming, frames firing, and how wide it hurts. */
export const BEAM_AIM = 55;
/** Frames before firing that the aim locks (the line turns white). */
export const BEAM_LOCK = 15;
const BEAM_FIRE = 55;
const BEAM_HALF = 5;
/** Mortar: frames from the marker to the blast, and the blast's reach. */
export const MORTAR_FUSE = 70;
export const MORTAR_R = 16;

/** Where the walker's searchlight sits. */
export const walkerHead = (b: Boss): [number, number] => [b.x, b.y - 24];

function beamHits(w: World, x: number, y: number, ang: number) {
  const dx = w.player.x - x, dy = w.player.y - y;
  const along = dx * Math.sin(ang) + dy * Math.cos(ang);
  return along > 0 && Math.abs(dx * Math.cos(ang) - dy * Math.sin(ang)) < BEAM_HALF;
}

// ---------- stage 5: the crater fortress ----------

export const CRATER: BossDef = {
  name: 'CRATER FORTRESS',
  sprite: 'boss/boss5',
  openSprite: 'boss/boss5_open',
  ground: true,
  // Flame cannons on the flanks, then the missile racks.
  pods: [
    [-45, -12],
    [45, -12],
    [-32, 33],
    [32, 33],
  ],
  turrets: [0, 1],
  podHp: 100,
  coreHp: 520,
  coreY: -6,
  bodyY: -42,
  bodyR: 20,
  hoverY: 96,
  act(b, w) {
    const c = b.core;
    b.x = W / 2 + Math.sin(b.t / 240) * 12;
    if (b.phase === 1) {
      // The flame cannons spray in bursts; they reach only so far, so keep your distance.
      [0, 1].forEach((i) => {
        const pod = b.pods[i];
        const k = (b.t + i * 75) % 150;
        if (!pod.dead && k < 45 && k % 4 === 0) flame(w, pod.x + Math.sin(pod.aim) * 12, pod.y + Math.cos(pod.aim) * 12, pod.aim);
        if (!pod.dead && k === 60) aimed(w, pod.x, pod.y, 3, 0.22, 2.0);
      });
      // The racks launch homing rockets in turn.
      [2, 3].forEach((i) => {
        const pod = b.pods[i];
        if (pod.dead || (b.t + (i - 2) * 90) % 180 !== 0 || !w.player.alive) return;
        const r = w.spawn(ENEMIES.rocket, pod.x, pod.y + 10, []);
        r.aim = aimAt(w, pod.x, pod.y);
        r.seen = true;
      });
    } else if (b.phase === 2) {
      // Lava bombs that burst into rings, between aimed shots.
      if (b.t % 70 === 0) lob(w, c.x, c.y + 10, aimAt(w, c.x, c.y) + (w.rng() - 0.5) * 0.6, 1.7, 46);
      if (b.t % 70 === 35) aimed(w, c.x, c.y + 10, 3, 0.16, 2.4);
    } else {
      if (b.t % 6 === 0 && canFire(w, c.x, c.y)) {
        b.spin += 0.31;
        shoot(w, c.x, c.y, b.spin, 1.6);
        shoot(w, c.x, c.y, b.spin + Math.PI, 1.6);
      }
      if (b.t % 55 === 0) lob(w, c.x, c.y + 10, aimAt(w, c.x, c.y), 1.9, 38);
    }
  },
};

// ---------- stage 6: the mothership ----------

/** Charging: frames to a full charge, and the damage to the core (of its full health) that breaks it. */
export const CHARGE_FRAMES = 170;
const CHARGE_BREAK = 0.07;
const MEGA_FRAMES = 80;

export const MOTHERSHIP: BossDef = {
  name: 'MOTHERSHIP',
  sprite: 'boss/boss6',
  openSprite: 'boss/boss6_open',
  // In space nothing casts a shadow; it can't be rammed either.
  ground: true,
  // Rear batteries, then front batteries.
  pods: [
    [-62, -20],
    [62, -20],
    [-40, 24],
    [40, 24],
  ],
  turrets: true,
  podHp: 130,
  coreHp: 900,
  coreY: -6,
  bodyY: -40,
  bodyR: 30,
  hoverY: 86,
  act(b, w) {
    const c = b.core;
    b.x = W / 2 + Math.sin(b.t / 130) * 26;
    if (b.phase === 1) {
      // Every battery has its own weapon: lobbed bombs, big spreads, locking needles, frost snakes.
      const [rl, rr, fl, fr] = b.pods;
      const gun = (pod: Enemy): [number, number] => [pod.x + Math.sin(pod.aim) * 10, pod.y + Math.cos(pod.aim) * 10];
      if (!rl.dead && b.t % 160 === 40) lob(w, ...gun(rl), rl.aim, 1.6, 50);
      if (!rr.dead && b.t % 140 === 110) fan(w, ...gun(rr), rr.aim, 5, 0.2, 1.8, true);
      if (!fl.dead && b.t % 120 === 0) needles(w, ...gun(fl), fl.aim, 3, 0.3, 1.6, 28, 3.2);
      if (!fr.dead && b.t % 150 === 75) {
        const a = fr.aim;
        for (let k = 0; k < 5; k++) w.after(k * 6, () => !fr.dead && frost(w, fr.x, fr.y + 10, a, 1.9, 0.45));
      }
      // And it launches raiders from its flanks.
      if (b.t % 300 === 299 && w.player.alive)
        for (const side of [-1, 1]) w.spawn(ENEMIES.raider, b.x + side * 70, b.y, [2, 200, 15]).seen = true;
    } else if (b.phase === 2) {
      // Twin beams that close like scissors toward the middle, then open again: under it is safe, until
      // the aimed shots come. Between the cuts, rings of frost.
      const k = b.t % 240;
      if (k === 20) b.beam = { t: 0, ang: SCISSOR_OPEN, twin: true };
      if (b.beam) {
        const beam = b.beam;
        if (beam.t >= BEAM_AIM) {
          const f = (beam.t - BEAM_AIM) / SCISSOR_FRAMES;
          beam.ang = SCISSOR_OPEN - (SCISSOR_OPEN - SCISSOR_SHUT) * Math.sin(Math.PI * f);
          if (beam.t === BEAM_AIM) sfx.beam();
          w.shake = Math.max(w.shake, 2);
          if (beamHits(w, c.x, c.y + 8, beam.ang) || beamHits(w, c.x, c.y + 8, -beam.ang)) w.hurt();
        }
        if (++beam.t >= BEAM_AIM + SCISSOR_FRAMES) b.beam = null;
        if (beam.t > BEAM_AIM && beam.t % 40 === 0) aimed(w, c.x, c.y + 10, 1, 0, 2.2);
      } else if (b.t % 30 === 0) {
        b.spin += 0.23;
        for (let k = 0; k < 6; k++) frost(w, c.x, c.y, b.spin + (k * Math.PI) / 3, 1.3, 0.3);
      }
    } else {
      // Last stand: it charges an all-out beam. Hurt the core enough while it charges to break it,
      // or have a bomb ready.
      b.beam = null;
      if (b.stun > 0) {
        b.stun--;
        return;
      }
      if (b.mega > 0) {
        if (--b.mega % 4 === 0) w.shake = Math.max(w.shake, 6);
        w.hurt();
        return;
      }
      if (b.charge) {
        const ch = b.charge;
        if (c.hp < ch.hp - b.coreMax * CHARGE_BREAK) {
          b.charge = null;
          b.stun = 100;
          w.blast(c.x, c.y, true, true);
          w.popup(c.x, c.y + 24, 'BROKEN');
          w.addScore(20000);
          return;
        }
        if (++ch.t % 30 === 0) sfx.warning();
        if (ch.t >= CHARGE_FRAMES) {
          b.charge = null;
          b.mega = MEGA_FRAMES;
          w.whiteout = 8;
          sfx.beam();
        }
        return;
      }
      if (b.t % 420 === 260) {
        b.charge = { t: 0, hp: c.hp };
        w.bullets = w.bullets.filter((x) => x.y > c.y + 60);
        return;
      }
      // Between charges: a spiral of needles and frost, turning both ways.
      if (b.t % 9 === 0 && canFire(w, c.x, c.y)) {
        b.spin += 0.37;
        needle(w, c.x, c.y, b.spin, 2, 24, 2.3, false);
        frost(w, c.x, c.y, -b.spin + Math.PI, 1.4, 0.35);
      }
      if (b.t % 80 === 40) aimed(w, c.x, c.y + 10, 5, 0.16, 2.4, true);
    }
  },
};

/** The scissor beams: how wide they start, how close they close, and for how long they burn. */
const SCISSOR_OPEN = 1.0;
const SCISSOR_SHUT = 0.16;
const SCISSOR_FRAMES = 130;
