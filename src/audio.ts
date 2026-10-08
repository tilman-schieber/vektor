// Tiny Web Audio chiptune synth: SFX, a tune of its own for each stage, a boss
// tune and a final boss tune.

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
  needle: () => every('needle', 0.08) && tone(2400, 0.06, 'triangle', 0.07, 0, 3600),
  spotted: () => arp([88, 0, 88], 0.05, 0.14),
  beam: () => {
    noise(0.8, 0.25, 1800, 0, 'bandpass', 900);
    tone(220, 0.8, 'sawtooth', 0.12, 0, 330);
  },
  mortar: () => tone(160, 0.12, 'square', 0.12, 0, 60),
  shieldDown: () => tone(1200, 0.3, 'sawtooth', 0.16, 0, 150),
  shieldUp: () => arp([79, 84, 91], 0.05, 0.16, 'triangle'),
  oneUp: () => arp([76, 79, 88, 84, 86, 91], 0.07, 0.22),
  cleared: () => arp([67, 72, 76, 79, 0, 76, 79, 84, 0, 83, 86, 91], 0.08, 0.22),
  tally: () => every('tally', 0.03) && tone(1600, 0.02, 'square', 0.08),
  over: () => arp([67, 63, 60, 55, 51, 48], 0.12, 0.22),
};

// ---------- music ----------
// A tune for each stage, a boss tune and a final boss tune, each a loop of
// sixteenths written out as data: a melody, a chord a bar, and parts that
// come in as intensity (1-5) rises over the stage.

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
  tom: (t: number, vol: number, hz = 120) => tone(hz, 0.16, 'sine', vol, t, hz * 0.55),
  /** Darbuka rim. */
  tek: (t: number, vol: number) => noise(0.03, vol, 3000, t, 'bandpass'),
  shaker: (t: number, vol: number) => noise(0.05, vol, 8000, t, 'bandpass'),
  clap: (t: number, vol: number) => {
    noise(0.02, vol, 1500, t, 'bandpass');
    noise(0.12, vol, 1500, t + 0.012, 'bandpass');
  },
  /** Big eighties snare. */
  gated: (t: number, vol: number) => {
    noise(0.25, vol, 2500, t);
    noise(0.06, vol * 0.6, 6000, t, 'highpass');
  },
  crash: (t: number, vol: number) => noise(0.5, vol, 5000, t, 'highpass'),
};

type Wave = OscillatorType | 'pulse' | 'thin';
interface Opts {
  /** Vibrato depth in semitones, fading in. */
  vib?: number;
  /** Detune in cents. */
  det?: number;
  /** A bell: dies away over this many seconds, whatever the note length. */
  pluck?: number;
  /** Fade-in seconds. */
  att?: number;
  /** Lowpass cutoff in Hz, closing to a quarter over the note. */
  lp?: number;
}

const waves: Partial<Record<Wave, PeriodicWave>> = {};
/** A pulse wave of the given duty: 'pulse' 25%, 'thin' 12.5%. */
function pulseWave(duty: number) {
  const re = new Float32Array(32), im = new Float32Array(32);
  for (let n = 1; n < 32; n++) {
    re[n] = Math.sin(2 * Math.PI * n * duty) / n;
    im[n] = (1 - Math.cos(2 * Math.PI * n * duty)) / n;
  }
  return ctx!.createPeriodicWave(re, im);
}

