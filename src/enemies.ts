// Enemy types: hit points, score, sprite and how each one moves and shoots.
import type { World } from './world';
import { aimed, aimAt, fan, ring, needles } from './bullets';
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
  /** Out of reach entirely (under the lava): shots and missiles pass it by. */
  hidden?: boolean;
  /** Has been on screen, so leaving it means it's gone. */
  seen: boolean;
  /** The other end of a laser fence; for a segment, the head it follows. */
  link?: Enemy;
  /** Health when it came in, for a health bar. */
  maxHp?: number;
  /** A head's recent path, as x, y, underground (1/0) triples, newest first: its segments follow it. */
  trail?: number[];
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
  /** On water: goes down without leaving a wreck. */
  sinks?: boolean;
  update(e: Enemy, w: World): void;
  /** Called when shot down, after the blast and the drop. */
  onDeath?(e: Enemy, w: World): void;
  /** A mid-boss: its name for the caution card. It gets a health bar and stays until it leaves. */
  mid?: string;
  /** A shield: true if a player shot at (x, y) is stopped before it reaches the hull. */
  blocks?(e: Enemy, x: number, y: number): boolean;
}

/** Extra shots in a volley: from stage 4 on, and on every later loop. */
const loopShots = (w: World) => (w.loop > 1 || w.stageIdx >= 3 ? 1 : 0);

/**
 * Small fighter. p[0] picks the flight path:
 * 0 dive straight down, curving toward the player; 1 sweep across from the side (p[1] = row);
 * 2 swoop: dive to p[1], turn and climb away; 3 loop the loop at row p[1]; 4 cross diagonally.
 * p[2] delays its one aimed shot.
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
      if (e.y > 70 && e.y < 200) e.vx += Math.sign(w.target(e.x, e.y).x - e.x) * 0.05;
      e.vx = Math.max(-1.6, Math.min(1.6, e.vx));
    } else if (path === 1) {
      if (e.t === 0) e.vx = e.x < W / 2 ? 2.2 : -2.2;
      e.vy = Math.cos(e.t / 14) * 0.9 + (row - e.y) * 0.02;
    } else if (path === 2) {
      if (e.t === 0) e.vy = 3.2;
      if (e.y > row || e.vy < 3) e.vy -= 0.1;
      e.vy = Math.max(-3.2, e.vy);
      e.vx += Math.sign(W / 2 - e.x) * 0.03 * (e.vy < 0 ? 1 : 0);
    } else if (path === 3) {
      // Loop the loop: down to the row, once round a circle turning away from the near edge, then
      // on down. p[3] is how far it has turned, p[4] which way.
      const side = (e.p[4] ??= e.x < W / 2 ? 1 : -1);
      const before = e.p[3] ?? 0;
      if ((e.y >= row || before > 0) && before < Math.PI * 2) {
        e.p[3] = Math.min(Math.PI * 2, before + 0.075);
        // Its shot comes at the top of the loop, upside down.
        if (before < Math.PI && e.p[3] >= Math.PI) aimed(w, e.x, e.y, 1 + loopShots(w) * 2, 0.25, 2.2);
      }
      const a = (e.p[3] ?? 0) * side;
      e.vx = Math.sin(a) * 2.4;
      e.vy = Math.cos(a) * 2.4;
    } else {
      // Crossing: straight across on a diagonal from a top corner.
      if (e.t === 0) {
        e.vx = e.x < W / 2 ? 1.7 : -1.7;
        e.vy = 1.7;
      }
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
    // An aimed spread with gaps wide enough to slip through, then one gun at a time lobs a pair
    // of big slow bullets.
    if (e.t % 100 === 30) aimed(w, e.x, e.y + 14, 3 + loopShots(w) * 2, 0.3, 1.8);
    if (e.t % 100 === 80) {
      const side = (e.t / 100) % 2 < 1 ? -1 : 1;
      fan(w, e.x + side * 12, e.y + 10, 0, 2, 0.5, 1.4, true);
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
  hp: 5,
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

/**
 * Interceptor: comes up from behind the player at column p[0], overshoots to row p[1],
 * turns, fires and dives back down.
 */
