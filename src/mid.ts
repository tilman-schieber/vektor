// Mid-bosses: one halfway through each stage, each with a trick of its own. They come in with a
// caution card and a health bar, and if they aren't shot down in time they get away.
import type { World } from './world';
import { ENEMIES, Enemy, EnemyDef, ItemKind } from './enemies';
import { aimed, aimAt, fan, ring, shoot, lob, flame, frost, canFire } from './bullets';
import { W, H } from './draw';

/** Frames a mid-boss stays before it gets away. */
export const MID_TIME = 60 * 32;

/** Gets away: gone without a blast or points. */
function escape(e: Enemy, w: World) {
  e.dead = true;
  w.popup(e.x, e.y, 'ESCAPED');
}

/** Steers e toward (x, y) this frame. */
function moveTo(e: Enemy, x: number, y: number) {
  e.vx = x - e.x;
  e.vy = y - e.y;
}

/** Spawns a homing rocket at (x, y), as the volcano's silos do. */
function rocket(w: World, x: number, y: number) {
  if (!w.anyAlive) return;
  const r = w.spawn(ENEMIES.rocket, x, y, []);
  r.aim = aimAt(w, x, y);
  r.seen = true;
}

// ---------- stage 1: the submarine ----------

/** One surfacing: it comes up, fights, dives, and moves somewhere else under water. */
export const SUB_CYCLE = 330;
/** Within a cycle: up from SUB_UP, under again from SUB_DOWN. */
export const SUB_UP = 50;
export const SUB_DOWN = 250;
export const subUp = (e: Enemy) => {
  const k = e.t % SUB_CYCLE;
  return k >= SUB_UP && k < SUB_DOWN;
};

/** True if the whole hull, `half` pixels either way along y and `wide` across, lies in open water. */
function afloat(w: World, x: number, y: number, half: number, wide: number) {
  for (let dy = -half; dy <= half; dy += 16) for (const dx of [-wide, 0, wide]) if (w.terrain.levelAt(x + dx, y + dy, w.dist) !== 0) return false;
  return true;
}

const submarine: EnemyDef = {
  name: 'submarine',
  sprite: 'mid/submarine',
  mid: 'SUBMARINE',
  hp: 110,
  score: 20000,
  r: 16,
  ground: true,
  sinks: true,
  big: true,
  update(e, w) {
    // It lies in the water and drifts with it, as ships do.
    e.vx = 0;
    e.vy = w.scroll;
    // Its age: e.t skips ahead while it waits for room to come up.
    e.p[1] = (e.p[1] ?? 0) + 1;
    const k = e.t % SUB_CYCLE;
    e.hidden = !subUp(e);
    if (k === 0) {
      // Three surfacings, then it is gone. It comes up near the top, where its whole hull is in
      // open water; with no room anywhere it waits under water and looks again.
      if ((e.p[0] ?? 0) >= 3 || (e.p[1] ?? 0) > MID_TIME) return escape(e, w);
      let found = false;
      for (let tries = 0; tries < 40 && !found; tries++) {
        const x = 30 + w.rng() * (W - 60), y = 10 + w.rng() * 70;
        if (afloat(w, x, y, 48, 10)) {
          e.x = x;
          e.y = y;
          found = true;
        }
      }
      if (!found) {
        // Out of sight while it waits.
        e.t += SUB_CYCLE - 30;
        e.y = -64;
        e.hidden = true;
        return;
      }
      e.p[0] = (e.p[0] ?? 0) + 1;
    }
    // Drifting down too close to you, it dives early and holds its fire.
    if (subUp(e) && e.y > 175) e.t += SUB_DOWN - k;
    if (!subUp(e) || e.y > 150) return;
    const s = k - SUB_UP;
    // It's the first of them, so it goes easy: one torpedo spread, single shots, and from its second
    // surfacing a rocket.
    if (s === 40) fan(w, e.x, e.y + 40, 0, 3, 0.3, 1.2, true);
    if (s === 90 || s === 160) aimed(w, e.x, e.y + 11, 1, 0, 2.0);
    if (s === 120 && e.p[0] > 1) rocket(w, e.x, e.y - 16);
  },
};

// ---------- segments: the sandworm and the lava serpent ----------

/** Frames of trail between one segment and the next. */
const SEG_GAP = 7;

/** A head records where it has been, so its segments can follow. */
function track(e: Enemy, under = false) {
  const t = (e.trail ??= []);
  t.unshift(e.x, e.y, under ? 1 : 0);
  if (t.length > 3 * SEG_GAP * 12) t.length = 3 * SEG_GAP * 12;
}

