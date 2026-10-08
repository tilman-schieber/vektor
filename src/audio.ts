// Tiny Web Audio chiptune synth: SFX, a driving stage tune and a boss tune.
import { makeRng } from './rng';

let ctx: AudioContext | null = null;
let master: GainNode;
let noiseBuf: AudioBuffer;

export function unlockAudio() {
  // iOS: play through the silent switch like a media app (Safari 16.4+).
  const session = (navigator as { audioSession?: { type: string } }).audioSession;
  if (session && session.type !== 'playback') session.type = 'playback';
  if (!ctx) {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = 0.2;
    master.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') void ctx.resume();
}

export const midiHz = (m: number) => 440 * 2 ** ((m - 69) / 12);

function tone(freq: number, dur: number, type: OscillatorType, vol: number, at = 0, slideTo?: number) {
  if (!ctx) return;
  const t = at || ctx.currentTime;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.setValueAtTime(vol, t + dur * 0.7);
  g.gain.linearRampToValueAtTime(0, t + dur);
  osc.connect(g).connect(master);
  osc.start(t);
  osc.stop(t + dur + 0.01);
}

function noise(dur: number, vol: number, cutoff: number, at = 0, type: BiquadFilterType = 'lowpass', sweepTo?: number) {
  if (!ctx) return;
  const t = at || ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.setValueAtTime(cutoff, t);
  if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t, Math.random() * 0.5);
  src.stop(t + dur);
}

function arp(notes: number[], step: number, vol = 0.25, type: OscillatorType = 'square') {
  if (!ctx) return;
  const t = ctx.currentTime;
  notes.forEach((n, i) => n && tone(midiHz(n), step, type, vol, t + i * step));
}

/** Skips a sound already played this many seconds ago, so rapid fire doesn't pile up. */
const last: Record<string, number> = {};
function every(key: string, gap: number) {
  if (!ctx) return false;
  if (ctx.currentTime - (last[key] ?? -1) < gap) return false;
  last[key] = ctx.currentTime;
  return true;
}

export const sfx = {
  move: () => tone(1400, 0.02, 'square', 0.12),
  select: () => tone(988, 0.04, 'square', 0.18),
  start: () => arp([60, 67, 72, 0, 72, 75, 79, 84], 0.06, 0.2),
  pause: () => arp([84, 79], 0.06, 0.18),
  vulcan: () => every('vulcan', 0.07) && noise(0.04, 0.12, 3000, 0, 'bandpass'),
  laser: () => every('laser', 0.06) && tone(1800, 0.05, 'sawtooth', 0.04, 0, 1200),
  missile: () => every('missile', 0.1) && noise(0.12, 0.1, 1200, 0, 'bandpass', 400),
  hit: () => every('hit', 0.05) && tone(240, 0.03, 'square', 0.08, 0, 160),
  enemyShot: () => every('eshot', 0.08) && tone(900, 0.05, 'triangle', 0.06, 0, 500),
  boom: () => {
    if (!every('boom', 0.04)) return;
    noise(0.35, 0.45, 2200, 0, 'lowpass', 120);
    tone(140, 0.2, 'square', 0.12, 0, 40);
  },
  bigBoom: () => {
    noise(0.9, 0.7, 3000, 0, 'lowpass', 60);
    tone(90, 0.6, 'sawtooth', 0.2, 0, 25);
  },
  die: () => {
    if (!ctx) return;
    noise(1.2, 0.7, 4000, 0, 'lowpass', 80);
    for (let k = 0; k < 6; k++) tone(600 - k * 80, 0.12, 'square', 0.15, ctx.currentTime + k * 0.09, 300 - k * 40);
  },
  power: () => arp([72, 76, 79, 84, 88, 91], 0.04, 0.22),
  medal: (k: number) => arp([84 + Math.min(k, 12), 91 + Math.min(k, 12)], 0.04, 0.18, 'triangle'),
  bomb: () => {
    noise(1.6, 0.8, 6000, 0, 'lowpass', 50);
    tone(400, 1.2, 'sawtooth', 0.15, 0, 30);
  },
  warning: () => {
    if (!ctx) return;
    for (let k = 0; k < 4; k++) {
      tone(660, 0.25, 'square', 0.16, ctx.currentTime + k * 0.5, 440);
      tone(440, 0.2, 'square', 0.1, ctx.currentTime + k * 0.5 + 0.25, 660);
    }
  },
  shieldDown: () => tone(1200, 0.3, 'sawtooth', 0.16, 0, 150),
  shieldUp: () => arp([79, 84, 91], 0.05, 0.16, 'triangle'),
  oneUp: () => arp([76, 79, 88, 84, 86, 91], 0.07, 0.22),
  cleared: () => arp([67, 72, 76, 79, 0, 76, 79, 84, 0, 83, 86, 91], 0.08, 0.22),
  tally: () => every('tally', 0.03) && tone(1600, 0.02, 'square', 0.08),
  over: () => arp([67, 63, 60, 55, 51, 48], 0.12, 0.22),
};

// ---------- music ----------
// Each tune is a loop of sixteenth notes. Intensity 0-5 brings in instruments.

interface Tune {
  name: string;
  /** Seconds per unit at tempo 1. */
  unit: number;
  length: number;
  /** Schedule whatever sounds at unit i (already wrapped into the loop). */
  play(i: number, t: number, lv: number, tr: number, unitSec: number): void;
}

