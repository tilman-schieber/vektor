// Stage 1: over the ocean, across the beach, up a jungle river, into the base. The flying
// fortress waits at the end.
import { Stage, Wave, dive, sweep, swoop, gun, cargo, tanks, pillbox, chopper, loops, cross, hatch, both } from './stage';
import { COLS, noise } from './terrain';
import { FORTRESS } from './boss';
import { W } from './draw';

const enum Level {
  Ocean = 0,
  Sand = 1,
  Jungle = 2,
  Base = 3,
}

function profile(seed: number, x: number, j: number) {
  const n = noise(seed, x / 3.5, j / 3.5) * 0.7 + noise(seed + 1, x / 1.5, j / 1.5) * 0.3;
  if (j < 52) {
    // Islands: broad low-frequency blobs, sand rings round a jungle middle.
    const isle = noise(seed + 2, x / 5, j / 5) + n * 0.25;
    if (j < 16 || isle < 0.45) return Level.Ocean;
    return isle > 0.75 ? Level.Jungle : Level.Sand;
  }
  // The coast comes in on a slant.
  const coast = 60 + Math.sin(x / 3) * 3 + (x - COLS / 2) * 0.7;
  if (j < coast) return Level.Ocean;
  if (j < 100) return j > 88 + n * 6 ? Level.Jungle : Level.Sand;
  if (j < 205) {
    // A river winds through the jungle.
    const river = COLS / 2 + Math.sin(j / 9) * 4.5;
    if (j > 122 && j < 172 && Math.abs(x - river) < 1.3) return Level.Ocean;
    return n < -0.45 ? Level.Sand : Level.Jungle;
  }
  if (j < 212 + n * 4) return Level.Jungle;
  return n > 0.6 ? Level.Jungle : Level.Base;
}

const WAVES: Wave[] = [
  // Open sea.
  { at: 60, run: dive(60) },
  { at: 160, run: dive(180) },
  { at: 260, run: sweep(true, 80) },
  { at: 330, run: cargo(120) },
  { at: 420, run: swoop(120, 140) },
  { at: 520, run: sweep(false, 60) },
  { at: 600, run: both(dive(40, 4), dive(200, 4)) },
  { at: 700, run: gun(120) },
  { at: 860, run: swoop(70, 160) },
  { at: 900, run: swoop(170, 160) },
  // The coast.
  { at: 1000, run: both(tanks(40, 3), cargo(190, 'missile')) },
  { at: 1080, run: sweep(true, 100) },
  { at: 1140, run: tanks(200, 3) },
  { at: 1200, run: both(pillbox(70), pillbox(170)) },
  { at: 1280, run: dive(120, 6, 10) },
  { at: 1380, run: tanks(-12, 4, 0.6, 0, 120) },
  { at: 1470, run: gun(120, 70) },
  { at: 1560, run: both(pillbox(40), pillbox(120), pillbox(200)) },
  // Jungle and the river.
  { at: 1700, run: both(swoop(60, 120), swoop(180, 120)) },
  { at: 1780, run: cargo(60) },
  { at: 1860, run: both(tanks(30, 4), tanks(210, 4)) },
  { at: 1980, run: sweep(false, 90, 8) },
  { at: 2060, run: pillbox(120) },
  { at: 2120, run: dive(80, 5) },
  { at: 2160, run: dive(160, 5) },
  { at: 2260, run: gun(120, 70, 'bomb') },
  { at: 2400, run: both(tanks(W + 12, 4, -0.6, 0, 80), sweep(true, 120)) },
  { at: 2500, run: both(pillbox(50), pillbox(190)) },
  { at: 2580, run: cargo(160) },
  { at: 2660, run: both(swoop(120, 180), dive(30, 4), dive(210, 4)) },
  { at: 2800, run: gun(120, 70) },
  { at: 2960, run: tanks(120, 5) },
  { at: 3040, run: sweep(true, 70, 8) },
  { at: 3100, run: sweep(false, 110, 8) },
  { at: 3200, run: both(pillbox(30), pillbox(90), pillbox(150), pillbox(210)) },
  // The base.
  { at: 3360, run: cargo(100, 'medal') },
  { at: 3420, run: both(tanks(40, 3), tanks(200, 3)) },
  { at: 3500, run: both(pillbox(60), pillbox(180), swoop(120, 140)) },
  { at: 3600, run: gun(120, 60) },
  { at: 3700, run: both(pillbox(40), pillbox(120), pillbox(200)) },
  { at: 3780, run: both(dive(50, 6, 8), dive(190, 6, 8)) },
  { at: 3880, run: cargo(140, 'medal') },
  { at: 3960, run: both(tanks(-12, 4, 0.6, 0, 100), tanks(W + 12, 4, -0.6, 0, 160)) },
  { at: 4060, run: both(pillbox(80), pillbox(160)) },
  { at: 4140, run: both(gun(70, 70), gun(170, 70)) },
  { at: 4300, run: both(swoop(80, 150), swoop(160, 150)) },
  { at: 4400, run: cargo(120, 'bomb') },
  // More variety: helicopters, aerobatics, hatches.
  { at: 560, run: loops(60, 4, 110) },
  { at: 1120, run: chopper(200, 90) },
  { at: 1940, run: chopper(40, 80) },
  { at: 2340, run: cross(3) },
  { at: 3060, run: loops(180, 4, 130) },
  { at: 3640, run: hatch(40, 200) },
  { at: 4220, run: chopper(120, 80, 'medal') },
];

export const STAGE1: Stage = {
  name: 'COAST',
  length: 4600,
  waves: WAVES,
  ground: {
    sets: ['ocean_beach', 'beach_jungle', 'jungle_base'],
    colors: [
      ['#1050a0', '#1860b8', '#0c4890'],
      ['#d8b878', '#e4c890', '#c8a868'],
      ['#2c7a28', '#3a8c30', '#226a20'],
      ['#787c80', '#888c90', '#6c7074'],
    ],
    water: true,
    profile,
  },
  boss: FORTRESS,
  key: 0,
};
