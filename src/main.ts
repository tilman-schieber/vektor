import { Game, Action, Input } from './game';
import { render, W, H } from './render';
import { unlockAudio, music } from './audio';
import { setupTouch, setupDrag, TouchButton } from './touch';
import { loadSprites } from './sprites';

const canvas = document.getElementById('screen') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
ctx.imageSmoothingEnabled = false;

const touchPanel = setupTouch(onTouch);

function resize() {
  const reserved = touchPanel ? touchPanel.el.offsetHeight + 8 : 0;
  const scale = Math.min(innerWidth / W, (innerHeight - reserved) / H);
  // Whole-number scaling keeps pixels crisp; phones may need a fractional fit.
  const s = scale >= 2 ? Math.floor(scale) : Math.max(0.5, scale);
  canvas.style.width = `${Math.floor(W * s)}px`;
  canvas.style.height = `${Math.floor(H * s)}px`;
}
addEventListener('resize', resize);
resize();

// By e.key so labels match any layout.
const ARROWS: Record<string, Action> = { arrowup: 'up', arrowdown: 'down', arrowleft: 'left', arrowright: 'right' };
const KEYS: Record<string, Action> = {
  ...ARROWS,
  w: 'up',
  s: 'down',
  a: 'left',
  d: 'right',
  ' ': 'fire',
  z: 'fire',
  j: 'fire',
  x: 'bomb',
  shift: 'bomb',
  k: 'bomb',
  c: 'swap',
  e: 'swap',
  enter: 'start',
  p: 'start',
  escape: 'back',
  backspace: 'quit',
  m: 'mute',
  h: 'scores',
};

const game = new Game();
const input: Input = { held: new Set(), pressed: new Set(), typed: [], dragX: 0, dragY: 0, touching: false, p2: { held: new Set(), pressed: new Set() } };

// In a 2-player game, by key position: player 2 flies with the arrows, fires with . and bombs
// with the key right of it (or the right Shift); player 1 keeps W A S D, Space and the left Shift.
// With exactly one gamepad, though, the pad is player 2 and the whole keyboard player 1's; with
// two, one each (and the keyboard split as well).
const P2_KEYS: Record<string, Action> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  Period: 'fire',
  Slash: 'bomb',
  ShiftRight: 'bomb',
  Comma: 'swap',
};
/** Player 2's keys and pad count as player 2's only in a 2-player game, while the ships fly. */
const twoFlying = () => game.settings.players > 1 && (game.phase === 'play' || game.phase === 'clear' || game.phase === 'ending');
const p2Keys = new Set<string>();
/** Keys currently down: e.code -> lower-cased e.key at press time (key-up may report a different key). */
const heldKeys = new Map<string, string>();
const touchHeld = new Set<TouchButton>();

/** While typing a name, letters are letters. */
const actionFor = (key: string) => (game.phase === 'entry' ? ARROWS[key] ?? (key === 'enter' ? undefined : KEYS[key]) : KEYS[key]);

addEventListener('keydown', (e) => {
  unlockAudio();
  const p2 = twoFlying() && game.pads !== 1 ? P2_KEYS[e.code] : undefined;
  if (p2) {
    e.preventDefault();
    p2Keys.add(e.code);
    if (!e.repeat) input.p2.pressed.add(p2);
    return;
  }
  const key = e.key.toLowerCase();
  if (/^[a-z0-9]$/i.test(e.key) && !e.repeat) input.typed.push(e.key.toUpperCase());
  else if (e.key === 'Backspace' || (e.key === 'Enter' && !e.repeat)) input.typed.push(e.key);
  const a = actionFor(key);
  if (a || e.key === 'Backspace') e.preventDefault();
  heldKeys.set(e.code, key);
  if (!e.repeat && a) input.pressed.add(a);
});
addEventListener('keyup', (e) => {
  heldKeys.delete(e.code);
  p2Keys.delete(e.code);
});
// Any tap unlocks sound; mobile browsers only allow it after a gesture.
for (const ev of ['pointerdown', 'pointerup', 'touchend']) addEventListener(ev, unlockAudio, { passive: true });
addEventListener('blur', () => {
  heldKeys.clear();
  p2Keys.clear();
  if (game.phase === 'play' && !game.paused) input.pressed.add('start');
});

function onTouch(b: TouchButton, down: boolean) {
  unlockAudio();
  if (!down) return void touchHeld.delete(b);
  touchHeld.add(b);
  input.pressed.add(b.a);
  if (b.typed) input.typed.push(b.typed);
}

/** Finger drags move the ship a little further than the finger, so a thumb can cover the screen. */
const DRAG_GAIN = 1.4;
setupDrag(
  canvas,
  (dx, dy) => {
    const k = (W / canvas.clientWidth) * DRAG_GAIN;
    input.dragX += dx * k;
    input.dragY += dy * k;
  },
  (down) => {
    unlockAudio();
    input.touching = down;
    // A tap on the menus counts as a press.
    if (down && game.phase !== 'play') input.pressed.add('start');
  },
);