const interceptor: EnemyDef = {
  name: 'interceptor',
  sprite: 'enemies/interceptor',
  hp: 3,
  score: 300,
  r: 9,
  ground: false,
  update(e, w) {
    const row = e.p[1] ?? 70;
    if (e.t === 0) e.vy = -3.6;
    if (e.y < row || e.vy > -3.6) e.vy = Math.min(2.4, e.vy + 0.12);
    // Once turned it leans toward the player.
    if (e.vy > 0) e.vx += Math.sign(w.target(e.x, e.y).x - e.x) * 0.03;
    if (e.vy > 0 && !e.p[2]) {
      // It leaves needles behind as it turns: they hang a moment, then dart at you.
      e.p[2] = 1;
      needles(w, e.x, e.y, aimAt(w, e.x, e.y), 1 + loopShots(w) * 2, 0.4, 1.2, 24, 3.0);
    }
  },
};

/** Bomber: big and slow, straight down the screen, rings of slow bullets and aimed pairs. */
const bomber: EnemyDef = {
  name: 'bomber',
  sprite: 'enemies/bomber',
  hp: 90,
  score: 4000,
  r: 26,
  ground: false,
  big: true,
  update(e, w) {
    e.vy = e.t < 50 ? 1.1 : 0.42;
    e.vx = 0;
    if (e.y < 16) return;
    if (e.t % 120 === 60) ring(w, e.x, e.y + 8, 8 + loopShots(w) * 4, 1.1, e.t / 37, true);
    if (e.t % 120 === 0) aimed(w, e.x, e.y + 20, 2, 0.3, 1.9);
  },
};

/** Artillery: a long gun on a turntable. Slow to turn, fires bursts of three heavy shells. */
const artillery: EnemyDef = {
  name: 'artillery',
  sprite: 'enemies/artillery',
  hp: 24,
  score: 1200,
  r: 13,
  ground: true,
  update(e, w) {
    e.vx = 0;
    e.vy = w.scroll;
    turn(e, aimAt(w, e.x, e.y), 0.03);
    if (e.y < 24) return;
    const k = e.t % 160;
    if (k === 80 || k === 92 || k === 104) fan(w, e.x + Math.sin(e.aim) * 13, e.y + Math.cos(e.aim) * 13, e.aim, 1, 0, 1.7, true);
  },
};

/** Where a destroyer's two gun turrets sit, from its centre. */
export const DESTROYER_GUNS = [-14, 14];

/**
 * Destroyer: sails the open water (p[0] its own speed up the screen, p[1] sideways) and fires
 * from its two turrets in turn.
 */
const destroyer: EnemyDef = {
  name: 'destroyer',
  sprite: 'enemies/destroyer',
  hp: 40,
  score: 2500,
  r: 16,
  ground: true,
  big: true,
  sinks: true,
  update(e, w) {
    e.vx = e.p[1] ?? 0;
    e.vy = w.scroll - (e.p[0] ?? 0.25);
    turn(e, aimAt(w, e.x, e.y), 0.04);
    if (e.y < 10) return;
    const k = e.t % 70;
    if (k === 0 || k === 35) {
      const gy = e.y + DESTROYER_GUNS[k ? 1 : 0];
      fan(w, e.x + Math.sin(e.aim) * 8, gy + Math.cos(e.aim) * 8, aimAt(w, e.x, gy), 1 + loopShots(w), 0.2, 2.0);
    }
  },
};

/**
 * Drone: flies in as one of a ring around (p[0], p[1]) at angle p[2] and radius p[3], circles,
 * and at frame p[4] breaks off and darts at where the player is.
 */
