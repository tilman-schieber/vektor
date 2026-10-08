// The simulation: scrolling, the player, shots, enemies, bullets, items, bombs and the boss.
import { W, H } from './draw';
import { Enemy, EnemyDef, ItemKind, makeEnemy, gone } from './enemies';
import { Bullet, ring } from './bullets';
import { Boss } from './boss';
import { Terrain } from './terrain';
import { STAGES } from './stages';
import type { Stage } from './stage';
import { sfx } from './audio';
import { Rng } from './rng';

export type Weapon = 'vulcan' | 'laser';
export const MAX_LEVEL = 5;
export const MAX_MISSILES = 5;
export const MAX_BOMBS = 7;
/** Extra lives at these scores. */
export const EXTENDS = [200000, 500000];
const START_BOMBS = 3;
/** Easy mode: frames until a broken shield comes back. */
export const SHIELD_REGEN = 20 * 60;

export interface Player {
  x: number;
  y: number;
  alive: boolean;
  /** Frames until respawn while dead; frames of fly-in after. */
  timer: number;
  /** Frames of blinking invulnerability. */
  invuln: number;
  weapon: Weapon;
  level: number;
  missiles: number;
  bombs: number;
  /** -1 banking left .. 1 banking right. */
  bank: number;
  cooldown: number;
  missileCooldown: number;
  /** Easy mode: the shield is up. */
  shield: boolean;
  /** Frames until a broken shield is back, 0 when up or not in this mode. */
  shieldT: number;
}

export interface Shot {
  kind: 'vulcan' | 'laser' | 'missile';
  x: number;
  y: number;
  vx: number;
  vy: number;
  dmg: number;
  /** Lasers go through; this keeps them from hitting the same enemy twice. */
  hit?: Set<Enemy>;
  /** Laser width. */
  width?: number;
  /** Weapon level it was fired at, for how it looks. */
  level?: number;
  t: number;
  dead: boolean;
}

export interface Item {
  kind: ItemKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  t: number;
  dead: boolean;
}

export interface Blast {
  x: number;
  y: number;
  big: boolean;
  t: number;
  /** Rides on the ground. */
  ground: boolean;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

export interface Wreck {
  x: number;
  y: number;
}

export interface Popup {
  x: number;
  y: number;
  text: string;
  t: number;
}

export interface Controls {
  /** -1..1 each. */
  dx: number;
  dy: number;
  /** Pixels moved by a dragging finger since the last frame. */
  dragX: number;
  dragY: number;
  fire: boolean;
  bomb: boolean;
}

export type WorldState = 'play' | 'clear' | 'over';

const PLAYER_SPEED = 2;
const SCROLL = 0.5;
/** The weapon item swaps colour this often. */
export const ITEM_CYCLE = 150;

export class World {
  rng: Rng;
  terrain: Terrain;
  /** Distance scrolled this stage, in pixels. */
  dist = 0;
  scroll = SCROLL;
  /** Index into STAGES. */
  stageIdx = 0;
  /** How many times round all the stages, from 1. */
  loop = 1;
  /** Bullet speed multiplier: faster every stage and every loop. */
  bulletSpeed = 1;
  state: WorldState = 'play';
  stateTimer = 0;
  frame = 0;

  score = 0;
  lives: number;
  /** Lives lost this stage, for the no-miss bonus. */
  misses = 0;
  medalValue = 500;
  medals = 0;
  private extendsGiven = 0;

  player: Player;
  shots: Shot[] = [];
  enemies: Enemy[] = [];
  bullets: Bullet[] = [];
  items: Item[] = [];
  blasts: Blast[] = [];
  particles: Particle[] = [];
  wrecks: Wreck[] = [];
  popups: Popup[] = [];
  boss: Boss | null = null;
  /** Frames left of the WARNING card before the boss. */
  warning = 0;
  /** An active bomb's age in frames, or -1. */
  bombT = -1;
  bombX = 0;
  bombY = 0;
  shake = 0;
  /** Frames of white screen flash. */
  whiteout = 0;

  private waveIdx = 0;
  private later: { at: number; fn: () => void }[] = [];

  /** Easy mode: ships carry a shield. */
  readonly shielded: boolean;