/** A music note at MIDI m: like tone(), with a few more ways to shape it. */
function voice(m: number, dur: number, type: Wave, vol: number, t: number, o: Opts = {}) {
  if (!ctx || !(dur > 0)) return;
  const osc = ctx.createOscillator();
  if (type === 'pulse' || type === 'thin') osc.setPeriodicWave((waves[type] ??= pulseWave(type === 'pulse' ? 0.25 : 0.125)));
  else osc.type = type;
  osc.frequency.setValueAtTime(midiHz(m), t);
  if (o.det) osc.detune.setValueAtTime(o.det, t);
  const end = t + (o.pluck ?? dur);
  const g = ctx.createGain();
  if (o.pluck) {
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, end);
  } else {
    const att = Math.min(o.att ?? 0, dur * 0.5);
    g.gain.setValueAtTime(att ? 0 : vol, t);
    if (att) g.gain.linearRampToValueAtTime(vol, t + att);
    g.gain.setValueAtTime(vol, t + Math.max(att, dur * 0.7));
    g.gain.linearRampToValueAtTime(0, end);
  }
  if (o.vib && dur > 0.2) {
    const lfo = ctx.createOscillator(), depth = ctx.createGain();
    lfo.frequency.value = 5.5;
    depth.gain.setValueAtTime(0, t);
    depth.gain.linearRampToValueAtTime(o.vib * 100, t + Math.min(0.3, dur * 0.6));
    lfo.connect(depth).connect(osc.detune);
    lfo.start(t);
    lfo.stop(end + 0.01);
  }
  if (o.lp) {
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.Q.value = 3;
    f.frequency.setValueAtTime(o.lp, t);
    f.frequency.exponentialRampToValueAtTime(o.lp / 4, end);
    osc.connect(f).connect(g);
  } else osc.connect(g);
  g.connect(master);
  osc.start(t);
  osc.stop(end + 0.01);
}

/** An octave up, unless that would be too shrill. */
const up = (m: number) => m + (m > 86 ? 0 : 12);

/** A bell with two echoes, 3 and 6 units later. */
function bell(m: number, vol: number, t: number, u: number, type: Wave = 'triangle') {
  [1, 0.35, 0.12].forEach((k, j) => voice(m, 1, type, vol * k, t + j * 3 * u, { pluck: 0.35 }));
}

const PC: Record<string, number> = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
/** Pitch class of a leading 'c', 'f#', 'bb' (any case), and what follows it. */
function pc(s: string): [number, string] {
  s = s.toLowerCase();
  let n = PC[s[0]], k = 1;
  if (s[1] === '#') (n++, k++);
  else if (s[1] === 'b') (n--, k++);
  return [(n + 12) % 12, s.slice(k)];
}
/** 'c#5' → 73. */
function pitch(s: string) {
  const [p, oct] = pc(s);
  return 12 * (+oct + 1) + p;
}

/** A melody: n holds the note starting at each sixteenth (0 none), d its length. */
interface Mel {
  n: number[];
  d: number[];
}
/** 'a4:3 r:2 c#5 | ...': notes with lengths in sixteenths (default 2), r a rest, | ignored. */
function mel(src: string): Mel {
  const n: number[] = [], d: number[] = [];
  for (const tok of src.split(/[\s|]+/).filter(Boolean)) {
    const [name, len = '2'] = tok.split(':');
    const k = +len;
    n.push(name === 'r' ? 0 : pitch(name), ...Array(k - 1).fill(0));
    d.push(k, ...Array(k - 1).fill(0));
  }
  return { n, d };
}
/** Calls f(note, length in units) if a note of m starts at i. */
function at(m: Mel, i: number, f: (n: number, d: number) => void) {
  if (m.n[i]) f(m.n[i], m.d[i]);
}

const QUAL: Record<string, number[]> = {
  '': [0, 4, 7], m: [0, 3, 7], dim: [0, 3, 6], '7': [0, 4, 7, 10], '7b9': [0, 4, 7, 10, 13], add9: [0, 4, 7, 14],
};
interface Chord {
  r: number;
  t: number[];
}
/** 'F#m Dadd9 C#7 ...': a chord a bar. */
const prog = (src: string): Chord[] =>
  src.split(/\s+/).filter(Boolean).map((s) => {
    const [r, q] = pc(s);
    return { r, t: QUAL[q] };
  });
/** The chord's root at or above base, its tones stacked on it. */
const voicing = (c: Chord, base: number) => {
  const r = base + ((((c.r - base) % 12) + 12) % 12);
  return c.t.map((x) => r + x);
};
/** The k-th chord tone up from the root at or above base, climbing octaves. */
const ar = (c: Chord, base: number, k: number) => {
  const v = voicing(c, base);
  return v[k % v.length] + 12 * Math.floor(k / v.length);
};

