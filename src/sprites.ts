// Sprite registry: every PNG under src/assets, keyed by path without extension ("enemies/tank").
// Numbered files ("fx/explosion_small_3") also form frame strips ("fx/explosion_small").
// Anything missing gets a plain placeholder, so the game runs before the art is in.

const URLS = import.meta.glob(['./assets/**/*.png', '!./assets/**/*_example.png'], { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

export type Sprite = HTMLCanvasElement;

const sprites = new Map<string, Sprite>();
const strips = new Map<string, Sprite[]>();

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function loadImage(url: string) {
  return new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/** Loads every asset; call once before the game starts. */
export async function loadSprites() {
  await Promise.all(
    Object.entries(URLS).map(async ([path, url]) => {
      const img = await loadImage(url);
      if (!img) return;
      const c = canvas(img.width, img.height);
      c.getContext('2d')!.drawImage(img, 0, 0);
      sprites.set(path.replace(/^\.\/assets\//, '').replace(/\.png$/, ''), c);
    }),
  );
  const groups = new Map<string, [number, Sprite][]>();
  for (const [name, s] of sprites) {
    const m = /^(.*)_(\d+)$/.exec(name);
    if (!m) continue;
    if (!groups.has(m[1])) groups.set(m[1], []);
    groups.get(m[1])!.push([+m[2], s]);
  }
  for (const [name, frames] of groups) strips.set(name, frames.sort((a, b) => a[0] - b[0]).map((f) => f[1]));
}

export const has = (name: string) => sprites.has(name);

/** Names of the loaded sprites that start with `prefix`, sorted. */
export const named = (prefix: string) => [...sprites.keys()].filter((n) => n.startsWith(prefix)).sort();

// ---------- placeholders ----------

const PLACEHOLDER: Record<string, [number, number, string, 'jet' | 'box' | 'disc']> = {
  'ships/player': [32, 32, '#e04030', 'jet'],
  'enemies/fighter': [24, 24, '#6a7a40', 'jet'],
  'enemies/gunship': [48, 48, '#50607a', 'jet'],
  'enemies/carrier': [32, 32, '#c09030', 'box'],
  'enemies/tank': [24, 24, '#5a6a38', 'box'],
  'enemies/tank_turret': [16, 16, '#3a4a20', 'disc'],
  'enemies/bunker': [32, 32, '#888878', 'disc'],
  'enemies/wreck': [24, 24, '#302820', 'disc'],
  'enemies/interceptor': [24, 24, '#b09060', 'jet'],
  'enemies/bomber': [64, 64, '#a08858', 'jet'],
  'enemies/artillery': [32, 32, '#8a8068', 'disc'],
  'enemies/artillery_barrel': [32, 32, '#3a3428', 'disc'],
  'boss/boss2': [128, 96, '#8a7050', 'box'],
  'boss/boss2_open': [128, 96, '#9a5040', 'box'],
  'enemies/destroyer': [32, 64, '#506070', 'jet'],
  'enemies/drone': [16, 16, '#c03030', 'disc'],
  'boss/boss3': [96, 128, '#506070', 'box'],
  'boss/boss3_open': [96, 128, '#705050', 'box'],
  'enemies/heli': [32, 32, '#404850', 'jet'],
  'enemies/popup_closed': [24, 24, '#505860', 'disc'],
  'enemies/popup_open': [24, 24, '#a03030', 'disc'],
  'enemies/train_engine': [24, 40, '#3a4048', 'box'],
  'enemies/train_car': [24, 40, '#4a5058', 'box'],
  'boss/boss4': [128, 128, '#404850', 'box'],
  'boss/boss4_open': [128, 128, '#704040', 'box'],
  'enemies/lavaboat': [24, 40, '#3a2a28', 'box'],
  'enemies/magma_turret': [24, 24, '#5a2a18', 'disc'],
  'enemies/silo_closed': [32, 32, '#4a4040', 'disc'],
  'enemies/silo_open': [32, 32, '#a04020', 'disc'],
  'enemies/rocket': [16, 16, '#c0c0c0', 'jet'],
  'boss/boss5': [144, 128, '#4a2020', 'box'],
  'boss/boss5_open': [144, 128, '#a04020', 'box'],
  'boss/boss': [128, 96, '#5a6070', 'jet'],
  'boss/boss_open': [128, 96, '#7a5050', 'jet'],
  'items/medal': [16, 16, '#f8b800', 'disc'],
  'items/orb_v': [16, 16, '#f83800', 'disc'],
  'items/orb_l': [16, 16, '#3cbcfc', 'disc'],
  'items/orb_m': [16, 16, '#58d854', 'disc'],
  'items/orb_b': [16, 16, '#f8d838', 'disc'],
};

function placeholder(name: string): Sprite {
  const [w, h, color, shape] = PLACEHOLDER[name] ?? [16, 16, '#f0f', 'box'];
  const c = canvas(w, h);
  const g = c.getContext('2d')!;
  g.fillStyle = color;
  g.strokeStyle = '#000';
  if (shape === 'box') {
    g.fillRect(3, 3, w - 6, h - 6);
    g.strokeRect(3.5, 3.5, w - 7, h - 7);
  } else if (shape === 'disc') {
    g.beginPath();
    g.arc(w / 2, h / 2, Math.min(w, h) / 2 - 2, 0, Math.PI * 2);
    g.fill();
    g.stroke();
  } else {
    // A delta wing; enemies point down, the player up.
    const up = name.startsWith('ships/');
    const tip = up ? 1 : h - 1, back = up ? h - 3 : 3;
    g.beginPath();
    g.moveTo(w / 2, tip);
    g.lineTo(w - 1, back);
    g.lineTo(w / 2, back + (up ? -5 : 5));
    g.lineTo(1, back);
    g.closePath();
    g.fill();
    g.stroke();
  }
  return c;
}

/** The sprite, or a placeholder of the right size. */
export function spr(name: string): Sprite {
  let s = sprites.get(name);
  if (!s) sprites.set(name, (s = placeholder(name)));
  return s;
}

/** Frames of an animation, or [] when there are none. */
export const frames = (name: string) => strips.get(name) ?? [];

// ---------- derived variants ----------

function recolor(s: Sprite, color: string, alpha = 1) {
  const c = canvas(s.width, s.height);
  const g = c.getContext('2d')!;
  g.drawImage(s, 0, 0);
  g.globalCompositeOperation = 'source-in';
  g.globalAlpha = alpha;
  g.fillStyle = color;
  g.fillRect(0, 0, c.width, c.height);
  return c;
}

const derived = new Map<string, Sprite>();
function cached(key: string, make: () => Sprite) {
  let s = derived.get(key);
  if (!s) derived.set(key, (s = make()));
  return s;
}

/** The sprite with these rectangles cut out (for bosses whose limbs are drawn separately). */
export const without = (name: string, rects: { x: number; y: number; w: number; h: number }[]) =>
  cached(`without:${name}:${rects.map((r) => `${r.x},${r.y},${r.w},${r.h}`).join(';')}`, () => {
    const src = spr(name);
    const c = canvas(src.width, src.height);
    const g = c.getContext('2d')!;
    g.drawImage(src, 0, 0);
    for (const r of rects) g.clearRect(r.x, r.y, r.w, r.h);
    return c;
  });

/** All-white silhouette, for hit flashes. */
export const flash = (name: string) => cached(`flash:${name}`, () => recolor(spr(name), '#fcfcfc'));

/** Translucent black silhouette, for drop shadows on the ground. */
export const shadow = (name: string) => cached(`shadow:${name}`, () => recolor(spr(name), '#000', 0.4));

export const ROTATIONS = 32;

/** The sprite turned by step * (2π / ROTATIONS), nearest-neighbour so pixels stay crisp. */
export function rotated(name: string, step: number) {
  step = ((step % ROTATIONS) + ROTATIONS) % ROTATIONS;
  return cached(`rot:${name}:${step}`, () => {
    const src = spr(name);
    const w = src.width, h = src.height;
    const sd = src.getContext('2d')!.getImageData(0, 0, w, h).data;
    const c = canvas(w, h);
    const g = c.getContext('2d')!;
    const out = g.createImageData(w, h);
    const a = (step / ROTATIONS) * Math.PI * 2;
    const cos = Math.cos(a), sin = Math.sin(a);
    const cx = w / 2, cy = h / 2;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
        const sx = Math.floor(cos * dx + sin * dy + cx), sy = Math.floor(-sin * dx + cos * dy + cy);
        if (sx < 0 || sy < 0 || sx >= w || sy >= h) continue;
        const i = (sy * w + sx) * 4, o = (y * w + x) * 4;
        for (let k = 0; k < 4; k++) out.data[o + k] = sd[i + k];
      }
    g.putImageData(out, 0, 0);
    return c;
  });
}

/** Rotation step for a direction (dx, dy), where step 0 is the sprite's own facing: down. */
export const stepFor = (dx: number, dy: number) => Math.round((Math.atan2(-dx, dy) / (Math.PI * 2)) * ROTATIONS);

/** Draws a sprite centred on (x, y). */
export function drawAt(ctx: CanvasRenderingContext2D, s: Sprite, x: number, y: number) {
  ctx.drawImage(s, Math.round(x - s.width / 2), Math.round(y - s.height / 2));
}