  constructor(rng: Rng, lives: number, shielded = false) {
    this.rng = rng;
    this.lives = lives;
    this.shielded = shielded;
    this.terrain = new Terrain(1234, this.stage.ground);
    this.player = this.freshPlayer();
  }

  get stage(): Stage {
    return STAGES[this.stageIdx];
  }

  private get waves() {
    return this.stage.waves;
  }

  private freshPlayer(): Player {
    return {
      x: W / 2, y: H - 48, alive: true, timer: 0, invuln: 120, weapon: 'vulcan', level: 1, missiles: 0,
      bombs: START_BOMBS, bank: 0, cooldown: 0, missileCooldown: 0, shield: this.shielded, shieldT: 0,
    };
  }

  /** Runs `fn` after `frames` frames. */
  after(frames: number, fn: () => void) {
    this.later.push({ at: this.frame + frames, fn });
  }

  /** How much tougher enemies are on this stage: 12% more health per stage. */
  get toughness() {
    return 1 + 0.12 * this.stageIdx;
  }

  spawn(def: EnemyDef, x: number, y: number, p: number[] = [], drop?: ItemKind) {
    const e = makeEnemy(def, x, y, p);
    // One-hit enemies stay one-hit.
    if (def.hp > 1) e.hp = def.hp * this.toughness;
    e.drop = drop;
    this.enemies.push(e);
    return e;
  }

  /** On to the next stage; after the last, round again from the first, faster. The player keeps everything. */
  nextStage() {
    this.goTo(this.stageIdx + 1);
  }

  /** Starts stage i (counting on past the last into the next loop). */
  goTo(i: number) {
    this.loop += Math.floor(i / STAGES.length);
    this.stageIdx = i % STAGES.length;
    // Bullets speed up 20% a loop, and 7% a stage within it.
    this.bulletSpeed = (1 + 0.2 * (this.loop - 1)) * (1 + 0.07 * this.stageIdx);
    this.terrain = new Terrain(1234 + this.stageIdx * 77, this.stage.ground);
    this.dist = 0;
    this.warning = 0;
    // The ship left over the top at stage clear; it flies back in from the bottom.
    if (this.player.alive) Object.assign(this.player, { x: W / 2, y: H + 24, timer: 50, invuln: Math.max(this.player.invuln, 60), bank: 0 });
    this.waveIdx = 0;
    this.enemies = [];
    this.bullets = [];
    this.items = [];
    this.wrecks = [];
    this.later = [];
    this.boss = null;
    this.misses = 0;
    this.state = 'play';
    this.stateTimer = 0;
  }

  /** Jumps to scroll distance d, skipping the waves before it (dev). */
  skipTo(d: number) {
    this.dist = d;
    this.waveIdx = this.waves.findIndex((wv) => wv.at >= d);
    if (this.waveIdx < 0) this.waveIdx = this.waves.length;
    this.enemies = this.enemies.filter((e) => e.def.name === 'part');
    this.bullets = [];
  }

  addScore(n: number) {
    this.score += n;
    if (this.extendsGiven < EXTENDS.length && this.score >= EXTENDS[this.extendsGiven]) {
      this.extendsGiven++;
      this.lives++;
      sfx.oneUp();
    }
  }

  update(c: Controls) {
    this.frame++;
    this.stateTimer++;
    if (this.state === 'over') return;
    this.dist += this.scroll;
    if (this.shake > 0) this.shake--;
    if (this.whiteout > 0) this.whiteout--;

    if (this.state === 'play') this.runTimeline();
    for (let i = 0; i < this.later.length; i++) {
      const l = this.later[i];
      if (l.at > this.frame) continue;
      l.fn();
      this.later.splice(i--, 1);
    }

    this.updatePlayer(c);
    this.updateShots();
    if (this.boss) this.boss.update(this);
    this.updateEnemies();
    this.updateBullets();
    this.updateItems();
    this.updateBomb();
    this.updateFx();
    this.collide();

    if (this.state === 'clear' && this.stateTimer > 60 * 6) this.stateTimer = 60 * 6;
  }

  // ---------- stage ----------

