// Stage 2: across the dunes, through the canyons of the mesas, over the refinery. The desert
// crawler waits at the end.
import { Stage, Wave, dive, sweep, swoop, gun, cargo, tanks, pillbox, battery, scramble, heavy, both } from './stage';
import { COLS, TILE, noise } from './terrain';
import { CRAWLER } from './boss';
import { ENEMIES } from './enemies';
import { W, H } from './draw';
import type { World } from './world';

const enum Level {
  Dunes = 0,
  Rock = 1,
  Refinery = 2,
}

/** Centre column of the main canyon at row j. */
const canyon = (j: number) => COLS / 2 + Math.sin(j / 11) * 4.5;

function profile(seed: number, x: number, j: number) {
  const n = noise(seed, x / 3.5, j / 3.5) * 0.7 + noise(seed + 1, x / 1.5, j / 1.5) * 0.3;
  if (j < 80) {
    // Dunes, with rock outcrops that crowd in toward the mesas.
    const blob = noise(seed + 2, x / 4, j / 4) + n * 0.3;
    const need = j < 64 ? 0.55 : 0.55 - ((j - 64) / 16) * 1.2;
    return j > 12 && blob > need ? Level.Rock : Level.Dunes;
  }
  if (j < 206 + n * 4) {
    // Mesas, cut by a winding canyon; a side canyon branches off for a while.
    const width = 1.8 + Math.sin(j / 7) * 0.6;
    if (Math.abs(x - canyon(j)) < width) return Level.Dunes;
    if (j > 130 && j < 172 && Math.abs(x - (COLS / 2 - Math.sin(j / 8) * 5)) < 1.3) return Level.Dunes;
    return n < -0.5 ? Level.Dunes : Level.Rock;
  }
  return n > 0.6 ? Level.Rock : Level.Refinery;
}

/** Tanks rolling down the canyon floor, wherever it winds. */
const canyonTanks = (n: number) => (w: World) => {
  for (let k = 0; k < n; k++)
    w.after(k * 34, () => {
      const j = (w.dist + H + 14) / TILE;
      w.spawn(ENEMIES.tank, canyon(j) * TILE, -14, [0, 0.25]);
    });
};

const WAVES: Wave[] = [
  // The dunes.
  { at: 60, run: dive(120, 5) },
  { at: 180, run: scramble(3) },
  { at: 300, run: both(sweep(true, 70), cargo(180)) },
  { at: 420, run: tanks(-12, 4, 0.6, 0, 110) },
  { at: 520, run: scramble(4, 60) },
  { at: 640, run: both(swoop(70, 150), swoop(170, 150)) },
  { at: 780, run: heavy(120, 'missile') },
  { at: 960, run: both(battery(50), battery(190)) },
  // The mesas and their canyons.
  { at: 1080, run: canyonTanks(4) },
  { at: 1160, run: scramble(3) },
  { at: 1260, run: both(battery(30), battery(210)) },
  { at: 1360, run: cargo(120) },
  { at: 1440, run: both(dive(50, 4), dive(190, 4)) },
  { at: 1560, run: gun(120, 70) },
  { at: 1700, run: canyonTanks(5) },
  { at: 1780, run: both(battery(40), pillbox(200)) },
  { at: 1880, run: scramble(5, 50) },
  { at: 2000, run: sweep(false, 90, 8) },
  { at: 2080, run: heavy(70) },
  { at: 2100, run: heavy(170, 'bomb') },
  { at: 2300, run: both(battery(60), battery(180), canyonTanks(3)) },
  { at: 2420, run: cargo(60) },
  { at: 2520, run: both(swoop(120, 170), scramble(3)) },
  { at: 2660, run: both(gun(60, 60), gun(180, 90)) },
  { at: 2860, run: canyonTanks(6) },
  { at: 2960, run: both(battery(30), battery(120), battery(210)) },
  { at: 3100, run: scramble(5, 60) },
  // The refinery.
  { at: 3280, run: cargo(140, 'missile') },
  { at: 3360, run: both(pillbox(40), pillbox(200), battery(120)) },
  { at: 3480, run: heavy(120) },
  { at: 3600, run: both(dive(40, 5), dive(200, 5)) },
  { at: 3700, run: both(battery(70), battery(170)) },
  { at: 3800, run: both(tanks(-12, 4, 0.6, 0, 90), tanks(W + 12, 4, -0.6, 0, 150)) },
  { at: 3900, run: cargo(100) },
  { at: 3980, run: both(gun(70, 70), scramble(3)) },
  { at: 4100, run: both(pillbox(40), battery(120), pillbox(200)) },
  { at: 4220, run: both(heavy(60), heavy(180)) },
  { at: 4400, run: cargo(120, 'bomb') },
];

export const STAGE2: Stage = {
  name: 'DESERT',
  length: 4600,
  waves: WAVES,
  ground: {
    sets: ['desert_rock', 'rock_metal'],
    colors: [
      ['#d89850', '#e8b068', '#c08040'],
      ['#6a4a30', '#7a5a3a', '#5a3c26'],
      ['#6a6a70', '#7a7a80', '#d8b800'],
    ],
    water: false,
    profile,
  },
  boss: CRAWLER,
  key: 3,
};