// Gamepads, in the standard mapping: d-pad or left stick to move, A or X fire, B or Y bomb, LB or
// RB switch weapon, Start pauses, Select quits from pause. Y opens the scores on the title screen.
const PAD_BUTTONS: [number, Action][] = [
  [0, 'fire'],
  [2, 'fire'],
  [1, 'bomb'],
  [3, 'bomb'],
  [4, 'swap'],
  [5, 'swap'],
  [9, 'start'],
  [8, 'quit'],
  [12, 'up'],
  [13, 'down'],
  [14, 'left'],
  [15, 'right'],
];
const STICK = 0.4;
let padHeld = new Set<Action>();
let pad2Held = new Set<Action>();

/**
 * What the pads hold: for player 1 and the menus, and for player 2. In a 2-player game a lone pad
 * is player 2's, and with two the second is. Start, Select and the scores button always count for
 * the game, so either player can pause.
 */
function readPads(): [Set<Action>, Set<Action>] {
  const held = new Set<Action>(), held2 = new Set<Action>();
  const pads = (navigator.getGamepads?.() ?? []).filter((p): p is Gamepad => !!p);
  game.pads = pads.length;
  pads.forEach((pad, slot) => {
    const p2 = twoFlying() && slot === (pads.length === 1 ? 0 : 1);
    const into = { add: (a: Action) => (p2 && a !== 'start' && a !== 'quit' ? held2 : held).add(a) };
    for (const [i, a] of PAD_BUTTONS) {
      if (!pad.buttons[i]?.pressed) continue;
      into.add(i === 3 && game.phase === 'title' ? 'scores' : a);
    }
    const [x = 0, y = 0] = pad.axes;
    if (x < -STICK) into.add('left');
    if (x > STICK) into.add('right');
    if (y < -STICK) into.add('up');
    if (y > STICK) into.add('down');
  });
  return [held, held2];
}

function refreshHeld() {
  input.held.clear();
  for (const key of heldKeys.values()) {
    const a = actionFor(key);
    if (a) input.held.add(a);
  }
  for (const b of touchHeld) input.held.add(b.a);
  const [pad, pad2] = readPads();
  input.p2.held.clear();
  for (const code of p2Keys) input.p2.held.add(P2_KEYS[code]);
  for (const a of pad2) {
    input.p2.held.add(a);
    if (!pad2Held.has(a)) input.p2.pressed.add(a);
  }
  pad2Held = pad2;
  for (const a of pad) {
    input.held.add(a);
    if (padHeld.has(a)) continue;
    input.pressed.add(a);
    unlockAudio();
    // Typing a name: A or Start enters it, B rubs out a letter.
    if (game.phase === 'entry' && (a === 'fire' || a === 'start')) input.typed.push('Enter');
    if (game.phase === 'entry' && a === 'bomb') input.typed.push('Backspace');
  }
  padHeld = pad;
}

// Fixed 60 Hz simulation.
const STEP = 1000 / 60;
let acc = 0;
let last = performance.now();
let frame = 0;
/** Dev: the live loop is frozen while tests drive the game with sim(). */
let frozen = false;

function loop(now: number) {
  if (frozen) {
    last = now;
    return void requestAnimationFrame(loop);
  }
  acc += Math.min(250, now - last);
  last = now;
  while (acc >= STEP) {
    refreshHeld();
    game.step(input);
    input.pressed.clear();
    input.p2.pressed.clear();
    input.typed.length = 0;
    input.dragX = input.dragY = 0;
    acc -= STEP;
    frame++;
  }
  render(ctx, game, frame);
  touchPanel?.update(music.enabled);
  requestAnimationFrame(loop);
}

loadSprites().then(() => requestAnimationFrame(loop));

if (import.meta.env.DEV) {
  const dev = {
    game,
    music,
    skipTo: (d: number) => game.skipTo(d),
    boss: () => game.bossNow(),
    stage: (n: number) => game.gotoStage(n),
    god: () => game.world && (game.world.god = true),
    /** Runs n frames with these actions held, then draws: for testing in a background tab. */
    sim: (n: number, held: Action[] = []) => {
      frozen = true;
      const inp: Input = { held: new Set(held), pressed: new Set(), typed: [], dragX: 0, dragY: 0, touching: false, p2: { held: new Set(), pressed: new Set() } };
      for (let i = 0; i < n; i++) {
        game.step(inp);
        frame++;
      }
      render(ctx, game, frame);
    },
    live: () => (frozen = false),
    power: (level: number, weapon?: 'vulcan' | 'laser', missiles = 0) => {
      const p = game.world?.player;
      if (!p) return;
      p.level = level;
      if (weapon) p.weapon = weapon;
      p.missiles = missiles;
    },
  };
  Object.assign(window, dev);
}