  private runTimeline() {
    while (this.waveIdx < this.waves.length && this.dist >= this.waves[this.waveIdx].at) this.waves[this.waveIdx++].run(this);
    if (!this.boss && this.warning === 0 && this.dist >= this.stage.length) {
      this.warning = 200;
      sfx.warning();
    }
    if (this.warning > 0 && --this.warning === 0) this.boss = new Boss(this, this.stage.boss);
  }

  /** The boss is down: everything still flying turns into points. */
  stageClear() {
    this.addScore(this.bullets.length * 10);
    this.bullets = [];
    this.state = 'clear';
    this.stateTimer = 0;
    sfx.cleared();
  }

  // ---------- player ----------

  private updatePlayer(c: Controls) {
    const p = this.player;
    if (p.invuln > 0) p.invuln--;
    if (p.shieldT > 0 && --p.shieldT === 0) {
      p.shield = true;
      sfx.shieldUp();
    }
    if (!p.alive) {
      if (--p.timer > 0 || this.lives <= 0) {
        if (this.lives <= 0 && p.timer < -90 && this.state !== 'over') {
          this.state = 'over';
          this.stateTimer = 0;
        }
        return;
      }
      // Back in from the bottom edge.
      Object.assign(p, { alive: true, x: W / 2, y: H + 24, timer: 50, invuln: 180, bank: 0, shield: this.shielded, shieldT: 0 });
      return;
    }
    if (p.timer > 0) {
      // Flying in: no control yet.
      p.timer--;
      p.y += (H - 48 - p.y) * 0.08;
      return;
    }
    if (this.state === 'clear') {
      // The ship heads off the top of the screen.
      p.y -= Math.min(4, this.stateTimer * 0.05);
      p.bank *= 0.9;
      return;
    }

    let dx = c.dx, dy = c.dy;
    if (dx && dy) {
      dx *= Math.SQRT1_2;
      dy *= Math.SQRT1_2;
    }
    p.x += dx * PLAYER_SPEED + c.dragX;
    p.y += dy * PLAYER_SPEED + c.dragY;
    p.x = Math.max(10, Math.min(W - 10, p.x));
    p.y = Math.max(16, Math.min(H - 14, p.y));
    const bankTo = Math.max(-1, Math.min(1, dx + c.dragX * 0.5));
    p.bank += (bankTo - p.bank) * 0.2;

    if (c.bomb && p.bombs > 0 && this.bombT < 0) this.dropBomb();
    if (c.fire) this.fire();
    if (p.cooldown > 0) p.cooldown--;
    if (p.missileCooldown > 0) p.missileCooldown--;
  }

  private fire() {
    const p = this.player;
    if (p.missiles > 0 && p.missileCooldown <= 0) {
      // A full rack of five also reloads faster.
      p.missileCooldown = p.missiles >= MAX_MISSILES ? 28 : 36;
      for (let k = 0; k < p.missiles; k++) {
        const side = k % 2 ? 1 : -1;
        const x = p.x + side * (8 + (k >> 1) * 4);
        this.shots.push({ kind: 'missile', x, y: p.y + 4, vx: side * (0.8 + (k >> 1) * 0.6), vy: -1.5, dmg: 2.5, t: 0, dead: false });
      }
      sfx.missile();
    }
    if (p.cooldown > 0) return;
    if (p.weapon === 'vulcan') {
      p.cooldown = 6;
      // Streams, and how far apart they fan, per level.
      const n = [2, 3, 5, 7, 9][p.level - 1];
      const spread = [0, 0.1, 0.1, 0.11, 0.12][p.level - 1];
      for (let k = 0; k < n; k++) {
        const off = k - (n - 1) / 2;
        const a = n === 2 ? 0 : off * spread;
        const x = p.x + (n === 2 ? (k ? 4 : -4) : off * 2);
        this.shots.push({ kind: 'vulcan', x, y: p.y - 12, vx: Math.sin(a) * 8, vy: -Math.cos(a) * 8, dmg: 1, level: p.level, t: 0, dead: false });
      }
      sfx.vulcan();
    } else {
      p.cooldown = 2;
      const width = 3 + p.level * 2;
      this.shots.push({ kind: 'laser', x: p.x, y: p.y - 14, vx: 0, vy: -10, dmg: 0.6 + p.level * 0.3, hit: new Set(), width, level: p.level, t: 0, dead: false });
      sfx.laser();
    }
  }