const drone: EnemyDef = {
  name: 'drone',
  sprite: 'enemies/drone',
  hp: 1,
  score: 150,
  r: 6,
  ground: false,
  update(e, w) {
    const [cx, cy0, a0, radius, leave] = e.p;
    if (e.t < leave) {
      const cy = cy0 + Math.min(e.t, 70) * 1.6;
      const a = a0 + e.t * 0.05;
      e.vx = cx + Math.cos(a) * radius - e.x;
      e.vy = cy + Math.sin(a) * radius - e.y;
    } else if (e.t === leave) {
      const p = w.target(e.x, e.y);
      const d = Math.hypot(p.x - e.x, p.y - e.y) || 1;
      e.vx = ((p.x - e.x) / d) * 3;
      e.vy = ((p.y - e.y) / d) * 3;
    }
  },
};

/**
 * Helicopter: drops in to row p[0], then strafes across the screen in direction p[1],
 * firing single aimed shots as it goes.
 */
const heli: EnemyDef = {
  name: 'heli',
  sprite: 'enemies/heli',
  hp: 10,
  score: 600,
  r: 12,
  ground: false,
  update(e, w) {
    const row = e.p[0] ?? 80;
    const dir = e.p[1] ?? 1;
    if (e.t < 60) {
      e.vy = Math.max(0.2, (row - e.y) * 0.05);
      e.vx = 0;
    } else {
      e.vy = Math.sin(e.t / 20) * 0.3;
      e.vx = Math.min(1.3, (e.t - 60) * 0.03) * dir;
      if (e.t % 26 === 0) aimed(w, e.x, e.y + 10, 1 + loopShots(w), 0.2, 2.4);
    }
  },
};

/** Frames a pop-up turret's cycle lasts, and when within it the hatch is open. */
export const POPUP_CYCLE = 160;
export const popupOpen = (e: Enemy) => {
  const k = (e.t + (e.p[0] ?? 0)) % POPUP_CYCLE;
  return k >= 70 && k < 140;
};

/** Pop-up turret: an armoured hatch in a rooftop. Opens, fires a ring and an aimed burst, closes. */
const popup: EnemyDef = {
  name: 'popup',
  sprite: 'enemies/popup_closed',
  hp: 14,
  score: 800,
  r: 10,
  ground: true,
  update(e, w) {
    e.vx = 0;
    e.vy = w.scroll;
    e.armored = !popupOpen(e);
    if (e.y < 20) return;
    const k = (e.t + (e.p[0] ?? 0)) % POPUP_CYCLE;
    if (k === 90) ring(w, e.x, e.y, 8 + loopShots(w) * 4, 1.4, e.t / 30);
    if (k === 115) aimed(w, e.x, e.y, 3, 0.2, 2.2);
  },
};

/** An armoured train runs down the rails at x: the engine, then gun cars, all at speed p[0]. */
const trainEngine: EnemyDef = {
  name: 'trainEngine',
  sprite: 'enemies/train_engine',
  hp: 30,
  score: 1500,
  r: 12,
  ground: true,
  big: true,
  update(e, w) {
    e.vx = 0;
    e.vy = w.scroll + (e.p[0] ?? 0.4);
  },
};

const trainCar: EnemyDef = {
  name: 'trainCar',
  sprite: 'enemies/train_car',
  hp: 18,
  score: 800,
  r: 12,
  ground: true,
  update(e, w) {
    e.vx = 0;
    e.vy = w.scroll + (e.p[0] ?? 0.4);
    turn(e, aimAt(w, e.x, e.y), 0.05);
    if (e.y > 16 && (e.t + (e.p[1] ?? 0) * 30) % 90 === 0) fan(w, e.x + Math.sin(e.aim) * 9, e.y + Math.cos(e.aim) * 9, e.aim, 1 + loopShots(w), 0.2, 2.0);
  },
};

/** Where a lava boat's gun sits, below its centre. */
export const LAVABOAT_GUN = -2;

/** Lava boat: sails a lava river like a destroyer, one gun amidships. */
const lavaboat: EnemyDef = {
  name: 'lavaboat',
  sprite: 'enemies/lavaboat',
  hp: 22,
  score: 1200,
  r: 12,
  ground: true,
  sinks: true,
  update(e, w) {
    e.vx = e.p[1] ?? 0;
    e.vy = w.scroll - (e.p[0] ?? 0.2);
    turn(e, aimAt(w, e.x, e.y), 0.05);
    if (e.y > 12 && e.t % 60 === 30) fan(w, e.x + Math.sin(e.aim) * 9, e.y + LAVABOAT_GUN + Math.cos(e.aim) * 9, e.aim, 2 + loopShots(w), 0.18, 2.0);
  },
};