const perc = {
  snare: (t: number, vol: number) => noise(0.08, vol, 5000, t, 'highpass'),
  hat: (t: number, vol: number) => noise(0.03, vol, 9000, t, 'highpass'),
  kick: (t: number, vol: number) => {
    tone(140, 0.12, 'sine', vol, t, 40);
    noise(0.04, vol * 0.4, 300, t);
  },
};

const MINOR = [0, 2, 3, 5, 7, 8, 10, 12, 14, 15];

/** A melody of 64 sixteenths in A minor: 0 rest, -1 hold. */
function compose(seed: number) {
  const rng = makeRng(seed);
  const bar = () => {
    const out: number[] = [];
    let d = 2 + Math.floor(rng() * 4);
    for (let k = 0; k < 8; k++) {
      d = Math.max(0, Math.min(MINOR.length - 1, d + [-2, -1, -1, 0, 1, 1, 2][Math.floor(rng() * 7)]));
      const note = 69 + MINOR[d];
      out.push(k === 0 || rng() < 0.7 ? note : 0, rng() < 0.35 ? note + (rng() < 0.5 ? 2 : -2) : -1);
    }
    return out;
  };
  const a = bar(), b = bar(), c = bar();
  return [...a, ...b, ...a, ...c];
}

// Stage: Am F G Em in driving eighths.
const STAGE_ROOTS = [45, 41, 43, 40];
let stageMelody = compose(7);

const STAGE: Tune = {
  name: 'STAGE',
  unit: 60 / 148 / 4,
  length: 64,
  play(i, t, lv, tr, u) {
    const root = STAGE_ROOTS[i >> 4];
    const s = i % 16;
    if (s % 2 === 0) tone(midiHz(root + tr + (s % 4 === 2 ? 12 : 0)), u * 1.6, 'sawtooth', 0.12, t);
    if (lv >= 1 && s % 4 === 0) perc.kick(t, 0.5);
    if (lv >= 1 && s % 8 === 4) perc.snare(t, 0.16);
    if (lv >= 2 && s % 2 === 1) perc.hat(t, 0.05);
    if (lv >= 2) tone(midiHz(root + 24 + tr + [0, 7, 12, 7][s % 4]), u * 0.7, 'square', 0.025, t);
    const m = stageMelody[i];
    if (m > 0 && lv >= 1) {
      let len = 1;
      while (stageMelody[(i + len) % 64] === -1 && len < 4) len++;
      tone(midiHz(m + tr), u * len * 0.95, 'square', 0.08, t);
      tone(midiHz(m + tr + 12), u * len * 0.6, 'triangle', 0.1, t + u * 0.02);
    }
  },
};

// Boss: chromatic menace over a pedal.
const BOSS: Tune = {
  name: 'BOSS',
  unit: 60 / 160 / 4,
  length: 64,
  play(i, t, lv, tr, u) {
    const s = i % 16;
    const bar = i >> 4;
    const root = [40, 40, 41, 39][bar];
    tone(midiHz(root + tr + (s % 2 ? 12 : 0)), u * 0.9, 'sawtooth', 0.13, t);
    if (s % 4 === 0) perc.kick(t, 0.55);
    if (s % 8 === 4 || s === 14) perc.snare(t, 0.18);
    perc.hat(t, s % 2 ? 0.03 : 0.06);
    if (lv >= 1) {
      const riff = [0, 0, 3, 0, 6, 0, 5, 0, 3, 0, 1, 0, 0, 0, 3, 5];
      if (s % 2 === 0) tone(midiHz(64 + tr + riff[s] + (bar === 3 ? -1 : 0)), u * 1.6, 'square', 0.07, t);
    }
  },
};

export const TUNES = [STAGE, BOSS];
export const TUNE = { STAGE: 0, BOSS: 1 } as const;

let musicOn = true;
let playing = false;
let tune = 0;
let unit = 0;
let nextTime = 0;
let timer: number | undefined;
let transpose = 0;
let intensity = 0;
let tempo = 1;

function schedule() {
  if (!ctx) return;
  const tn = TUNES[tune];
  while (nextTime < ctx.currentTime + 0.12) {
    const u = tn.unit / tempo;
    tn.play(unit % tn.length, nextTime, intensity, transpose, u);
    unit++;
    nextTime += u;
  }
}

export const music = {
  /** Start (or keep playing) a tune; switching tunes starts it from the top. */
  play(which = tune, restart = false) {
    if (which !== tune || restart) {
      this.halt();
      tune = which;
      unit = 0;
    }
    playing = true;
    if (!ctx || !musicOn || timer !== undefined) return;
    nextTime = ctx.currentTime + 0.05;
    timer = window.setInterval(schedule, 25);
  },
  resume() {
    if (playing) this.play();
  },
  stop() {
    playing = false;
    this.halt();
  },
  halt() {
    if (timer !== undefined) clearInterval(timer);
    timer = undefined;
  },
  setKey(semis: number) {
    transpose = ((semis + 18) % 12) - 6;
  },
  setIntensity(lv: number) {
    intensity = lv;
  },
  setTempo(mult: number) {
    tempo = mult;
  },
  /** A new melody for the stage tune. */
  setMelody(seed: number) {
    stageMelody = compose(seed);
  },
  toggle() {
    musicOn = !musicOn;
    if (!musicOn) this.halt();
    else if (playing) this.play();
    return musicOn;
  },
  set enabled(on: boolean) {
    if (on !== musicOn) this.toggle();
  },
  get enabled() {
    return musicOn;
  },
  get running() {
    return timer !== undefined;
  },
  get tune() {
    return tune;
  },
};