// COAST, D major, 152: heroic I-bVII-IV-V hook over galloping octave bass.
// 1 bass, kick, pulse lead · 2 snare, hats · 3 square arpeggio · 4 lead doubled low, more hats · 5 crash, fills.
const COAST_CH = prog('D C G A D C G A Bm G D A Bm G E A7');
const COAST_MEL = mel(`
  a4 d5 f#5:3 e5:1 d5 e5 f#5:4 | g5:3 e5:1 c5:4 d5 e5 g5:4 | b5:3 a5:1 g5 d5 b4 d5 g5:4 | a5:6 g5 f#5 e5 c#5:4
  a4 d5 f#5:3 e5:1 d5 e5 f#5:4 | g5:3 a5:1 g5 e5 c5 e5 g5:4 | b5:4 a5 b5 d6:4 b5:4 | c#6:6 b5 a5:8
  f#5:6 e5 d5:4 b4:4 | d5:4 e5 d5 b4:4 g4:4 | a4:4 d5 e5 f#5:4 a5:4 | e5:8 c#5:4 e5:4
  f#5:6 e5 d5:4 f#5:4 | g5:6 f#5 g5:4 b5:4 | b5:6 a5 g#5:4 e5:4 | c#5:4 e5 a5 g5:4 e5:4`);
const COAST: Tune = {
  name: 'COAST',
  unit: 60 / 152 / 4,
  length: 256,
  play(i, t, lv, tr, u) {
    const bar = i >> 4, s = i & 15, c = COAST_CH[bar];
    if (s % 2 === 0) voice(voicing(c, 36)[0] + tr + [0, 12, 0, 12, 0, 12, 0, 7][s >> 1], u * 1.6, 'sawtooth', 0.12, t);
    if (s % 4 === 0) perc.kick(t, 0.5);
    if (lv >= 2 && s % 8 === 4) perc.snare(t, 0.16);
    if (lv >= 2 && s % 2 === 1) perc.hat(t, 0.05);
    if (lv >= 3) voice(ar(c, 55, [0, 1, 2, 3, 4, 3, 2, 1][s % 8]) + tr, u * 0.7, 'square', 0.025, t);
    if (lv >= 4 && s % 2 === 0) perc.hat(t, 0.025);
    if (lv >= 5 && s === 0 && bar % 4 === 0) perc.crash(t, 0.1);
    if (lv >= 5 && bar % 4 === 3 && s >= 12) perc.snare(t, 0.1);
    at(COAST_MEL, i, (n, d) => {
      voice(n + tr, d * u * 0.95, 'pulse', 0.09, t, { vib: d >= 4 ? 0.25 : 0 });
      voice(up(n + tr), d * u * 0.6, 'triangle', 0.07, t + u * 0.02);
      if (lv >= 4) voice(n + tr - 12, d * u * 0.9, 'sawtooth', 0.03, t);
    });
  },
};

// DESERT, E phrygian dominant, 128: snake-charmer saw over a sixteenth ostinato and darbuka.
// 1 ostinato, doum-tek, saw lead · 2 kick, shaker · 3 fifth drone · 4 thin lead an octave down, claps · 5 tom fills.
const DESERT_CH = prog('E F E F Dm F E E Am Am Dm Dm F F E E');
const DESERT_MEL = mel(`
  e5 f5:1 e5:1 g#5 a5:1 g#5:1 b5:4 a5 g#5 | a5:3 g#5:1 f5:4 e5 f5 a5:4 | g#5 f5 e5:4 r e5:1 f5:1 g#5 b5 | c6:4 b5:1 c6:1 a5 f5:4 e5 f5
  d6:4 c6 a5 f5 a5 d6:4 | c6:3 b5:1 a5:4 g#5 a5 c6:4 | b5:6 a5:1 g#5:1 a5 f5 e5:4 | e5:10 r b4 d5
  c5:4 b4 a4 e5:6 d5 | c5 d5 e5 f5 e5:4 a4:4 | d5:4 c5 a4 f5:6 e5 | d5 e5 f5 g#5 a5:8
  c6:4 a5 f5 a5:4 c6:4 | d6 c6 a5 g#5 a5:8 | b5:4 g#5 f5 e5:4 g#5:4 | b5:8 a5 g#5 f5 d5`);