/** Frames a magma turret's cycle lasts; within it, when it is up out of the lava. */
export const MAGMA_CYCLE = 200;
/** How far a magma turret has risen, 0 (under the lava) to 1 (up). */
export function magmaRise(e: Enemy) {
  const k = (e.t + (e.p[0] ?? 0)) % MAGMA_CYCLE;
  if (k < 60) return 0;
  if (k < 80) return (k - 60) / 20;
  if (k < 160) return 1;
  if (k < 180) return 1 - (k - 160) / 20;
  return 0;
}

/** Magma turret: rises out of the lava, fires a spread and a ring, sinks again. Safe under the lava. */
const magmaTurret: EnemyDef = {
  name: 'magmaTurret',
  sprite: 'enemies/magma_turret',
  hp: 12,
  score: 900,
  r: 10,
  ground: true,
  sinks: true,
  update(e, w) {
    e.vx = 0;
    e.vy = w.scroll;
    e.armored = magmaRise(e) < 1;
    e.hidden = magmaRise(e) === 0;
    turn(e, aimAt(w, e.x, e.y), 0.08);
    if (e.y < 16) return;
    const k = (e.t + (e.p[0] ?? 0)) % MAGMA_CYCLE;
    if (k === 95) fan(w, e.x, e.y, e.aim, 5, 0.2, 1.9);
    if (k === 130) ring(w, e.x, e.y, 10 + loopShots(w) * 4, 1.3, e.t / 25);
  },
};

/** Frames a silo's cycle lasts; within it, when its doors are open. */
export const SILO_CYCLE = 240;
export const siloOpen = (e: Enemy) => {
  const k = (e.t + (e.p[0] ?? 0)) % SILO_CYCLE;
  return k >= 120 && k < 200;
};

/** Missile silo: opens its doors and launches a homing rocket. Only hurt while open. */
const silo: EnemyDef = {
  name: 'silo',
  sprite: 'enemies/silo_closed',
  hp: 20,
  score: 1500,
  r: 13,
  ground: true,
  update(e, w) {
    e.vx = 0;
    e.vy = w.scroll;
    e.armored = !siloOpen(e);
    const k = (e.t + (e.p[0] ?? 0)) % SILO_CYCLE;
    if (k === 150 && e.y > 10 && e.y < 220 && w.anyAlive) {
      const r = w.spawn(rocket, e.x, e.y, []);
      r.aim = aimAt(w, e.x, e.y);
      r.seen = true;
    }
  },
};

/** Homing rocket: launched by silos and bosses. Slow, turns toward the player, can be shot down. */
const rocket: EnemyDef = {
  name: 'rocket',
  sprite: 'enemies/rocket',
  hp: 1,
  score: 200,
  r: 5,
  ground: false,
  update(e, w) {
    if (e.t < 210 && w.anyAlive) turn(e, aimAt(w, e.x, e.y), e.t < 20 ? 0 : 0.028);
    const speed = Math.min(1.9, 0.4 + e.t * 0.03) * w.bulletSpeed;
    e.vx = Math.sin(e.aim) * speed;
    e.vy = Math.cos(e.aim) * speed;
  },
};

/** A piece of a boss: positioned by the boss, never moves by itself. */
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

/** A piece of a boss on the ground: the player can fly over it. */
const groundPart: EnemyDef = { ...part, ground: true };

/** Turns the turret toward `want` by at most `rate` radians. */
function turn(e: Enemy, want: number, rate: number) {
  let d = want - e.aim;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  e.aim += Math.max(-rate, Math.min(rate, d));
}

// ---------- stage 6: orbit ----------