/** A body segment: sits on its head's trail, `rank` places back. Goes when the head goes. */
function segment(name: string, sprite: string, hp: number, armored: boolean, fire?: (e: Enemy, w: World) => void): EnemyDef {
  return {
    name,
    sprite,
    hp,
    score: armored ? 0 : 500,
    r: 11,
    ground: false,
    update(e, w) {
      const head = e.link!;
      if (head.dead) {
        // Shot down with its head, or gone with it.
        e.dead = true;
        if (head.hp <= 0) w.blast(e.x, e.y, false, false);
        return;
      }
      e.armored = armored;
      const t = head.trail ?? [];
      const i = Math.min(Math.floor(t.length / 3) - 1, ((e.p[1] ?? e.p[0]) + 1) * SEG_GAP);
      if (i < 0) return;
      moveTo(e, t[i * 3], t[i * 3 + 1]);
      e.hidden = t[i * 3 + 2] === 1;
      // Facing the way it goes, for the sprite.
      if (Math.abs(e.vx) + Math.abs(e.vy) < 0.05) e.vy = 0.05;
      if (!e.hidden) fire?.(e, w);
    },
  };
}

/** Spawns a head with n segments behind it. */
function chain(w: World, head: EnemyDef, body: EnemyDef, n: number, x: number, y: number, p: number[], drop?: ItemKind) {
  const h = w.spawn(head, x, y, p, drop);
  for (let k = 0; k < n; k++) {
    const s = w.spawn(body, x, y, [k, k]);
    s.link = h;
    s.seen = true;
  }
  return h;
}

// ---------- stage 2: the sandworm ----------

/** One lunge: under the sand from the far side over to its start, then up in an arc across. */
export const WORM_CYCLE = 270;
export const WORM_UNDER = 120;

const wormHead: EnemyDef = {
  name: 'wormHead',
  sprite: 'mid/worm_head',
  mid: 'SANDWORM',
  hp: 150,
  score: 20000,
  r: 15,
  ground: false,
  big: true,
  update(e, w) {
    const k = e.t % WORM_CYCLE;
    const under = k < WORM_UNDER;
    e.hidden = under;
    if (under) {
      if (k === 0 && e.t >= MID_TIME) return escape(e, w);
      // Burrowing: a mound of sand creeps after you, low on the screen, then it bursts out.
      const tx = Math.max(34, Math.min(W - 34, w.target(e.x, e.y).x));
      moveTo(e, e.x + Math.max(-1.6, Math.min(1.6, tx - e.x)), e.y + Math.max(-2, Math.min(2, WORM_Y - e.y)));
      if (k === WORM_UNDER - 1) {
        // Out it comes, arcing over toward the far side.
        e.p[1] = e.x;
        e.p[2] = e.x < W / 2 ? Math.min(W - 20, e.x + 160) : Math.max(20, e.x - 160);
      }
    } else {
      const u = (k - WORM_UNDER) / (WORM_CYCLE - WORM_UNDER);
      const x0 = e.p[1] ?? e.x, x1 = e.p[2] ?? e.x;
      moveTo(e, x0 + (x1 - x0) * u, WORM_Y - Math.sin(Math.PI * u) * 175);
      // It fires nothing: dodging it is the fight. The ground shakes as it breaks out.
      if (k === WORM_UNDER) w.shake = Math.max(w.shake, 8);
    }
    track(e, under);
  },
};

/** Where the worm bursts out of the sand. */
const WORM_Y = 236;

const wormBody = segment('wormBody', 'mid/worm_body', 999, true);

// ---------- stage 3: the icebreaker ----------

/** Turret and bow positions on the icebreaker, from its centre. */
export const ICEBREAKER_GUNS: [number, number][] = [
  [0, 24.5],
  [0, -31.5],
];
export const ICEBREAKER_BOW = 53;

