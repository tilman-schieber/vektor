// Stage 6: up out of the atmosphere into orbit. Open space with nebulae and a gas giant far off
// (drawn behind, see drawSpace), a field of drifting asteroids, the defence ring with its laser
// fences, and the station, where the mothership waits.
import { Stage, Wave, cargo, scramble, swarm, hatch, both } from './stage';
import { shieldFrigate } from './mid';
import type { World } from './world';
import { ENEMIES } from './enemies';
import { MOTHERSHIP } from './boss';
import { W } from './draw';

const enum Level {
  Space = 0,
  Hull = 1,
}

/** Tile row where the station begins. */
const STATION = 214;

/** Nothing but space, until the station: a docking spine, then wide modules joined by narrower links. */
function profile(_seed: number, x: number, j: number) {
  if (j < STATION) return Level.Space;
  const d = Math.abs(x - 7.5), m = j - STATION;
  if (m < 6) return d < 1.6 ? Level.Hull : Level.Space;
  return d < (m % 18 < 13 ? 6 : 3.4) ? Level.Hull : Level.Space;
}

type Run = (w: World) => void;
const { raider, asteroidBig, asteroidMid, mine, stealth, gravity, satellite, hangar } = ENEMIES;

/** n raiders diving one after another down column x. */
const dive = (x: number, n = 5, gap = 12): Run => (w) => {
  for (let k = 0; k < n; k++) w.after(k * gap, () => w.spawn(raider, x, -12, [0, 0, k * 4]));
};

/** A line of raiders sweeping in from one side at height y. */
const sweep = (fromLeft: boolean, y: number, n = 6): Run => (w) => {
  for (let k = 0; k < n; k++) w.after(k * 10, () => w.spawn(raider, fromLeft ? -12 : W + 12, y, [1, y, k * 3]));
};

/** A V of raiders that dive to row `turn` and climb away again. */
const swoop = (cx: number, turn: number): Run => (w) => {
  [0, -18, 18, -36, 36].forEach((dx, k) => w.after(k * 6, () => w.spawn(raider, cx + dx, -12, [2, turn, k * 5])));
};

/** An asteroid of size big or mid drifting in at column x, with sideways drift vx. */
const rock = (x: number, big = true, vx = 0, vy = 0.7): Run => (w) => void w.spawn(big ? asteroidBig : asteroidMid, x, -24, [vx, vy]);

/** A shower of mid-size asteroids across the screen, a little apart in time. */
const shower = (n: number, seed: number): Run => (w) => {
  for (let k = 0; k < n; k++) {
    const x = 20 + ((seed * 37 + k * 71) % (W - 40));
    w.after(k * 16, () => w.spawn(asteroidMid, x, -16, [((k % 3) - 1) * 0.3, 0.9 + (k % 2) * 0.3]));
  }
};

const mines = (...xs: number[]): Run => (w) => xs.forEach((x, k) => w.after(k * 10, () => w.spawn(mine, x, -10, [])));

/** A stealth fighter coming in cloaked at column x, showing itself at row `row`, leaving toward `dir`. */
const cloak = (x: number, row = 90, dir = x < W / 2 ? 1 : -1): Run => (w) => void w.spawn(stealth, x, -14, [row, dir * 0.8]);

const well = (x: number, row = 80): Run => (w) => void w.spawn(gravity, x, -18, [row]);

/**
 * A pair of satellites with a laser fence between them, turning round (cx, top) at `spin` radians
 * a frame, `radius` apart from the middle. The first sits at angle a0 (0..π/2), the second opposite.
 */
const fence = (cx: number, radius: number, a0 = 0, spin = 0.008): Run => (w) => {
  const a = w.spawn(satellite, cx + Math.cos(a0) * radius, -20, [cx, -20, radius, a0, spin]);
  const b = w.spawn(satellite, cx - Math.cos(a0) * radius, -20, [cx, -20, radius, a0 + Math.PI, spin]);
  a.link = b;
  b.link = a;
};

/** Hangars in the station hull at these columns, each a little out of step with the last. */
const hangars = (...xs: number[]): Run => (w) => xs.forEach((x, k) => void w.spawn(hangar, x, -18, [k * 70], 'medal'));

const WAVES: Wave[] = [
  // Between the debris field and the ring, a frigate behind its shield.
  { at: 2420, run: shieldFrigate() },
  // Open space.
  { at: 60, run: dive(80) },
  { at: 150, run: dive(160) },
  { at: 240, run: cargo(120) },
  { at: 330, run: sweep(true, 80) },
  { at: 440, run: cloak(70) },
  { at: 500, run: cloak(170, 110) },
  { at: 600, run: swarm(120) },
  { at: 720, run: both(cargo(60, 'missile'), sweep(false, 70)) },
  { at: 820, run: mines(40, 120, 200) },
  { at: 920, run: well(120) },
  { at: 1020, run: both(swoop(70, 150), swoop(170, 150)) },
  // The debris field.
  { at: 1120, run: rock(70) },
  { at: 1180, run: rock(180, true, -0.2) },
  { at: 1260, run: shower(5, 1) },
  { at: 1360, run: both(dive(40, 4), dive(200, 4)) },
  { at: 1440, run: both(rock(120, true, 0, 0.6), mines(30, 210)) },
  { at: 1540, run: cargo(160) },
  { at: 1620, run: shower(7, 2) },
  { at: 1720, run: scramble(3) },
  { at: 1800, run: both(well(60, 70), rock(190, false, -0.3)) },
  { at: 1920, run: both(cloak(50), cloak(190)) },
  { at: 2020, run: both(rock(40, true, 0.3), rock(200, true, -0.3)) },
  { at: 2120, run: cargo(80, 'missile') },
  { at: 2200, run: swarm(120, 10) },
  { at: 2320, run: shower(8, 3) },
  // The defence ring.
  { at: 2920, run: fence(120, 90, 0, 0.006) },
  { at: 3020, run: cargo(160, 'bomb') },
  { at: 3100, run: both(mines(60, 180), well(120, 70)) },
  { at: 3200, run: fence(120, 60, 1.5, 0.016) },
  { at: 3300, run: scramble(4, 60) },
  // The station.
  { at: 3480, run: hangars(80, 160) },
  { at: 3560, run: dive(120, 6, 10) },
  { at: 3640, run: hatch(84, 156) },
  { at: 3720, run: cargo(120) },
  { at: 3800, run: hangars(60, 120, 180) },
  { at: 3900, run: both(cloak(60, 80), cloak(180, 80)) },
  { at: 3980, run: well(120, 70) },
  { at: 4080, run: hatch(90, 150) },
  { at: 4160, run: both(swoop(80, 160), swoop(160, 160)) },
  { at: 4260, run: hangars(70, 170) },
  { at: 4360, run: both(fence(120, 70, 0.3, 0.01), mines(40, 200)) },
  { at: 4460, run: cargo(120, 'bomb') },
  { at: 4560, run: scramble(5, 50) },
];

export const STAGE6: Stage = {
  name: 'ORBIT',
  length: 4800,
  waves: WAVES,
  ground: {
    sets: ['space_hull'],
    colors: [
      ['#04040c', '#080818', '#020208'],
      ['#7c8494', '#9098a8', '#5c6474'],
    ],
    water: false,
    space: true,
    profile,
    decor: { level: Level.Hull, props: 'decor/orbit_', density: 6, markings: false },
  },
  boss: MOTHERSHIP,
  key: 0,
};