  private dropBomb() {
    const p = this.player;
    p.bombs--;
    this.bombT = 0;
    this.bombX = p.x;
    this.bombY = p.y - 60;
    p.invuln = Math.max(p.invuln, 150);
    this.whiteout = 6;
    this.shake = 40;
    sfx.bomb();
  }

  /** A hit: the shield takes it if it's up, otherwise the ship is lost. */
  private hitPlayer() {
    const p = this.player;
    if (!p.shield) return this.killPlayer();
    p.shield = false;
    p.shieldT = SHIELD_REGEN;
    p.invuln = 90;
    this.debris(p.x, p.y, 12, '#78d8f8');
    this.shake = 8;
    sfx.shieldDown();
  }

  private killPlayer() {
    const p = this.player;
    p.alive = false;
    p.timer = 120;
    this.lives--;
    this.misses++;
    this.blast(p.x, p.y, true, false);
    this.debris(p.x, p.y, 24, '#f8d838');
    this.shake = 20;
    sfx.die();
    // A lost ship costs half your levels, rounded down but at least one: weapon and missiles alike.
    const lose = (n: number) => Math.max(1, Math.floor(n / 2));
    p.level = Math.max(1, p.level - lose(p.level));
    p.missiles = Math.max(0, p.missiles - lose(p.missiles));
    p.bombs = Math.max(p.bombs, START_BOMBS);
    this.bullets = [];
  }

  // ---------- shots ----------

  private updateShots() {
    const p = this.player;
    for (const s of this.shots) {
      s.t++;
      if (s.kind === 'missile') this.steer(s);
      if (s.kind === 'laser' && p.alive) {
        // The beam bends after the ship.
        s.x += (p.x - s.x) * 0.25;
      }
      s.x += s.vx;
      s.y += s.vy;
      if (s.y < -20 || s.x < -10 || s.x > W + 10 || s.t > 120) s.dead = true;
    }
    this.shots = this.shots.filter((s) => !s.dead);
  }

  private steer(s: Shot) {
    if (s.t < 8) {
      s.vy -= 0.4;
      return;
    }
    let best: Enemy | null = null, bd = Infinity;
    for (const e of this.enemies) {
      if (e.dead || e.armored || e.hidden || e.y < -10) continue;
      const d = Math.hypot(e.x - s.x, e.y - s.y);
      if (d < bd) (bd = d), (best = e);
    }
    const speed = 5;
    const want = best ? Math.atan2(best.x - s.x, -(best.y - s.y)) : 0;
    const cur = Math.atan2(s.vx, -s.vy);
    let d = want - cur;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    const a = cur + Math.max(-0.12, Math.min(0.12, d));
    s.vx = Math.sin(a) * speed;
    s.vy = -Math.cos(a) * speed;
  }

  // ---------- enemies ----------

  private updateEnemies() {
    for (const e of this.enemies) {
      if (e.dead) continue;
      e.def.update(e, this);
      e.x += e.vx;
      e.y += e.vy;
      e.t++;
      if (e.flash > 0) e.flash--;
      if (e.x > -8 && e.x < W + 8 && e.y > -8 && e.y < H + 8) e.seen = true;
      if (e.def.name !== 'part' && gone(e)) e.dead = true;
    }
    this.enemies = this.enemies.filter((e) => !e.dead);
  }

  damage(e: Enemy, dmg: number) {
    if (e.dead) return;
    if (e.armored) {
      sfx.hit();
      return;
    }
    e.hp -= dmg;
    e.flash = 3;
    sfx.hit();
    if (e.hp <= 0) this.kill(e);
  }

  kill(e: Enemy) {
    e.dead = true;
    this.addScore(e.def.score);
    if (e.def.name === 'part') return this.boss?.partDestroyed(this, e);
    this.blast(e.x, e.y, !!e.def.big, e.def.ground);
    this.debris(e.x, e.y, e.def.big ? 18 : 8, e.def.ground ? '#8a7050' : '#bcbcbc');
    if (e.def.ground && !e.def.sinks) this.wrecks.push({ x: e.x, y: e.y });
    if (e.def.big) this.shake = Math.max(this.shake, 12);
    if (e.drop) this.dropItem(e.drop, e.x, e.y);
  }