/** Asteroid: drifts at (p[0], p[1]) and tumbles. Shot down, it splits into two of the next size. */
function asteroid(size: 'big' | 'mid' | 'small', hp: number, r: number, score: number, into?: () => EnemyDef): EnemyDef {
  return {
    name: 'asteroid',
    sprite: `enemies/asteroid_${size}`,
    hp,
    score,
    r,
    ground: false,
    big: size === 'big',
    update(e) {
      e.vx = e.p[0] ?? 0;
      e.vy = e.p[1] ?? 0.8;
    },
    onDeath(e, w) {
      if (!into) return;
      for (const side of [-1, 1]) {
        const k = w.spawn(into(), e.x + side * r * 0.5, e.y, [(e.p[0] ?? 0) + side * (0.5 + w.rng() * 0.4), (e.p[1] ?? 0.8) + w.rng() * 0.4]);
        k.seen = true;
      }
    },
  };
}
const asteroidSmall = asteroid('small', 2, 6, 100);
const asteroidMid = asteroid('mid', 8, 11, 300, () => asteroidSmall);
const asteroidBig = asteroid('big', 26, 18, 600, () => asteroidMid);

/** How close the player may come to a laser fence before it burns. */
export const FENCE_R = 3;

/**
 * Satellite: one end of a laser fence. A pair turns slowly round its middle while it drifts down;
 * p = [centre x, centre y, radius, angle, turn speed]. The fence burns while both ends are alive.
 */
const satellite: EnemyDef = {
  name: 'satellite',
  sprite: 'enemies/satellite',
  hp: 16,
  score: 800,
  r: 11,
  ground: false,
  update(e, w) {
    const [cx, , radius, a0, spin] = e.p;
    e.p[1] += 0.55;
    const a = a0 + e.t * spin;
    e.vx = cx + Math.cos(a) * radius - e.x;
    e.vy = e.p[1] + Math.sin(a) * radius - e.y;
    if (e.y > 10 && e.t % 150 === 75) aimed(w, e.x, e.y, 1 + loopShots(w), 0.2, 2.0);
    // The pair's first satellite checks the fence against the ships.
    const o = e.link;
    if (!o || o.dead || a0 > Math.PI / 2) return;
    const dx = o.x - e.x, dy = o.y - e.y, len2 = dx * dx + dy * dy || 1;
    for (const p of w.players) {
      const k = Math.max(0, Math.min(1, ((p.x - e.x) * dx + (p.y - e.y) * dy) / len2));
      if (Math.hypot(e.x + dx * k - p.x, e.y + dy * k - p.y) < FENCE_R) w.hurt(p);
    }
  },
};

/** Mine: drifts down, then creeps toward the ship. Close by, or shot, it bursts into a ring. */
const mine: EnemyDef = {
  name: 'mine',
  sprite: 'enemies/mine',
  hp: 4,
  score: 300,
  r: 7,
  ground: false,
  update(e, w) {
    const p = w.target(e.x, e.y);
    const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy) || 1;
    if (e.t < 40 || !p.alive) {
      e.vx = 0;
      e.vy = 0.9;
    } else {
      e.vx += ((dx / d) * 0.55 - e.vx) * 0.05;
      e.vy += ((dy / d) * 0.55 - e.vy) * 0.05;
    }
    if (d < 30 && p.alive) {
      e.dead = true;
      w.blast(e.x, e.y, false, false);
      ring(w, e.x, e.y, 8, 1.2, e.t / 10);
    }
  },
  onDeath(e, w) {
    ring(w, e.x, e.y, 6, 1.1, e.t / 10);
  },
};

/** Stealth fighter: cloaked (and out of reach) on the way in, shows itself to fire, then cloaks and leaves. */
export const STEALTH_SHOW: [number, number] = [50, 120];
const stealth: EnemyDef = {
  name: 'stealth',
  sprite: 'enemies/stealth',
  hp: 6,
  score: 700,
  r: 9,
  ground: false,
  update(e, w) {
    const row = e.p[0] ?? 90;
    e.hidden = e.t < STEALTH_SHOW[0] || e.t > STEALTH_SHOW[1];
    if (e.t <= STEALTH_SHOW[1]) {
      e.vy = Math.max(0, (row - e.y) * 0.06);
      e.vx = Math.sin(e.t / 20) * 0.4;
    } else {
      e.vy = Math.min(2.4, e.vy + 0.05);
      e.vx = e.p[1] ?? 0.8;
    }
    if (e.t === 70 || e.t === 100) aimed(w, e.x, e.y + 6, 3 + loopShots(w) * 2, 0.18, 2.4);
  },
};

