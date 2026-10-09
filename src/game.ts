import { MODES, Mode, TABLES, TableId, tableId } from './modes';
import { loadTables, saveTables, rankFor, ScoreEntry, Tables, MAX_SCORES, load, save, fetchGlobal, submitGlobal, flushPending } from './scores';
import { sfx, music, TUNE, stageTune, bossKey } from './audio';
import { makeRng, randomSeed } from './rng';
import { World, Controls, MAX_LEVEL, MAX_MISSILES, MAX_BOMBS } from './world';
import { HELP_PAGES } from './help';
import { STAGES } from './stages';
import { WEAPONS } from './enemies';

export type Action = 'up' | 'down' | 'left' | 'right' | 'fire' | 'bomb' | 'swap' | 'start' | 'back' | 'quit' | 'mute' | 'scores';

export interface Input {
  held: Set<Action>;
  pressed: Set<Action>;
  /** Raw A-Z / 0-9 / Backspace / Enter, for name entry. */
  typed: string[];
  /** Finger drag since last frame, in game pixels. */
  dragX: number;
  dragY: number;
  /** A finger is on the screen: fire. */
  touching: boolean;
  /** Player 2's flying, firing and bombing in a 2-player game. */
  p2: { held: Set<Action>; pressed: Set<Action> };
}

export type Phase = 'title' | 'play' | 'clear' | 'ending' | 'over' | 'entry' | 'scores' | 'help';

export interface Settings {
  /** Index into MUSIC_NAMES. */
  music: number;
  /** M mutes without changing the selection. */
  muted: boolean;
  /** Index into MODES. */
  mode: number;
  /** 1 or 2 players. */
  players: number;
}

export const MUSIC_NAMES = ['ON', 'OFF'];
const MUSIC_OFF = 1;

export const MENU = ['MODE', 'PLAYERS', 'MUSIC', 'HELP'] as const;
export const NAME_LEN = 6;
const NAME_CHARS = ' ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const DEFAULT_SETTINGS: Settings = { music: 0, muted: false, mode: 0, players: 1 };

/** Frames the stage card shows at the start of a stage. */
export const CARD_FRAMES = 180;
/** Stage clear: when each bonus line appears, and when the next stage starts. */
export const TALLY_AT = [90, 150, 210];
const CLEAR_FRAMES = 420;
/** How long the ending rolls before the next loop starts on its own. */
export const ENDING_FRAMES = 60 * 40;
export const NO_MISS_BONUS = 30000;
export const BOMB_BONUS = 3000;