  dropItem(kind: ItemKind, x: number, y: number) {
    const ground = kind === 'medal';
    this.items.push({
      kind, x, y, t: 0, dead: false,
      vx: ground ? 0 : this.rng() < 0.5 ? -0.7 : 0.7,
      vy: ground ? this.scroll : -1.2,
    });
  }

  // ---------- bullets ----------

  private updateBullets() {
    const bursting: Bullet[] = [];
    for (const b of this.bullets) {
      b.x += b.vx;
      b.y += b.vy;
      b.t++;
      if (b.x < -8 || b.x > W + 8 || b.y < -8 || b.y > H + 8) b.dead = true;
      if (b.life !== undefined && b.t >= b.life) b.dead = true;
      if (b.burst !== undefined && b.t >= b.burst && !b.dead) {
        b.dead = true;
        bursting.push(b);
      }
    }
    this.bullets = this.bullets.filter((b) => !b.dead);
    for (const b of bursting) {
      ring(this, b.x, b.y, 8 + this.loop * 2, 1.2, b.t / 9);
      this.particles.push({ x: b.x, y: b.y, vx: 0, vy: 0, life: 8, color: '#f8d838' });
    }
  }

  // ---------- items ----------

  private updateItems() {
    const p = this.player;
    for (const it of this.items) {
      it.t++;
      if (it.kind === 'medal') {
        it.vy = this.scroll;
      } else {
        // Power-ups drift and bounce around for a while, then sink away.
        it.vy = Math.min(0.5, it.vy + 0.05);
        const free = it.t > 60 * 12;
        if (!free && (it.x < 8 || it.x > W - 8)) it.vx = -it.vx;
        if (!free && it.y > H - 20 && it.vy > 0) it.vy = -0.9;
      }
      it.x += it.vx;
      it.y += it.vy;
      if (it.y > H + 12) {
        it.dead = true;
        if (it.kind === 'medal') this.medalValue = 500;
      }
      if (p.alive && Math.abs(it.x - p.x) < 12 && Math.abs(it.y - p.y) < 12) {
        it.dead = true;
        this.collect(it);
      }
    }
    this.items = this.items.filter((it) => !it.dead);
  }

  /** The weapon item's current face, cycling between vulcan and laser. */
  static weaponFace(it: Item): Weapon {
    return Math.floor(it.t / ITEM_CYCLE) % 2 ? 'laser' : 'vulcan';
  }

  private collect(it: Item) {
    const p = this.player;
    const bonus = (label: string) => {
      this.addScore(5000);
      this.popup(it.x, it.y, label);
    };
    if (it.kind === 'medal') {
      this.addScore(this.medalValue);
      this.popup(it.x, it.y, String(this.medalValue));
      this.medals++;
      sfx.medal(this.medalValue / 500);
      this.medalValue = Math.min(10000, this.medalValue + 500);
      return;
    }
    sfx.power();
    // Say what it did, over the ship.
    const said = (text: string) => this.popup(p.x, p.y - 22, text);
    const lv = (n: number, max: number) => (n >= max ? 'MAX' : String(n));
    if (it.kind === 'weapon') {
      // Either colour powers up; the other one also switches weapon, keeping the level.
      const face = World.weaponFace(it);
      const switched = face !== p.weapon;
      p.weapon = face;
      if (p.level < MAX_LEVEL) p.level++;
      else if (!switched) return bonus('5000');
      said(`${face === 'vulcan' ? 'VULCAN' : 'LASER'} ${lv(p.level, MAX_LEVEL)}`);
    } else if (it.kind === 'missile') {
      if (p.missiles < MAX_MISSILES) p.missiles++;
      else return bonus('5000');
      said(`MISSILES ${lv(p.missiles, MAX_MISSILES)}`);
    } else if (it.kind === 'bomb') {
      if (p.bombs < MAX_BOMBS) p.bombs++;
      else return bonus('5000');
      said('BOMB');
    }
  }

  // ---------- bomb ----------

