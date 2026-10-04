// Wang tile pictures. A tile is chosen by its four corner levels [nw, ne, sw, se].
// Tileset k blends level k (its "lower" terrain) into level k+1 ("upper"); the PixelLab metadata
// gives every tile's corners and where it sits in the sheet.
// Without the tileset art it falls back to plain quadrants with a little texture.
import { hash } from './draw';
import { has, spr } from './sprites';

interface TileMeta {
  corners: { NW: string; NE: string; SW: string; SE: string };
  bounding_box: { x: number; y: number; width: number; height: number };
}
interface TilesetJson {
  tileset_data: { tiles: TileMeta[] };
}

const JSONS = import.meta.glob('./assets/tiles/*.json', { eager: true, import: 'default' }) as Record<string, TilesetJson>;

/** Tileset per lower level: 0 ocean→sand, 1 sand→jungle, 2 jungle→base. */
const SETS = ['ocean_beach', 'beach_jungle', 'jungle_base'];

/** Per tileset: corner bits (nw ne sw se, upper = 1) -> sheet positions. */
const lookup: Map<number, [number, number][]>[] = SETS.map((name) => {
  const m = new Map<number, [number, number][]>();
  const json = JSONS[`./assets/tiles/${name}.json`];
  for (const t of json?.tileset_data.tiles ?? []) {
    const c = t.corners;
    const key = [c.NW, c.NE, c.SW, c.SE].reduce((k, v) => k * 2 + (v === 'upper' ? 1 : 0), 0);
    if (!m.has(key)) m.set(key, []);
    m.get(key)!.push([t.bounding_box.x, t.bounding_box.y]);
  }
  return m;
});

const COLORS = [
  ['#1050a0', '#1860b8', '#0c4890'],
  ['#d8b878', '#e4c890', '#c8a868'],
  ['#2c7a28', '#3a8c30', '#226a20'],
  ['#787c80', '#888c90', '#6c7074'],
];

function fallback(g: CanvasRenderingContext2D, corners: number[], x: number, y: number, seed: number) {
  for (let q = 0; q < 4; q++) {
    const qx = x + (q % 2) * 8, qy = y + (q >> 1) * 8;
    const pal = COLORS[corners[q]];
    g.fillStyle = pal[0];
    g.fillRect(qx, qy, 8, 8);
    for (let k = 0; k < 6; k++) {
      const h = hash(seed * 31 + q * 7 + k);
      g.fillStyle = pal[1 + (h & 1)];
      g.fillRect(qx + ((h >> 4) & 7), qy + ((h >> 8) & 7), 1 + ((h >> 12) & 1), 1);
    }
  }
}

/** Which tileset and corner bits draw these corners. Corners differ by at most one level. */
function pick(corners: number[], seed: number): [number, number] {
  const lo = Math.min(...corners);
  const hi = Math.max(...corners);
  if (lo === hi) {
    // A plain tile: it is the lower terrain of one set and the upper of the one before; take either.
    if (lo === 0) return [0, 0];
    if (lo === SETS.length) return [SETS.length - 1, 15];
    return seed & 1 ? [lo, 0] : [lo - 1, 15];
  }
  return [lo, corners.reduce((k, v) => k * 2 + (v > lo ? 1 : 0), 0)];
}

export function drawWangTile(g: CanvasRenderingContext2D, corners: number[], x: number, y: number, seed: number) {
  const [set, key] = pick(corners, seed);
  const name = `tiles/${SETS[set]}`;
  const options = lookup[set].get(key);
  if (!has(name) || !options?.length) return fallback(g, corners, x, y, seed);
  const [sx, sy] = options[(seed >> 3) % options.length];
  g.drawImage(spr(name), sx, sy, 16, 16, x, y, 16, 16);
}