function loadSettings(): Settings {
  try {
    const s = { ...DEFAULT_SETTINGS, ...JSON.parse(load('vektor.settings') ?? '{}') };
    s.music = Math.min(MUSIC_NAMES.length - 1, Math.max(0, s.music | 0));
    s.muted = !!s.muted;
    s.mode = Math.min(MODES.length - 1, Math.max(0, s.mode | 0));
    s.players = s.players === 2 ? 2 : 1;
    return s;
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export class Game {
  phase: Phase = 'title';
  settings = loadSettings();
  menuRow = 0;
  paused = false;
  timer = 0;

  world: World | null = null;
  /** Bonuses for the stage just cleared: [label, points]. */
  tally: [string, number][] = [];

  tables: Tables = loadTables();
  /** World top 10s from the server; null until loaded or while offline. */
  global: Tables | null = null;
  globalState: 'loading' | 'ok' | 'offline' = 'loading';
  /** Show the world table (true) or this browser's own (false). */
  scoresGlobal = true;
  /** Row of the last game in the world table, or -1. */
  globalRank = -1;
  entryRank = -1;
  entryName: string[] = [];
  entryCursor = 0;
  private entryFresh = false;

  helpPage = 0;
  /** Gamepads connected: in a 2-player game that decides who flies with what. */
  pads = 0;
  /** Started with ?debug in the URL: cheat keys in play, and no high scores. */
  readonly debug = typeof location !== 'undefined' && new URLSearchParams(location.search).has('debug');
  /** Scroll of the terrain behind the menus. */
  titleDist = 0;

  constructor() {
    music.enabled = !this.settings.muted;
    this.refreshGlobal();
  }

  private async refreshGlobal() {
    // Games queued while offline go first, so the table includes them.
    await flushPending();
    const tables = await fetchGlobal();
    if (tables) this.global = tables;
    this.globalState = this.global ? 'ok' : 'offline';
    // Without world scores, show this browser's own.
    if (!this.global) this.scoresGlobal = false;
  }

  /** Posts a finished game to the world table and marks where it landed. */
  private async submitGlobal(e: ScoreEntry) {
    const mode = this.table;
    const res = await submitGlobal(mode, e);
    if (!res) return;
    this.global ??= Object.fromEntries(TABLES.map((t) => [t, []])) as unknown as Tables;
    this.global[mode] = res.top;
    this.globalState = 'ok';
    this.globalRank = res.rank;
  }

  get mode(): Mode {
    return MODES[this.settings.mode];
  }

  /** The high score table this game goes into: the mode, and 1 or 2 players. */
  get table(): TableId {
    return tableId(this.mode, this.settings.players);
  }

  /** The table's name: NORMAL, or NORMAL 2P. */
  get tableName() {
    return this.mode.name + (this.settings.players > 1 ? ' 2P' : '');
  }

  best(): ScoreEntry | undefined {
    return this.tables[this.table]?.[0];
  }

  step(input: Input) {
    const { pressed } = input;
    if (this.phase === 'entry') return this.stepEntry(input);
    if (pressed.has('mute')) this.toggleMusic();
    if (this.phase !== 'play' && this.phase !== 'clear') this.titleDist += 0.5;

    switch (this.phase) {
      case 'title':
        return this.stepTitle(pressed);
      case 'play':
        return this.stepPlay(input);
      case 'clear':
        return this.stepClear(input);
      case 'ending':
        return this.stepEnding(input);
      case 'over':
        this.world!.update(this.controls(input, false));
        if (++this.timer > 60 && (pressed.has('start') || pressed.has('fire'))) {
          if (this.entryRank >= 0) this.phase = 'entry';
          else this.showScores();
          sfx.select();
        }
        return;
      case 'scores':
        return this.stepScores(pressed);
      case 'help':
        return this.stepHelp(pressed);
    }
  }

  // ---------- menu ----------

  private saveSettings() {
    save('vektor.settings', JSON.stringify(this.settings));
  }

  private toggleMusic() {
    this.settings.muted = !music.toggle();
    this.saveSettings();
  }

  private get musicWanted() {
    return this.settings.music !== MUSIC_OFF;
  }

  private stepTitle(pressed: Set<Action>) {
    const s = this.settings;
    if (music.running) music.stop();
    if (pressed.has('up')) this.menuRow = (this.menuRow + MENU.length - 1) % MENU.length;
    if (pressed.has('down')) this.menuRow = (this.menuRow + 1) % MENU.length;
    if (pressed.has('up') || pressed.has('down')) sfx.move();

    const d = (pressed.has('right') ? 1 : 0) - (pressed.has('left') ? 1 : 0);
    const row = MENU[this.menuRow];
    if (row === 'HELP' && (d || pressed.has('start') || pressed.has('fire'))) {
      this.helpPage = 0;
      this.phase = 'help';
      sfx.select();
      return;
    }
    if (d) {
      const wrap = (v: number, n: number) => (v + d + n) % n;
      if (row === 'MUSIC') s.music = wrap(s.music, MUSIC_NAMES.length);
      if (row === 'MODE') s.mode = wrap(s.mode, MODES.length);
      if (row === 'PLAYERS') s.players = wrap(s.players - 1, 2) + 1;
      sfx.select();
      this.saveSettings();
    }
    if (pressed.has('scores')) {
      this.refreshGlobal();
      this.entryRank = -1;
      this.globalRank = -1;
      this.phase = 'scores';
      sfx.select();
    } else if (pressed.has('start') || pressed.has('fire')) this.startGame();
  }

  private stepHelp(pressed: Set<Action>) {
    const d = (pressed.has('right') ? 1 : 0) - (pressed.has('left') ? 1 : 0);
    if (d) {
      this.helpPage = (this.helpPage + d + HELP_PAGES.length) % HELP_PAGES.length;
      sfx.move();
    }
    if (pressed.has('start') || pressed.has('back') || pressed.has('quit') || pressed.has('fire')) {
      this.phase = 'title';
      sfx.select();
    }
  }

  // ---------- a run ----------

  startGame() {
    const mode = this.mode;
    this.world = new World(makeRng(randomSeed()), mode.lives, mode.shield, this.settings.players);
    this.entryRank = -1;
    this.paused = false;
    this.phase = 'play';
    this.timer = 0;
    sfx.start();
  }

  /** Each player's controls: player 1 from the main input (and touch), player 2 from its own. */
  private controls(input: Input, live = true): Controls[] {
    const ship = (h: Set<Action>, pressed: Set<Action>, touch: boolean): Controls => {
      const axis = (neg: Action, pos: Action) => (h.has(pos) ? 1 : 0) - (h.has(neg) ? 1 : 0);
      return {
        dx: live ? axis('left', 'right') : 0,
        dy: live ? axis('up', 'down') : 0,
        dragX: live && touch ? input.dragX : 0,
        dragY: live && touch ? input.dragY : 0,
        fire: live && (h.has('fire') || (touch && input.touching)),
        bomb: live && pressed.has('bomb'),
        swap: live && pressed.has('swap'),
      };
    };
    return [ship(input.held, input.pressed, true), ship(input.p2.held, input.p2.pressed, false)];
  }

  /** Stage tune that swells as the stage goes on; the boss gets its own. */
  private stepMusic(w: World) {
    if (!this.musicWanted || w.state === 'over') {
      if (music.running) music.stop();
      return;
    }
    const fight = w.boss || w.warning > 0;
    const want = fight ? (w.stageIdx === 5 ? TUNE.FINAL : TUNE.BOSS) : stageTune(w.stageIdx);
    if (w.state === 'clear') return music.stop();
    music.setIntensity(Math.min(5, 1 + Math.floor(w.progress * 5)));
    music.setTempo(1 + (w.loop - 1) * 0.05);
    music.setKey(w.stage.key + (want === TUNE.BOSS ? bossKey(w.stageIdx) : 0));
    if (!music.running || music.tune !== want) music.play(want, true);
  }

  private stepPlay(input: Input) {
    const { pressed } = input;
    const w = this.world!;
    this.timer++;
    if (pressed.has('start') || pressed.has('back')) {
      this.paused = !this.paused;
      sfx.pause();
      if (this.paused) music.halt();
      else music.resume();
      return;
    }
    if (this.paused) {
      if (pressed.has('quit')) this.toTitle();
      return;
    }
    if (this.debug) this.debugKeys(input.typed);
    w.update(this.controls(input));
    this.stepMusic(w);

    if (w.state === 'clear') {
      this.phase = 'clear';
      this.timer = 0;
      const bombs = w.players.reduce((n, p) => n + p.bombs, 0);
      this.tally = [
        ['NO-MISS BONUS', w.misses === 0 ? NO_MISS_BONUS * w.loop : 0],
        [`BOMBS ${bombs} X ${BOMB_BONUS}`, bombs * BOMB_BONUS],
      ];
    } else if (w.state === 'over') this.gameOver();
  }

  private stepClear(input: Input) {
    const w = this.world!;
    this.timer++;
    w.update(this.controls(input, false));
    TALLY_AT.slice(0, this.tally.length).forEach((at, i) => {
      if (this.timer !== at) return;
      w.addScore(this.tally[i][1]);
      if (this.tally[i][1]) sfx.tally();
    });
    if (this.timer >= CLEAR_FRAMES) {
      // After the last stage, the ending; then round again.
      if (w.stageIdx === STAGES.length - 1) {
        this.phase = 'ending';
        this.timer = 0;
        return;
      }
      w.nextStage();
      this.phase = 'play';
      this.timer = 0;
      sfx.start();
    }
  }

  /** The ending rolls by; START or FIRE skips it once it has run a while. Then the next loop starts. */
  private stepEnding(input: Input) {
    const w = this.world!;
    this.timer++;
    w.update(this.controls(input, false));
    const skip = this.timer > 180 && (input.pressed.has('start') || input.pressed.has('fire'));
    if (this.timer < ENDING_FRAMES && !skip) return;
    w.nextStage();
    this.phase = 'play';
    this.timer = 0;
    sfx.start();
  }

  private gameOver() {
    this.phase = 'over';
    this.timer = 0;
    music.stop();
    sfx.over();
    this.prepareEntry();
  }

  private toTitle() {
    this.phase = 'title';
    this.world = null;
    this.paused = false;
    this.entryRank = -1;
    music.stop();
    sfx.select();
  }

  // ---------- high scores ----------

  private prepareEntry() {
    const w = this.world!;
    this.entryRank = -1;
    this.globalRank = -1;
    this.scoresGlobal = !!this.global;
    if (w.score <= 0 || this.debug) return;
    const entry: ScoreEntry = { name: '', score: w.score, loop: w.loop, medals: w.medals };
    const list = this.tables[this.table];
    const at = rankFor(list, entry);
    const last = (load('vektor.name') ?? '').slice(0, NAME_LEN);
    if (at < 0) {
      // Not a personal record, but it still goes to the world table under the last name used.
      if (last.trim()) this.submitGlobal({ ...entry, name: last.trim() });
      return;
    }
    list.splice(at, 0, entry);
    list.length = Math.min(list.length, MAX_SCORES);
    this.entryRank = at;
    this.entryName = last.padEnd(NAME_LEN, ' ').split('');
    this.entryCursor = Math.min(NAME_LEN - 1, last.length);
    this.entryFresh = last.length > 0;
  }

  private stepEntry({ pressed, typed }: Input) {
    const name = this.entryName;
    const cycle = (d: number) => {
      const i = NAME_CHARS.indexOf(name[this.entryCursor]);
      name[this.entryCursor] = NAME_CHARS[(i + d + NAME_CHARS.length) % NAME_CHARS.length];
      sfx.move();
    };
    if (pressed.has('up')) cycle(1);
    if (pressed.has('down')) cycle(-1);
    if (pressed.has('left') && this.entryCursor > 0) this.entryCursor--;
    if (pressed.has('right') && this.entryCursor < NAME_LEN - 1) this.entryCursor++;

    for (const key of typed) {
      if (key === 'Enter') return this.commitName();
      if (key === 'Backspace') {
        if (name[this.entryCursor] === ' ' && this.entryCursor > 0) this.entryCursor--;
        name[this.entryCursor] = ' ';
      } else {
        // A suggested name is replaced as soon as you type.
        if (this.entryFresh) {
          name.fill(' ');
          this.entryCursor = 0;
        }
        name[this.entryCursor] = key;
        this.entryCursor = Math.min(NAME_LEN - 1, this.entryCursor + 1);
      }
      this.entryFresh = false;
      sfx.move();
    }
    if (pressed.size) this.entryFresh = false;
  }

  private commitName() {
    const name = this.entryName.join('').trim() || '------';
    const entry = this.tables[this.table][this.entryRank];
    entry.name = name;
    saveTables(this.tables);
    save('vektor.name', name);
    this.submitGlobal(entry);
    this.phase = 'scores';
    this.timer = 0;
    sfx.oneUp();
  }

  private showScores() {
    this.refreshGlobal();
    this.phase = 'scores';
    this.timer = 0;
  }

  private stepScores(pressed: Set<Action>) {
    if ((pressed.has('up') || pressed.has('down')) && this.global) {
      this.scoresGlobal = !this.scoresGlobal;
      sfx.move();
    }
    // Left and right page through the modes' tables; the last game's row only marks its own.
    const d = (pressed.has('right') ? 1 : 0) - (pressed.has('left') ? 1 : 0);
    if (d) {
      // Through every table: each mode for 1 player, then for 2.
      const n = MODES.length * 2;
      const i = ((this.settings.players - 1) * MODES.length + this.settings.mode + d + n) % n;
      this.settings.mode = i % MODES.length;
      this.settings.players = i >= MODES.length ? 2 : 1;
      this.saveSettings();
      this.entryRank = this.globalRank = -1;
      sfx.move();
    }
    if (pressed.has('start') || pressed.has('back') || pressed.has('scores') || pressed.has('fire')) this.toTitle();
  }

  // ---------- debug mode ----------

  /** 1-6 stage, N next stage, B boss, U full power and all weapons, I invincible, V next weapon. */
  private debugKeys(typed: string[]) {
    const w = this.world!;
    for (const k of typed) {
      if (k >= '1' && k <= String(STAGES.length)) this.gotoStage(Number(k));
      else if (k === 'N') this.gotoStage(w.stageIdx + 2);
      else if (k === 'B') this.bossNow();
      else if (k === 'U') for (const p of w.players) Object.assign(p, { level: MAX_LEVEL, missiles: MAX_MISSILES, bombs: MAX_BOMBS, owned: [...WEAPONS] });
      else if (k === 'I') w.god = !w.god;
      else if (k === 'V')
        for (const p of w.players) {
          // The next weapon, unlocked if need be.
          const next = WEAPONS[(WEAPONS.indexOf(p.weapon) + 1) % WEAPONS.length];
          w.arm(p, next);
          p.weapon = next;
        }
      else continue;
      sfx.select();
    }
  }

  // ---------- dev helpers ----------

  /** Jumps the stage to scroll distance `d` (dev only). */
  skipTo(d: number) {
    this.world?.skipTo(d);
  }

  bossNow() {
    if (this.world) this.skipTo(this.world.stage.length - 20);
  }

  /** Starts stage n, 1-based (dev only). */
  gotoStage(n: number) {
    this.world?.goTo(n - 1);
    this.timer = 0;
  }
}