/** How far a gravity drone's pull reaches, and how hard it pulls. */
export const GRAVITY_R = 110;
const GRAVITY_PULL = 0.5;

/** Gravity drone: hovers at row p[0], drags the ship toward it, and sends out slow rings. */
const gravity: EnemyDef = {
  name: 'gravity',
  sprite: 'enemies/gravity',
  hp: 30,
  score: 2000,
  r: 13,
  ground: false,
  update(e, w) {
    const row = e.p[0] ?? 80;
    if (e.t < 420) {
      e.vy = (row - e.y) * 0.04;
      e.vx = Math.sin(e.t / 50) * 0.5;
    } else e.vy = Math.min(1.2, e.vy + 0.02);
    for (const p of w.players) {
      const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy) || 1;
      if (p.alive && d < GRAVITY_R && d > 24 && e.y > 0) {
        const f = GRAVITY_PULL * (1 - d / GRAVITY_R);
        p.x += (dx / d) * f;
        p.y += (dy / d) * f;
      }
    }
    if (e.y > 10 && e.t % 140 === 60) ring(w, e.x, e.y, 10 + loopShots(w) * 4, 1.0, e.t / 20);
  },
};

/** Raider: the space fighter. Flies the fighter's paths (see `fighter`). */
const raider: EnemyDef = { ...fighter, name: 'raider', sprite: 'enemies/raider', hp: 3 };

/** Frames a hangar's cycle lasts; within it, when its doors are open. */
export const HANGAR_CYCLE = 220;
export const hangarOpen = (e: Enemy) => {
  const k = (e.t + (e.p[0] ?? 0)) % HANGAR_CYCLE;
  return k >= 80 && k < 170;
};

/** Hangar: a launch hatch in the station hull. Armoured shut; opens to launch a raider, and can be hurt then. */
const hangar: EnemyDef = {
  name: 'hangar',
  sprite: 'enemies/hangar_closed',
  hp: 20,
  score: 1500,
  r: 12,
  ground: true,
  update(e, w) {
    e.vx = 0;
    e.vy = w.scroll;
    e.armored = !hangarOpen(e);
    if (e.y < 10 || e.y > H - 60) return;
    const k = (e.t + (e.p[0] ?? 0)) % HANGAR_CYCLE;
    if (k === 100 && w.anyAlive) {
      const r = w.spawn(raider, e.x, e.y, [2, 180 + (w.rng() - 0.5) * 60, 10]);
      r.seen = true;
    }
    if (k === 140) aimed(w, e.x, e.y, 3, 0.25, 2.0);
  },
};

export const ENEMIES = {
  fighter, gunship, carrier, tank, bunker, interceptor, bomber, artillery, destroyer, drone, heli, popup, trainEngine, trainCar, lavaboat, magmaTurret, silo, rocket, part, groundPart,
  asteroidBig, asteroidMid, asteroidSmall, satellite, mine, stealth, gravity, raider, hangar,
};
export type EnemyName = keyof typeof ENEMIES;

export function makeEnemy(def: EnemyDef, x: number, y: number, p: number[] = []): Enemy {
  return { def, x, y, vx: 0, vy: 0, hp: def.hp, t: 0, flash: 0, dead: false, aim: 0, p, seen: false };
}

/** Off screen for good: it has been seen and has left, or it never arrived. */
export function gone(e: Enemy) {
  const m = 40;
  const out = e.x < -m || e.x > W + m || e.y < -m - 40 || e.y > H + m;
  return (e.seen && out) || (e.t > 60 * 30 && !e.def.mid);
}