const DESERT: Tune = {
  name: 'DESERT',
  unit: 60 / 128 / 4,
  length: 256,
  play(i, t, lv, tr, u) {
    const bar = i >> 4, s = i & 15, c = DESERT_CH[bar], r = voicing(c, 38)[0] + tr;
    const b = [0, -1, 12, 0, 0, -1, 12, 0, 0, -1, 12, 0, 0, 7, 12, 7][s];
    if (b >= 0) voice(r + b, u * 0.9, 'sawtooth', 0.1, t, { lp: 2400 });
    if (s === 0 || s === 8) perc.tom(t, 0.35, 90);
    if (s === 2 || s === 6 || s === 12) perc.tek(t, 0.1);
    if (lv >= 2 && (s === 0 || s === 8)) perc.kick(t, 0.4);
    if (lv >= 2 && s % 2 === 1) perc.shaker(t, 0.03);
    if (lv >= 3 && s === 0) for (const x of [12, 19]) voice(r + x, u * 16, 'triangle', 0.035, t, { att: u * 4 });
    if (lv >= 4 && (s === 4 || s === 12)) perc.clap(t, 0.12);
    if (lv >= 5 && bar % 2 === 1 && s >= 12) perc.tom(t, 0.25, [200, 170, 140, 110][s - 12]);
    at(DESERT_MEL, i, (n, d) => {
      voice(n + tr, d * u * 0.95, 'sawtooth', 0.085, t, { vib: 0.35 });
      if (lv >= 4) voice(n + tr - 12, d * u * 0.9, 'thin', 0.03, t);
    });
  },
};

// ARCTIC, F# minor, 138: echoing bells over a sub drone, the rest comes in slowly.
// 1 bells in eighths, drone · 2 triangle lead, soft kick · 3 bells in sixteenths, half-time snare, hats
// 4 pulsing bass, thin shimmer an octave up · 5 full backbeat, sixteenth hats, crash.
const ARCTIC_CH = prog('F#m Dadd9 Aadd9 E F#m Dadd9 Bm C# Dadd9 E C#m F#m Bm Dadd9 E7 C#');
const ARCTIC_MEL = mel(`
  f#6:4 e6 c#6 a5:4 c#6:4 | e6:6 c#6 a5:8 | e6:4 c#6 b5 a5:4 e5:4 | g#5:6 b5 e6:8
  c#6:4 b5 a5 c#6:4 a6:4 | f#6:6 e6 d6:4 a5:4 | b5:4 c#6 d6 f#6:4 e6 d6 | g#5:6 f5 g#5:4 c#6:4
  a5:4 f#5 e5 f#5:4 a5:4 | b5:4 g#5 e5 b5:4 e6:4 | e6:6 c#6 g#5:4 c#6:4 | a5:6 g#5 f#5:8
  f#5:4 b5:4 d6:4 c#6 b5 | a5:6 b5 d6:4 f#6:4 | e6:6 d6 b5:4 g#5:4 | c#6:4 g#5 c#6 f6:8`);
