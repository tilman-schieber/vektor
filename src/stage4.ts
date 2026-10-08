// Stage 4: a ruined city at night. Over the outskirts and downtown, across the river, past the
// power plant and up the boulevard, where the walker comes stomping.
import { Stage, Wave, dive, sweep, swoop, gun, cargo, tanks, scramble, heavy, swarm, chopper, hatch, loops, cross, both } from './stage';
import { gunChopper } from './mid';
import { COLS, TILE, noise, Terrain } from './terrain';
import { WALKER } from './boss';
import { ENEMIES } from './enemies';
import { W, hash } from './draw';
import type { World } from './world';

const enum Level {
  River = 0,
  Street = 1,
  Roof = 2,
  Plant = 3,
}

/** The railway runs down this corner column, between these rows. */
const RAIL_COL = 5;
const RAIL_FROM = 40;
const RAIL_TO = 250;
// Rows where each part begins. The top of the screen shows row (dist + 320) / 16.
const DOWNTOWN = 70;
const PLANT = 186;
const BOULEVARD = 256;

function profile(seed: number, x: number, j: number) {
  const n = noise(seed, x / 3.5, j / 3.5) * 0.7 + noise(seed + 1, x / 1.5, j / 1.5) * 0.3;
  // The railway keeps a clear corridor, and crosses the river on its own causeway.
  if (j >= RAIL_FROM && j < RAIL_TO && Math.abs(x - RAIL_COL) <= 1) return Level.Street;
  // The river comes through on a slant.
  if (j > 140 && j < 192 && Math.abs(j - (162 + (x - COLS / 2) * 0.9)) < 3.2) return Level.River;
  if (j >= PLANT + n * 3 && j < BOULEVARD - 6) return n > 0.55 ? Level.Roof : Level.Plant;
  // City blocks: streets on a grid, roofs inside.
  if (x % 5 === 0 || j % 6 === 0) return Level.Street;
  const block = hash(Math.floor(x / 5) * 31 + Math.floor(j / 6) * 977 + seed) % 100;
  if (j < DOWNTOWN) return block < 45 && n > -0.25 ? Level.Roof : Level.Street; // ruins, half gone
  if (j >= BOULEVARD) return (x < 4 || x > 11) && block < 85 ? Level.Roof : Level.Street;
  return block < 88 ? Level.Roof : Level.Street;
}

/**
 * Night detail the tiles lack: dashed lane lines down the middle of the streets, street lamps,
 * and lit windows on the flat roofs.
 */
function paint(g: CanvasRenderingContext2D, t: Terrain, r: number) {
  const railRow = r >= RAIL_FROM && r < RAIL_TO;
  for (let c = 0; c <= COLS; c += 5) {
    if (railRow && Math.abs(c - RAIL_COL) <= 1) continue;
    if (t.at(c, r) !== Level.Street || t.at(c, r + 1) !== Level.Street) continue;
    const x = c * TILE;
    g.fillStyle = '#b89838';
    for (let y = 0; y < TILE; y++) if ((r * TILE + TILE - y) % 10 < 5) g.fillRect(x, y, 1, 1);
    // A street lamp every third block of street, alternating sides.
    if (r % 3 === 0) {
      const lx = x + (r % 2 ? 6 : -7);
      g.fillStyle = 'rgba(255,214,120,0.35)';
      g.fillRect(lx - 2, 6, 5, 5);
      g.fillStyle = '#ffe8a0';
      g.fillRect(lx, 8, 1, 1);
    }
  }
  // Cross streets: a dashed line along the grid row.
  if (r % 6 === 0)
    for (let i = 0; i < COLS; i++) {
      if (t.at(i, r) !== Level.Street || t.at(i + 1, r) !== Level.Street) continue;
      g.fillStyle = '#b89838';
      for (let x = 0; x < TILE; x++) if ((i * TILE + x) % 10 < 5) g.fillRect(i * TILE + x, TILE - 1, 1, 1);
    }
  // Lit windows and skylights on flat roofs.
  for (let i = 0; i < COLS; i++) {
    if ([t.at(i, r), t.at(i + 1, r), t.at(i, r + 1), t.at(i + 1, r + 1)].some((v) => v !== Level.Roof)) continue;
    const h = hash(r * 4099 + i * 131);
    if (h % 3 === 0) continue;
    for (let k = 0; k < 3; k++) {
      const q = hash(h + k);
      if (q % 2) continue;
      g.fillStyle = q % 7 === 0 ? '#ffb040' : '#f0d070';
      g.fillRect(i * TILE + 2 + (q >>> 3) % 11, 2 + (q >>> 9) % 12, 2 + ((q >>> 15) & 1), 1);
    }
  }
}

