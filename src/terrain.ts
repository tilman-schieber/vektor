// The ground: a grid of terrain levels at tile corners (0 ocean, 1 sand, 2 jungle, 3 base),
// drawn with Wang tiles that pick their picture from their four corners.
import { W, H, hash } from './draw';
import { drawWangTile } from './tiles';

export const TILE = 16;
export const COLS = W / TILE;
/** Map length in tile rows; past the end the last row repeats. */
export const ROWS = 480;

export const enum Level {
  Ocean = 0,
  Sand = 1,
  Jungle = 2,
  Base = 3,
}

/** Smooth value noise, roughly -1..1. */
function noise(seed: number, x: number, y: number) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const fx = x - xi, fy = y - yi;
  const v = (a: number, b: number) => (hash(seed ^ hash(a * 7919 + b * 104729)) / 4294967296) * 2 - 1;
  const s = (t: number) => t * t * (3 - 2 * t);
  const top = v(xi, yi) + (v(xi + 1, yi) - v(xi, yi)) * s(fx);
  const bot = v(xi, yi + 1) + (v(xi + 1, yi + 1) - v(xi, yi + 1)) * s(fx);
  return top + (bot - top) * s(fy);
}

/** The stage's terrain level at corner (x, row), before smoothing. Row 0 is the start, at the bottom. */
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

export class Terrain {
  /** Corner levels, (COLS + 1) per row, ROWS + 1 rows. */
  levels: Uint8Array;
  private rows = new Map<number, HTMLCanvasElement>();

  constructor(seed: number) {
    const cw = COLS + 1;
    const lv = (this.levels = new Uint8Array(cw * (ROWS + 1)));
    for (let j = 0; j <= ROWS; j++) for (let x = 0; x < cw; x++) lv[j * cw + x] = profile(seed, x, j);
    // No specks or one-corner-wide strips: a corner needs two orthogonal neighbours at least as
    // high, or it sinks a level; and one hemmed in on three sides is filled up.
    const get = (x: number, j: number) => lv[Math.min(ROWS, Math.max(0, j)) * cw + Math.min(cw - 1, Math.max(0, x))];
    for (let pass = 0; pass < 3; pass++)
      for (let j = 0; j <= ROWS; j++)
        for (let x = 0; x < cw; x++) {
          const h = lv[j * cw + x];
          const nb = [get(x - 1, j), get(x + 1, j), get(x, j - 1), get(x, j + 1)];
          const up = nb.filter((v) => v >= h).length;
          const over = nb.filter((v) => v > h).length;
          const opposite = (get(x - 1, j) < h && get(x + 1, j) < h) || (get(x, j - 1) < h && get(x, j + 1) < h);
          if (h > 0 && (up < 2 || opposite)) lv[j * cw + x] = h - 1;
          else if (over >= 3) lv[j * cw + x] = h + 1;
        }
    // Neighbouring corners may differ by one level at most: the tiles only blend two terrains.
    for (let pass = 0; pass < 4; pass++)
      for (let j = 0; j <= ROWS; j++)
        for (let x = 0; x < cw; x++) {
          let m = 9;
          for (let dy = -1; dy <= 1; dy++)
            for (let dx = -1; dx <= 1; dx++) {
              const xx = x + dx, jj = j + dy;
              if (xx >= 0 && xx < cw && jj >= 0 && jj <= ROWS) m = Math.min(m, lv[jj * cw + xx]);
            }
          lv[j * cw + x] = Math.min(lv[j * cw + x], m + 1);
        }
  }

  /** Level at corner (x, j). */
  at(x: number, j: number) {
    return this.levels[Math.min(ROWS, Math.max(0, j)) * (COLS + 1) + x];
  }

  /** Terrain level under screen point (x, y) when `dist` has scrolled by. */
  levelAt(x: number, y: number, dist: number) {
    const wy = H - y + dist;
    return this.at(Math.round(x / TILE), Math.round(wy / TILE));
  }

  /** Wave crests that come and go on open water, so the sea doesn't look stamped out. */
  private glints(ctx: CanvasRenderingContext2D, r: number, y: number, frame: number) {
    for (let i = 0; i < COLS; i++) {
      if (this.at(i, r) || this.at(i + 1, r) || this.at(i, r + 1) || this.at(i + 1, r + 1)) continue;
      const h = hash(r * 977 + i * 131);
      const period = 90 + (h & 63);
      const phase = (frame + (h >> 8)) % period;
      if (phase > 24) continue;
      const len = phase < 6 || phase > 18 ? 2 : 4;
      const gx = i * TILE + ((h >> 16) % 10) + 1 + (phase >> 3), gy = y + ((h >> 20) % 12) + 2;
      ctx.fillStyle = phase < 6 || phase > 18 ? '#5890e0' : '#a8d0f8';
      ctx.fillRect(gx, gy, len, 1);
      if (len === 4) ctx.fillRect(gx + 1, gy - 1, 2, 1);
    }
  }

  /** One tile row as a picture. Row r spans world heights r*16 .. r*16+16. */
  private row(r: number) {
    let c = this.rows.get(r);
    if (c) return c;
    c = document.createElement('canvas');
    c.width = W;
    c.height = TILE;
    const g = c.getContext('2d')!;
    for (let i = 0; i < COLS; i++) {
      const nw = this.at(i, r + 1), ne = this.at(i + 1, r + 1), sw = this.at(i, r), se = this.at(i + 1, r);
      drawWangTile(g, [nw, ne, sw, se], i * TILE, 0, hash(r * 64 + i));
    }
    this.rows.set(r, c);
    return c;
  }

  draw(ctx: CanvasRenderingContext2D, dist: number, frame: number) {
    const d = Math.floor(dist);
    const first = Math.floor(d / TILE);
    for (let r = first; r <= first + H / TILE + 1; r++) {
      // Screen y of the row's top edge: world height (r+1)*16.
      const y = H - ((r + 1) * TILE - d);
      ctx.drawImage(this.row(Math.min(r, ROWS - 1)), 0, y);
      this.glints(ctx, Math.min(r, ROWS - 1), y, frame);
    }
    for (const r of this.rows.keys()) if (r < first - 2 || r > first + 40) this.rows.delete(r);
  }
}