const ARCTIC: Tune = {
  name: 'ARCTIC',
  unit: 60 / 138 / 4,
  length: 256,
  play(i, t, lv, tr, u) {
    const bar = i >> 4, s = i & 15, c = ARCTIC_CH[bar], r = voicing(c, 37)[0] + tr;
    if (lv < 4 && s === 0) voice(r, u * 16, 'triangle', 0.16, t, { att: u * 2 });
    if (lv >= 4 && s % 2 === 0) voice(r + (s % 4 ? 12 : 0), u * 1.5, 'sawtooth', 0.09, t, { lp: 900 });
    if (s % (lv >= 3 ? 1 : 2) === 0) bell(ar(c, 68, [0, 1, 2, 3, 4, 2, 3, 1, 0, 2, 1, 3, 4, 3, 2, 1][s]) + tr, 0.045, t, u);
    if (lv >= 2 && (s === 0 || s === 10)) perc.kick(t, 0.35);
    if (lv >= 3 && lv < 5 && s === 8) perc.snare(t, 0.12);
    if (lv >= 3 && s % 4 === 2) perc.hat(t, 0.04);
    if (lv >= 5 && s % 8 === 4) perc.snare(t, 0.14);
    if (lv >= 5 && s % 2 === 1) perc.hat(t, 0.025);
    if (lv >= 5 && s === 0 && bar % 4 === 0) perc.crash(t, 0.08);
    if (lv >= 2)
      at(ARCTIC_MEL, i, (n, d) => {
        voice(n + tr, d * u * 0.95, 'triangle', 0.13, t, { vib: 0.15 });
        voice(up(n + tr), d * u * 0.5, 'sine', 0.035, t);
        voice(n + tr, d * u * 0.8, 'triangle', 0.04, t + 3 * u);
        if (lv >= 4) voice(up(n + tr), d * u * 0.9, 'thin', 0.022, t);
      });
  },
};

// NIGHT CITY, F minor, 120: synthwave, syncopated filtered bass, wide saw lead, gated snare.
// 1 bass, kick, lead · 2 gated snare, hats · 3 thin arpeggio with echo · 4 pad · 5 four on the floor, lead an octave up.
const NIGHT_CH = prog('Fm Db Ab Eb Fm Db Ab Eb Db Eb Fm Fm Db Eb C7 C');
const NIGHT_MEL = mel(`
  c5:3 ab4:3 f4 g4:3 ab4:3 c5 | f5:3 eb5:3 db5:4 ab4:6 | eb5:3 c5:3 ab4 bb4 c5 eb5:4 | g5:6 f5 eb5:4 bb4:4
  c5:3 ab4:3 f4 g4:3 ab4:3 c5 | f5:3 eb5:3 db5 f5 ab5:6 | ab5:3 g5:3 eb5 c5 eb5:6 | bb5:6 g5 eb5:4 g5:4
  ab5:4 f5:4 db5:4 f5 ab5 | bb5:4 g5:4 eb5:4 g5 bb5 | c6:6 bb5 ab5:4 g5 f5 | f5:8 r:4 c5 eb5
  f5:3 db5:3 ab4 f5:3 eb5:3 db5 | g5:3 eb5:3 bb4 g5:3 f5:3 eb5 | e5:6 g5 c6:4 bb5:4 | g5:6 e5 c5:8`);
const NIGHT: Tune = {
  name: 'NIGHT',
  unit: 60 / 120 / 4,
  length: 256,
  play(i, t, lv, tr, u) {
    const bar = i >> 4, s = i & 15, c = NIGHT_CH[bar], r = voicing(c, 36)[0] + tr;
    const b = [0, -1, -1, 0, -1, -1, 12, -1, 0, -1, -1, 0, -1, 12, -1, 12][s];
    if (b >= 0) voice(r + b, u * 1.5, 'sawtooth', 0.13, t, { lp: 1400 });
    if (s === 0 || s === 8 || (lv >= 5 && s % 4 === 0)) perc.kick(t, 0.5);
    if (lv >= 2 && s % 8 === 4) perc.gated(t, 0.2);
    if (lv >= 2 && s % 4 === 2) perc.hat(t, 0.05);
    if (lv >= 5 && s % 2 === 1) perc.hat(t, 0.025);
    if (lv >= 3) {
      const n = ar(c, 65, [0, 2, 1, 3, 2, 4, 3, 5][s % 8]) + tr;
      voice(n, u * 0.6, 'thin', 0.022, t);
      voice(n, u * 0.6, 'thin', 0.009, t + 3 * u);
    }
    if (lv >= 4 && s === 0)
      for (const n of voicing(c, 53))
        for (const det of [-8, 8]) voice(n + tr, u * 16, 'sawtooth', 0.012, t, { det, att: u * 4, lp: 2000 });
    at(NIGHT_MEL, i, (n, d) => {
      for (const det of [-9, 9]) voice(n + tr, d * u * 0.95, 'sawtooth', 0.055, t, { det, vib: 0.2 });
      if (lv >= 5) voice(n + tr + 12, d * u * 0.9, 'pulse', 0.025, t);
    });
  },
};

