// Stage 5: the volcano. Over the basalt fields and their lava lake, along the lava rivers, across
// the ash plains and into the crater, where the fortress sits.
import { Stage, Wave, dive, sweep, swoop, gun, cargo, tanks, scramble, heavy, swarm, chopper, loops, cross, both } from './stage';
import { serpent } from './mid';
import { COLS, TILE, noise } from './terrain';
import { CRATER } from './boss';
import { ENEMIES } from './enemies';
import { H } from './draw';
import type { World } from './world';

const enum Level {
  Lava = 0,
  Basalt = 1,
  Ash = 2,
  Fortress = 3,
}

// Rows where each part begins. The top of the screen shows row (dist + 320) / 16.
const RIVERS = 76;
const ASH = 152;
const FORTRESS = 216;

/** The lava lake in the basalt fields: centre column and row, radius in tiles. */
const LAKE = { x: 7.5, j: 40, r: 3.6 };
/** Centre columns of the two lava rivers at row j. */
const river = [(j: number) => COLS / 2 - 3.5 + Math.sin(j / 9) * 3, (j: number) => COLS / 2 + 4 + Math.sin(j / 7 + 1) * 2.5];

function profile(seed: number, x: number, j: number) {
  const n = noise(seed, x / 3.5, j / 3.5) * 0.7 + noise(seed + 1, x / 1.5, j / 1.5) * 0.3;
  if (j < RIVERS) {
    if (Math.hypot(x - LAKE.x, (j - LAKE.j) * 0.8) < LAKE.r + n) return Level.Lava;
    const pool = noise(seed + 2, x / 3, j / 3) + n * 0.3;
    if (j > 12 && pool > 0.62) return Level.Lava;
    return n > 0.5 ? Level.Ash : Level.Basalt;
  }
  if (j < ASH) {
    if (river.some((f) => Math.abs(x - f(j)) < 1.6 + Math.sin(j / 5) * 0.3)) return Level.Lava;
    return n > 0.55 ? Level.Ash : Level.Basalt;
  }
  if (j < FORTRESS + n * 4) {
    // A fissure of lava cuts across the ash on a slant.
    if (j > 178 && j < 196 && Math.abs(j - (187 + (x - COLS / 2) * 0.7)) < 1.5) return Level.Lava;
    return n < -0.4 ? Level.Basalt : Level.Ash;
  }
  return n > 0.55 ? Level.Ash : Level.Fortress;
}

const { lavaboat, magmaTurret, silo } = ENEMIES;

/** The screen x of river k where it enters at the top. */
const riverX = (w: World, k: number, ahead = 30) => river[k]((w.dist + H + ahead) / TILE) * TILE;

/** A lava boat coming down river k. */
const boat = (k: number) => (w: World) => void w.spawn(lavaboat, riverX(w, k, 22), -22, [0.2, 0]);

/** Magma turrets in the lava: in river k (one after another), or in the lake when k is -1. */
const magma = (k: number, n = 2) => (w: World) => {
  if (k < 0) {
    // Placed in the lake itself, wherever it is on the map right now.
    const y = H - (LAKE.j * TILE - w.dist);
    for (let i = 0; i < n; i++) w.spawn(magmaTurret, LAKE.x * TILE + (i % 2 ? 26 : -26), y + (i >> 1) * 24 - 12, [i * 60]);
    return;
  }
  for (let i = 0; i < n; i++) w.after(i * 50, () => void w.spawn(magmaTurret, riverX(w, k, 14), -14, [i * 60]));
};

/** Missile silos at these columns, out of step with each other; the last carries a medal. */
const silos = (...xs: number[]) => (w: World) =>
  xs.forEach((x, k) => void w.spawn(silo, x, -18, [k * 80], k === xs.length - 1 ? 'medal' : undefined));

const WAVES: Wave[] = [
  // Out of the lava rivers, a serpent.
  { at: 1760, run: serpent() },
  // The basalt fields and the lava lake.
  { at: 60, run: dive(60, 5) },
  { at: 200, run: magma(-1, 4) },
  { at: 240, run: both(cargo(180), sweep(false, 80)) },
  { at: 460, run: silos(40, 200) },
  { at: 560, run: both(chopper(200, 80), loops(60, 4, 120)) },
  { at: 700, run: gun(120, 70) },
  { at: 820, run: scramble(3) },
  // The lava rivers.
  { at: 960, run: both(boat(0), boat(1)) },
  { at: 1060, run: magma(0, 3) },
  { at: 1140, run: cargo(120, 'missile') },
  { at: 1220, run: both(magma(1, 2), cross(2)) },
  { at: 1340, run: both(boat(0), silos(120)) },
  { at: 1460, run: swarm(120, 8) },
  { at: 1560, run: both(boat(1), magma(0, 2)) },
  { at: 1660, run: heavy(120, 'bomb') },
  // The ash plains.
  { at: 2280, run: silos(60, 180) },
  { at: 2380, run: scramble(4, 60) },
  { at: 2480, run: cargo(80, 'laser') },
  { at: 2560, run: both(heavy(70), heavy(170)) },
  { at: 2700, run: both(silos(40, 120, 200), swoop(120, 160)) },
  { at: 2840, run: loops(180, 5, 110) },
  { at: 2960, run: both(gun(60, 60), gun(180, 90)) },
  { at: 3120, run: both(tanks(-12, 4, 0.6, 0, 90), chopper(200, 70)) },
  { at: 3260, run: swarm(80, 8) },
  { at: 3300, run: swarm(160, 8) },
  // The crater fortress.
  { at: 3440, run: cargo(160, 'plasma') },
  { at: 3520, run: silos(40, 120, 200) },
  { at: 3660, run: both(heavy(120), scramble(3)) },
  { at: 3800, run: both(silos(60, 180), cross(3)) },
  { at: 3940, run: cargo(100, 'missile') },
  { at: 4040, run: both(chopper(40, 80), chopper(200, 110), dive(120, 5)) },
  { at: 4180, run: both(gun(70, 70), gun(170, 70)) },
  { at: 4320, run: silos(40, 200) },
  { at: 4420, run: cargo(120, 'bomb') },
];

export const STAGE5: Stage = {
  name: 'VOLCANO',
  length: 4600,
  waves: WAVES,
  ground: {
    sets: ['lava_basalt', 'basalt_ash', 'ash_fortress'],
    colors: [
      ['#e85810', '#f89020', '#c03808'],
      ['#2a2426', '#342e30', '#201c1e'],
      ['#6a6662', '#7a7672', '#5a5652'],
      ['#3a1c1c', '#4a2222', '#f87820'],
    ],
    water: false,
    lava: true,
    ash: true,
    profile,
    decor: { level: Level.Ash, props: 'decor/volcano_', density: 9, markings: false },
  },
  boss: CRATER,
  key: 0,
};