  private updateBomb() {
    if (this.bombT < 0) return;
    this.bombT++;
    if (this.bombT < 100) {
      for (const b of this.bullets) this.particles.push({ x: b.x, y: b.y, vx: 0, vy: -0.5, life: 10, color: '#f8d838' });
      this.bullets = [];
    }
    if (this.bombT < 90 && this.bombT % 6 === 0) {
      for (const e of this.enemies) if (e.y > -8 && e.y < H + 8) this.damage(e, e.def.name === 'part' ? 2 : 6);
      this.blast(this.bombX + (this.rng() - 0.5) * 140, this.bombY + (this.rng() - 0.5) * 140, this.rng() < 0.3, false);
    }
    if (this.bombT > 120) this.bombT = -1;
  }

  // ---------- effects ----------

  blast(x: number, y: number, big: boolean, ground: boolean) {
    this.blasts.push({ x, y, big, t: 0, ground });
    if (big) sfx.bigBoom();
    else sfx.boom();
  }

  debris(x: number, y: number, n: number, color: string) {
    for (let k = 0; k < n; k++) {
      const a = this.rng() * Math.PI * 2, s = 0.5 + this.rng() * 2.5;
      this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 20 + this.rng() * 25, color: this.rng() < 0.5 ? color : '#f89838' });
    }
  }

  popup(x: number, y: number, text: string) {
    if (text) this.popups.push({ x, y, text, t: 0 });
  }

  private updateFx() {
    for (const b of this.blasts) {
      b.t++;
      if (b.ground) b.y += this.scroll;
    }
    this.blasts = this.blasts.filter((b) => b.t < (b.big ? 48 : 30));
    for (const q of this.particles) {
      q.x += q.vx;
      q.y += q.vy;
      q.vx *= 0.94;
      q.vy *= 0.94;
      q.life--;
    }
    this.particles = this.particles.filter((q) => q.life > 0);
    for (const wr of this.wrecks) wr.y += this.scroll;
    this.wrecks = this.wrecks.filter((wr) => wr.y < H + 20);
    for (const pu of this.popups) {
      pu.t++;
      pu.y -= 0.4;
    }
    this.popups = this.popups.filter((pu) => pu.t < 50);
  }

  // ---------- collisions ----------

  private collide() {
    for (const s of this.shots) {
      for (const e of this.enemies) {
        if (e.dead || s.dead || e.hidden) continue;
        const half = s.kind === 'laser' ? s.width! / 2 : 2;
        const r = e.r ?? e.def.r;
        // Armour stops only what is really inside it; targets get a generous box.
        if (e.armored ? Math.hypot(e.x - s.x, e.y - s.y) > r : Math.abs(e.x - s.x) > r + half || Math.abs(e.y - s.y) > r + 6) continue;
        // A boss's armour lets through a shot lined up with one of its live guns further on.
        if (e.armored && this.boss?.parts.some((q) => !q.armored && !q.dead && q.y < s.y && Math.abs(q.x - s.x) < (q.r ?? q.def.r) + half)) continue;
        if (s.kind === 'laser') {
          if (s.hit!.has(e)) continue;
          s.hit!.add(e);
          if (e.armored) s.dead = true;
        } else s.dead = true;
        this.damage(e, s.dmg);
        if (s.dead) this.particles.push({ x: s.x, y: s.y, vx: 0, vy: 0, life: 4, color: '#fcfcfc' });
      }
    }

    const p = this.player;
    if (!p.alive || p.invuln > 0 || p.timer > 0 || this.state !== 'play') return;
    for (const b of this.bullets) {
      const dx = b.x - p.x, dy = b.y - p.y;
      if (dx * dx + dy * dy < (b.r + 2) ** 2) return this.hitPlayer();
    }
    for (const e of this.enemies) {
      if (e.def.ground || e.dead) continue;
      const r = (e.r ?? e.def.r) * 0.6 + 2;
      if (Math.abs(e.x - p.x) < r && Math.abs(e.y - p.y) < r) return this.hitPlayer();
    }
  }

  /** How far through the stage, 0..1, for the music. */
  get progress() {
    return Math.min(1, this.dist / this.stage.length);
  }
}