// VOLCANO, C minor, 168: galloping low riff in power fifths, a screaming lead over it.
// 1 riff, kick · 2 snare, power fifths · 3 lead · 4 chord stabs, sixteenth hats, double kick, tom fills · 5 crash, lead an octave up.
const V1 = 'c3 c3:1 c3:1 c3 c3:1 c3:1 eb3 c3 f3 f#3 | g3 g3:1 g3:1 f#3 f3 eb3 c3 bb2 c3';
const V2 = 'ab2 ab2:1 ab2:1 ab2 ab2:1 ab2:1 c3 ab2 eb3 ab2 | bb2 bb2:1 bb2:1 bb2 bb2:1 bb2:1 d3 bb2 f3 g3';
const VOLCANO_CH = prog('Cm Cm Ab Bb Cm Cm Ab Bb Fm Fm Ab Bb Cm Cm Db G7');
const VOLCANO_RIFF = mel(`${V1} ${V2} ${V1} ${V2}
  f2 f2:1 f2:1 f2 f2:1 f2:1 ab2 f2 c3 f2 | f2 f2:1 f2:1 ab2 f2:1 f2:1 c3 eb3 c3 ab2 | ${V2} | ${V1}
  db3 db3:1 db3:1 db3 db3:1 db3:1 f3 db3 ab2 db3 | g2 g2:1 g2:1 g2 g2:1 g2:1 b2 d3 f3 g3`);
const VOLCANO_MEL = mel(`
  g5:6 eb5 c5:4 d5 eb5 | g5:4 f5 eb5 c5:8 | c6:6 bb5 ab5:4 eb5:4 | d6:6 c6 bb5:4 f5:4
  g5:6 eb5 c5:4 eb5 g5 | c6:6 bb5 g5:4 eb5:4 | ab5:4 c6:4 eb6:8 | d6:4 f6:4 d6:4 bb5:4
  c6:6 ab5 f5:8 | g5 ab5 c6:4 f6:8 | eb6:6 c6 ab5:8 | bb5:4 d6:4 f6:4 d6:4
  g6:8 f6 eb6 d6 c6 | eb6:6 d6 c6:8 | db6:4 ab5:4 f5:4 ab5:4 | b5:6 d6 f6:4 d6:4`);
const VOLCANO: Tune = {
  name: 'VOLCANO',
  unit: 60 / 168 / 4,
  length: 256,
  play(i, t, lv, tr, u) {
    const bar = i >> 4, s = i & 15;
    at(VOLCANO_RIFF, i, (n, d) => {
      voice(n + tr, d * u * 0.8, 'sawtooth', 0.12, t, { lp: 1800 });
      if (lv >= 2) voice(n + tr + 7, d * u * 0.8, 'sawtooth', 0.05, t, { lp: 1800 });
    });
    if (s % 4 === 0 || (lv >= 4 && s % 4 === 3)) perc.kick(t, s % 4 ? 0.35 : 0.55);
    if (lv >= 2 && s % 8 === 4) perc.snare(t, 0.18);
    if (lv >= 4) perc.hat(t, s % 2 ? 0.025 : 0.045);
    if (lv >= 4 && s === 0) for (const n of voicing(VOLCANO_CH[bar], 60)) voice(n + tr, u * 2, 'square', 0.02, t);
    if (lv >= 4 && bar % 4 === 3 && s >= 12) perc.tom(t, 0.3, [180, 150, 120, 95][s - 12]);
    if (lv >= 5 && s === 0 && bar % 2 === 0) perc.crash(t, 0.1);
    if (lv >= 3)
      at(VOLCANO_MEL, i, (n, d) => {
        voice(n + tr, d * u * 0.95, 'square', 0.07, t, { vib: d >= 4 ? 0.3 : 0 });
        voice(n + tr, d * u * 0.95, 'sawtooth', 0.035, t, { det: 12 });
        if (lv >= 5) voice(up(n + tr), d * u * 0.9, 'thin', 0.025, t);
      });
  },
};

