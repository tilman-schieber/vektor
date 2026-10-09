// Stage 3: the arctic. Over the polar sea and its floes, across the pack ice and the snowfield,
// over the naval base and out to the anchorage, where the battleship lies.
import { Stage, Wave, dive, sweep, swoop, gun, cargo, tanks, pillbox, battery, scramble, heavy, swarm, ship, chopper, loops, cross, hatch, both } from './stage';
import { breaker } from './mid';
import { COLS, TILE, noise } from './terrain';
import { BATTLESHIP } from './boss';
import { ENEMIES } from './enemies';
import { W, H } from './draw';
import type { World } from './world';

const enum Level {
  Water = 0,
  Ice = 1,
  Snow = 2,
  Base = 3,
}

/** Centre column of the open lead through the pack ice at row j. */
const lead = (j: number) => COLS / 2 + Math.sin(j / 10) * 5;

// Rows where each part begins. The top of the screen shows row (dist + 320) / 16.
const PACK = 76;
const SNOW = 130;
const BASE = 215;
const ANCHORAGE = 280;

function profile(seed: number, x: number, j: number) {
  const n = noise(seed, x / 3.5, j / 3.5) * 0.7 + noise(seed + 1, x / 1.5, j / 1.5) * 0.3;
  const floe = noise(seed + 2, x / 4, j / 4) + n * 0.3;
  const sea = () => (floe > 0.82 ? Level.Snow : floe > 0.5 ? Level.Ice : Level.Water);
  if (j < PACK) return j < 14 ? Level.Water : sea();
  if (j < SNOW) {
    // Pack ice with a lead of open water winding through it.
    if (Math.abs(x - lead(j)) < 1.4 + Math.sin(j / 6) * 0.4) return Level.Water;
    return n > 0.45 ? Level.Snow : Level.Ice;
  }
  if (j < BASE + n * 4) return n < -0.45 ? Level.Ice : Level.Snow;
  if (j < ANCHORAGE - 8) return n > 0.6 ? Level.Snow : Level.Base;
  if (j < ANCHORAGE) return Level.Snow;
  return sea();
}

/** A destroyer coming down the open lead, wherever it winds. */
const leadShip = (w: World) => {
  const j = (w.dist + H + 34) / TILE;
  w.spawn(ENEMIES.destroyer, lead(j) * TILE, -34, [0.2, 0]);
};

const WAVES: Wave[] = [
  // Out on the polar sea, an icebreaker.
  { at: 440, run: breaker('laser') },
  // The polar sea.
  { at: 60, run: swarm(120) },
  { at: 200, run: ship(60) },
  { at: 260, run: dive(180, 5) },
  { at: 360, run: both(cargo(120), ship(190, 0.3)) },
  // The pack ice.
  { at: 960, run: leadShip },
  { at: 1040, run: both(sweep(true, 80), cargo(180, 'missile')) },
  { at: 1160, run: both(pillbox(40), pillbox(200)) },
  { at: 1240, run: leadShip },
  { at: 1300, run: swarm(120, 10, 40) },
  { at: 1440, run: both(swoop(70, 160), swoop(170, 160)) },
  { at: 1540, run: leadShip },
  { at: 1620, run: heavy(120, 'bomb') },
  // The snowfield.
  { at: 1800, run: both(tanks(40, 4), tanks(200, 4)) },
  { at: 1900, run: scramble(4, 60) },
  { at: 2000, run: both(battery(60), battery(180)) },
  { at: 2100, run: cargo(80, 'plasma') },
  { at: 2180, run: swarm(160, 8) },
  { at: 2220, run: both(chopper(200, 70), cross(2)) },
  { at: 2300, run: both(tanks(-12, 4, 0.6, 0, 100), dive(180, 5)) },
  { at: 2420, run: both(gun(70, 60), gun(170, 90)) },
  { at: 2600, run: both(pillbox(40), battery(120), pillbox(200)) },
  { at: 2700, run: swarm(80, 8) },
  { at: 2740, run: swarm(160, 8) },
  { at: 2880, run: heavy(120) },
  { at: 3000, run: scramble(5, 50) },
  // The naval base.
  { at: 3140, run: cargo(160, 'missile') },
  { at: 3220, run: both(battery(40), battery(120), battery(200)) },
  { at: 3340, run: both(tanks(-12, 4, 0.6, 0, 80), tanks(W + 12, 4, -0.6, 0, 150)) },
  { at: 3440, run: both(sweep(false, 70, 8), swarm(120, 8)) },
  { at: 3560, run: both(pillbox(60), pillbox(180)) },
  { at: 3640, run: both(gun(60, 70), gun(180, 70)) },
  { at: 3780, run: cargo(100) },
  { at: 3860, run: both(heavy(70), heavy(170)) },
  { at: 3980, run: both(battery(80), battery(160), scramble(3)) },
  // The anchorage.
  { at: 4160, run: both(ship(50, 0.3), ship(190, 0.3)) },
  { at: 4260, run: swarm(120, 10, 40) },
  { at: 4340, run: ship(120, 0.2) },
  { at: 4420, run: cargo(120, 'bomb') },
  // More variety: helicopters, aerobatics, hatches.
  { at: 1380, run: chopper(40, 90) },
  { at: 3300, run: hatch(60, 180) },
  { at: 3700, run: loops(60, 5, 130) },
];

export const STAGE3: Stage = {
  name: 'ARCTIC',
  length: 4600,
  waves: WAVES,
  ground: {
    sets: ['water_ice', 'ice_snow', 'snow_base'],
    colors: [
      ['#183858', '#204870', '#102840'],
      ['#a8d0e8', '#c0e0f0', '#90b8d8'],
      ['#f0f4f8', '#ffffff', '#d8e0e8'],
      ['#4a4e54', '#5a5e64', '#d8d8d8'],
    ],
    water: true,
    profile,
    decor: { level: Level.Base, props: 'decor/arctic_', density: 13, markings: true },
  },
  boss: BATTLESHIP,
  key: 0,
};