const icebreaker: EnemyDef = {
  name: 'icebreaker',
  sprite: 'mid/icebreaker',
  mid: 'ICEBREAKER',
  hp: 260,
  score: 20000,
  r: 20,
  ground: true,
  sinks: true,
  big: true,
  update(e, w) {
    if (e.t > MID_TIME || e.p[1]) {
      // Steams off down the screen, back the way it came.
      e.vx = 0;
      e.vy = Math.min(2, e.vy + 0.03);
      return;
    }
    e.vy = (100 - e.y) * 0.02;
    // It keeps to open water, breaking through floes on the way, but never up onto snow or land.
    if (e.t % 10 === 0) {
      let best = e.x, cost = Infinity;
      for (let x = 32; x <= W - 32; x += 8) {
        let c = Math.abs(x - e.x) * 0.2;
        for (let dy = -48; dy <= 48; dy += 16)
          for (const dx of [-14, 0, 14]) {
            const lv = w.terrain.levelAt(x + dx, e.y + dy, w.dist);
            c += lv === 0 ? 0 : lv === 1 ? 4 : 200;
          }
        if (c < cost) (cost = c), (best = x);
      }
      e.p[0] = best;
      // No open water left, or snow coming up under its stern as the ground scrolls on: it turns back.
      const ahead = [-14, 0, 14].some((dx) => w.terrain.levelAt(e.x + dx, e.y - 64, w.dist) >= 2);
      if (cost >= 200 || ahead) e.p[1] = 1;
    }
    e.vx = Math.max(-0.8, Math.min(0.8, ((e.p[0] ?? e.x) - e.x) * 0.04));
    e.aim = aimAt(w, e.x, e.y);
    if (e.y < 0) return;
    const angry = e.hp < (e.maxHp ?? e.hp) / 2;
    // The turrets in turn, frost thrown up off the bow, and ice bombs that burst into frost.
    ICEBREAKER_GUNS.forEach(([gx, gy], i) => {
      const x = e.x + gx, y = e.y + gy;
      if ((e.t + i * 45) % 90 === 0) fan(w, x, y, aimAt(w, x, y), 3, 0.18, 2.0);
    });
    if (e.t % (angry ? 80 : 120) === 60) for (let k = -2; k <= 2; k++) frost(w, e.x, e.y + ICEBREAKER_BOW, k * 0.32, 1.5, 0.4, k * 0.3);
    if (e.t % 150 === 100) {
      const b = lob(w, e.x, e.y, aimAt(w, e.x, e.y) + (w.rng() - 0.5) * 0.5, 1.6, 44);
      if (b) b.frosty = true;
    }
  },
};

// ---------- stage 4: the attack helicopter ----------

/** Where its guns sit, from its centre: the chin gun, and the two rocket pods. */
export const CHOPPER_GUN = 38;
export const CHOPPER_PODS: [number, number][] = [
  [-26, 18],
  [26, 18],
];
/** Where the rotor hub sits, above its centre. */
export const CHOPPER_HUB = -3;
const CHOPPER_CYCLE = 240;

const attackChopper: EnemyDef = {
  name: 'attackChopper',
  sprite: 'mid/chopper',
  mid: 'ATTACK HELICOPTER',
  hp: 240,
  score: 20000,
  r: 20,
  ground: false,
  big: true,
  update(e, w) {
    if (e.t > MID_TIME) {
      // Breaks off and climbs away.
      e.vx = 0;
      e.vy = Math.max(-2, e.vy - 0.05);
      return;
    }
    // It lines up with you, slowly.
    e.vy = (64 - e.y) * 0.04;
    e.vx = Math.max(-0.7, Math.min(0.7, (w.target(e.x, e.y).x - e.x) * 0.02));
    const k = e.t % CHOPPER_CYCLE;
    // The chin gun sweeps across the screen in short bursts, the other way each time: slip
    // through between the bursts.
    if (k >= 60 && k < 140 && k % 10 < 4 && k % 2 === 0 && canFire(w, e.x, e.y)) {
      const dir = Math.floor(e.t / CHOPPER_CYCLE) % 2 ? -1 : 1;
      shoot(w, e.x, e.y + CHOPPER_GUN, dir * (-0.7 + 1.4 * ((k - 60) / 80)), 2.4);
    }
    // Then a salvo of rockets from the pods.
    if (k === 180 || k === 200) for (const [px, py] of CHOPPER_PODS) rocket(w, e.x + px, e.y + py);
    if (k === 220) aimed(w, e.x, e.y + CHOPPER_GUN, 5, 0.18, 2.2, true);
  },
};

// ---------- stage 5: the lava serpent ----------

const SERPENT_SEGS = 8;