// ORBIT, B minor, 140: wide pads and a soaring lead, the finale; E major and F#7 for the lift.
// 1 pad, lead · 2 bass, half-time kick · 3 backbeat, sparkling sine arpeggio · 4 hats, pulse an octave up · 5 crash, fills.
const ORBIT_CH = prog('Bm G D A Bm G E E G A F#m Bm G A F#7 F#7');
const ORBIT_MEL = mel(`
  b4:4 f#5:8 e5 d5 | b4:4 d5:4 g5:8 | f#5:6 e5 d5:4 a5:4 | e5:12 c#5 e5
  b4:4 f#5:8 a5 b5 | d6:8 b5:4 g5:4 | g#5:8 b5:4 e6:4 | e6:8 d6 c#6 b5:4
  b5:6 a5 g5:4 d5:4 | c#6:6 b5 a5:4 e5:4 | a5:6 b5 c#6:4 f#5:4 | d6:8 c#6 b5 f#5:4
  g5:4 b5:4 d6:4 g6:4 | e6:6 f#6 e6:4 c#6:4 | a#5:6 c#6 f#6:8 | e6:4 c#6:4 a#5:4 f#5:4`);
const ORBIT: Tune = {
  name: 'ORBIT',
  unit: 60 / 140 / 4,
  length: 256,
  play(i, t, lv, tr, u) {
    const bar = i >> 4, s = i & 15, c = ORBIT_CH[bar];
    if (s === 0)
      for (const n of voicing(c, 50))
        for (const det of [-10, 10]) voice(n + tr, u * 16, 'sawtooth', 0.011, t, { det, att: u * 6, lp: 1800 });
    if (lv >= 2 && s % 2 === 0) voice(voicing(c, 35)[0] + tr + [0, 0, 12, 0, 0, 0, 12, 7][s >> 1], u * 1.7, 'sawtooth', 0.11, t);
    if (lv >= 2 && (s === 0 || (lv >= 3 ? s === 8 : s === 10))) perc.kick(t, 0.5);
    if (lv >= 3 && s % 8 === 4) perc.snare(t, 0.16);
    if (lv >= 3 && s % 2 === 0) bell(ar(c, 71, [0, 1, 2, 3, 1, 2, 3, 4][(s >> 1) % 8]) + tr, 0.04, t, u, 'sine');
    if (lv >= 4 && s % 4 === 2) perc.hat(t, 0.045);
    if (lv >= 5 && s % 2 === 1) perc.hat(t, 0.02);
    if (lv >= 5 && s === 0 && bar % 4 === 0) perc.crash(t, 0.1);
    if (lv >= 5 && bar % 4 === 3 && s >= 12) perc.tom(t, 0.3, [190, 160, 130, 100][s - 12]);
    at(ORBIT_MEL, i, (n, d) => {
      for (const det of [-10, 10]) voice(n + tr, d * u * 0.95, 'sawtooth', 0.055, t, { det, vib: 0.25 });
      voice(up(n + tr), d * u * 0.6, lv >= 4 ? 'pulse' : 'triangle', lv >= 4 ? 0.025 : 0.03, t);
    });
  },
};

// BOSS, E minor (moved to each stage's key), 160: chromatic menace over a pounding pedal.
const BOSS_CH = prog('Em Em F Em Em C C B7');
const BOSS_MEL = mel(`
  e5 g5 f#5 e5 a#5 b5 g5 f#5 | e5 g5 f#5 e5 b4:4 d#5:4 | f5 a5 g5 f5 c6:4 b5 a5 | g5:4 f#5 e5 d#5:4 e5:4
  b5:6 a5 g5:4 e5:4 | c6:6 b5 g5:4 e5:4 | e6:4 d6 c6 g5:4 e5:4 | d#6:4 f#6:4 b5:4 a5 f#5`);