const { trainEngine, trainCar } = ENEMIES;

/**
 * Pop-up turrets on the rooftops near these columns, each a little out of step with the last.
 * They snap to the middle of a block (blocks are 5 tiles wide, starting at x 0).
 */
const hatches = (...xs: number[]) => hatch(...new Set(xs.map((x) => 40 + 80 * Math.max(0, Math.min(2, Math.round((x - 40) / 80))))));

/** An armoured train down the railway: the engine and n gun cars. */
const train = (cars: number, speed = 0.45) => (w: World) => {
  const x = RAIL_COL * 16;
  w.spawn(trainEngine, x, -22, [speed]);
  for (let k = 1; k <= cars; k++) w.spawn(trainCar, x, -22 - k * 40, [speed, k], k === cars ? 'medal' : undefined);
};

const WAVES: Wave[] = [
  // Downtown, a heavy attack helicopter.
  { at: 2040, run: gunChopper() },
  // The outskirts.
  { at: 60, run: chopper(170, 70) },
  { at: 160, run: dive(60, 5) },
  { at: 260, run: both(cargo(160), chopper(50, 100)) },
  { at: 380, run: hatches(150, 200) },
  { at: 460, run: train(3) },
  { at: 600, run: swoop(160, 150) },
  { at: 700, run: both(chopper(30, 60), chopper(210, 90)) },
  { at: 820, run: gun(150, 70) },
  // Downtown.
  { at: 960, run: hatches(40, 120, 200) },
  { at: 1060, run: scramble(3) },
  { at: 1160, run: train(4) },
  { at: 1240, run: cargo(160, 'missile') },
  { at: 1320, run: both(sweep(true, 70), chopper(200, 110)) },
  { at: 1440, run: hatches(120, 180) },
  { at: 1540, run: swarm(160, 8) },
  { at: 1660, run: heavy(150, 'bomb') },
  { at: 1780, run: both(hatches(40, 200), chopper(120, 60)) },
  { at: 1900, run: train(5, 0.55) },
  // The river.
  { at: 2300, run: cargo(150) },
  // The power plant.
  { at: 2560, run: both(tanks(160, 3), tanks(220, 3)) },
  { at: 2660, run: train(4) },
  { at: 2760, run: both(hatches(140, 200), swarm(120, 8)) },
  { at: 2900, run: both(heavy(100), heavy(190)) },
  { at: 3040, run: both(chopper(30, 70), chopper(210, 100), sweep(false, 120, 6)) },
  { at: 3180, run: cargo(120, 'missile') },
  { at: 3260, run: train(6, 0.6) },
  { at: 3400, run: both(hatches(120, 170, 220), scramble(4, 60)) },
  { at: 3560, run: both(gun(70, 60), gun(180, 80)) },
  // The boulevard.
  { at: 3760, run: both(hatches(30, 210), chopper(120, 70)) },
  { at: 3880, run: both(tanks(-12, 4, 0.6, 0, 90), tanks(W + 12, 4, -0.6, 0, 150)) },
  { at: 4000, run: swarm(120, 10, 40) },
  { at: 4120, run: both(chopper(40, 80), chopper(200, 110)) },
  { at: 4260, run: both(hatches(30, 210), dive(120, 6, 10)) },
  { at: 4400, run: cargo(120, 'bomb') },
  // More variety: helicopters, aerobatics, hatches.
  { at: 540, run: loops(60, 4, 120) },
  { at: 1600, run: cross(3) },
  { at: 3700, run: cross(3) },
];

export const STAGE4: Stage = {
  name: 'NIGHT CITY',
  length: 4600,
  waves: WAVES,
  ground: {
    sets: ['river_street', 'street_roof', 'roof_plant'],
    colors: [
      ['#101830', '#182440', '#c8a848'],
      ['#262830', '#30323a', '#5a5040'],
      ['#1a1c28', '#22242e', '#e8c860'],
      ['#202830', '#283038', '#38d8e8'],
    ],
    water: false,
    profile,
    decor: { level: Level.Roof, props: 'decor/city_', density: 16, markings: false },
    rails: [{ col: RAIL_COL, from: RAIL_FROM, to: RAIL_TO }],
    night: true,
    paint,
  },
  boss: WALKER,
  key: 0,
};