const serpentHead: EnemyDef = {
  name: 'serpentHead',
  sprite: 'mid/serpent_head',
  mid: 'LAVA SERPENT',
  hp: 90,
  score: 20000,
  r: 14,
  ground: false,
  big: true,
  update(e, w) {
    // It can only be hurt once its body is shot away; the body closes up as segments go.
    const segs = w.enemies.filter((s) => s.link === e && !s.dead).sort((a, b) => a.p[0] - b.p[0]);
    segs.forEach((s, i) => (s.p[1] = i));
    e.armored = segs.length > 0;
    if (e.t > MID_TIME) {
      e.p[5] = 1;
      moveTo(e, e.x, e.y + 2.5);
    } else {
      const enter = Math.min(1, e.t / 90);
      moveTo(e, W / 2 + Math.sin(e.t / 55) * 85 * enter, -30 + (100 + Math.sin(e.t / 37) * 35) * enter);
    }
    track(e);
    // It breathes fire at you now and then.
    const k = e.t % 110;
    if (e.t > 90 && k < 40 && k % 4 === 0) flame(w, e.x, e.y + 10, aimAt(w, e.x, e.y));
  },
};

const serpentBody = segment('serpentBody', 'mid/serpent_body', 22, false, (e, w) => {
  // Each segment spits a fireball in its turn.
  if ((e.t + e.p[0] * 15) % 120 === 0 && e.y > 10) aimed(w, e.x, e.y, 1, 0, 1.9, true);
});

// ---------- stage 6: the shield frigate ----------

/** The frigate's shield: its radius, and half the width of the gap that turns round it. */
export const SHIELD_R = 60;
export const SHIELD_GAP = 0.85;

/** Where the gap in the frigate's shield points now: 0 is straight down. */
export const shieldGap = (e: Enemy) => e.p[0] ?? 0;

const angleDiff = (a: number, b: number) => Math.abs(((a - b + Math.PI * 3) % (Math.PI * 2)) - Math.PI);

const frigate: EnemyDef = {
  name: 'frigate',
  sprite: 'mid/frigate',
  mid: 'SHIELD FRIGATE',
  hp: 210,
  score: 20000,
  r: 22,
  ground: false,
  big: true,
  update(e, w) {
    if (e.t > MID_TIME) {
      // Jumps away.
      w.whiteout = 4;
      return escape(e, w);
    }
    e.vy = (82 - e.y) * 0.04;
    e.vx = (W / 2 + Math.sin(e.t / 100) * 45 - e.x) * 0.03;
    // The shield turns; hurt, it turns faster and changes direction now and then.
    const angry = e.hp < (e.maxHp ?? e.hp) / 2;
    const dir = angry && Math.floor(e.t / 300) % 2 ? -1 : 1;
    e.p[0] = (e.p[0] ?? 0) + dir * (angry ? 0.02 : 0.012);
    if (e.y < 10) return;
    // It fires out through the gap, so facing the gap cuts both ways.
    if (e.t % 7 === 0 && canFire(w, e.x, e.y)) shoot(w, e.x + Math.sin(e.p[0]) * SHIELD_R, e.y + Math.cos(e.p[0]) * SHIELD_R, e.p[0], 2.0);
    if (e.t % 80 === 40) for (const dx of [-9.5, 9.5]) frost(w, e.x + dx, e.y + 34, aimAt(w, e.x + dx, e.y + 34), 1.6, 0.4);
    if (e.t % 180 === 120) ring(w, e.x, e.y, 14 + w.loop * 2, 1.2, e.t / 30);
  },
  blocks(e, x, y) {
    const d = Math.hypot(x - e.x, y - e.y);
    if (d > SHIELD_R + 3 || d < SHIELD_R - 10) return false;
    return angleDiff(Math.atan2(x - e.x, y - e.y), shieldGap(e)) > SHIELD_GAP;
  },
};

export const MIDS = { submarine, wormHead, wormBody, icebreaker, attackChopper, serpentHead, serpentBody, frigate };

// ---------- for the stage files ----------

type Run = (w: World) => void;

export const sub = (drop: ItemKind = 'weapon'): Run => (w) => {
  const e = w.spawn(submarine, W / 2, 90, [], drop);
  e.seen = true;
};

export const worm = (drop: ItemKind = 'bomb'): Run => (w) => {
  const h = chain(w, wormHead, wormBody, 7, 34, H + 30, [], drop);
  h.seen = true;
};

export const breaker = (drop: ItemKind = 'weapon'): Run => (w) => void w.spawn(icebreaker, W / 2, -60, [], drop);

export const gunChopper = (drop: ItemKind = 'missile'): Run => (w) => void w.spawn(attackChopper, W / 2, -40, [], drop);

export const serpent = (drop: ItemKind = 'weapon'): Run => (w) => {
  chain(w, serpentHead, serpentBody, SERPENT_SEGS, W / 2, -30, [], drop).seen = true;
};

export const shieldFrigate = (drop: ItemKind = 'missile'): Run => (w) => void w.spawn(frigate, W / 2, -50, [0], drop);