const BOSS: Tune = {
  name: 'BOSS',
  unit: 60 / 160 / 4,
  length: 128,
  play(i, t, lv, tr, u) {
    const bar = i >> 4, s = i & 15, c = BOSS_CH[bar];
    voice(voicing(c, 36)[0] + tr + [0, 0, 12, 0, 0, 12, 0, 0][s % 8], u * 0.8, 'sawtooth', 0.12, t, { lp: 2500 });
    if (s % 4 === 0) perc.kick(t, 0.55);
    if (s % 8 === 4 || s === 14) perc.snare(t, 0.18);
    perc.hat(t, s % 2 ? 0.03 : 0.06);
    if (lv >= 3) voice(ar(c, 64, [0, 1, 2, 3][s % 4] + (s >> 3)) + tr, u * 0.5, 'thin', 0.02, t);
    if (lv >= 5 && s === 0 && bar % 4 === 0) perc.crash(t, 0.1);
    if (lv >= 1)
      at(BOSS_MEL, i, (n, d) => {
        voice(n + tr, d * u * 0.95, 'square', 0.075, t);
        voice(n + tr - 12, d * u * 0.9, 'sawtooth', 0.03, t);
      });
  },
};

// FINAL, G harmonic minor, 176: the last fight. Wide saw lead over D7b9 diminished arpeggios.
const FINAL_CH = prog('Gm Eb Cm D7b9 Gm Eb Ab D7b9 Eb F Bb Gm Cm Adim D7 D7b9');
const FINAL_MEL = mel(`
  d6:4 bb5 g5 d6 eb6 d6:4 | g6:6 f6 eb6:4 bb5:4 | c6:4 eb6:4 g6:4 f6 eb6 | f#6:6 eb6 d6:4 a5:4
  g5 a5 bb5 d6 g6:8 | f6 eb6 d6 eb6 g6:8 | ab6:6 g6 eb6:4 c6:4 | a6:4 f#6:4 d6:4 c6 a5
  bb5:6 c6 eb6:8 | c6:6 d6 f6:8 | d6:6 c6 bb5:4 f6:4 | g6:8 f6 eb6 d6:4
  eb6:6 d6 c6:4 g5:4 | c6:4 eb6:4 a5:4 c6:4 | d6:4 f#6:4 a6:4 c7:4 | a6:8 f#6:4 d6:4`);
const FINAL: Tune = {
  name: 'FINAL',
  unit: 60 / 176 / 4,
  length: 256,
  play(i, t, lv, tr, u) {
    const bar = i >> 4, s = i & 15, c = FINAL_CH[bar];
    voice(voicing(c, 36)[0] + tr + (s % 4 === 2 ? 12 : 0), u * 0.8, 'sawtooth', 0.11, t, { lp: 2200 });
    if (s % 2 === 0) perc.kick(t, s % 4 ? 0.35 : 0.55);
    if (s % 8 === 4) perc.snare(t, 0.18);
    perc.hat(t, s % 2 ? 0.025 : 0.05);
    if (s === 0 && bar % 4 === 0) perc.crash(t, 0.1);
    if (bar % 8 === 7 && s >= 8 && s % 2 === 0) perc.tom(t, 0.3, [200, 160, 130, 100][(s - 8) >> 1]);
    if (lv >= 2) voice(ar(c, 67, [0, 1, 2, 3, 4, 3, 2, 1][s % 8]) + tr, u * 0.5, 'thin', 0.02, t);
    at(FINAL_MEL, i, (n, d) => {
      for (const det of [-10, 10]) voice(n + tr, d * u * 0.95, 'sawtooth', 0.055, t, { det, vib: d >= 4 ? 0.3 : 0 });
      voice(n + tr - 12, d * u * 0.9, 'pulse', 0.035, t);
    });
  },
};

export const TUNES = [COAST, DESERT, ARCTIC, NIGHT, VOLCANO, ORBIT, BOSS, FINAL];
export const TUNE = { BOSS: 6, FINAL: 7 } as const;
const STAGE_TUNES = 6;
/** The tune of stage i (0 COAST .. 5 ORBIT). */
export const stageTune = (i: number) => i % STAGE_TUNES;
/** Semitones to move the boss tune (E minor) into stage i's key. */
export const bossKey = (i: number) => [-2, 0, 2, 1, -4][i] ?? 0;

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
