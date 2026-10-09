import { Game, MENU, MUSIC_NAMES, NAME_LEN, CARD_FRAMES, TALLY_AT } from './game';
import { World, Player, Shot, Blast, Item, MAX_LEVEL, MAX_MISSILES, SHIELD_REGEN, WARNING_FRAMES } from './world';
import { Enemy, ItemKind, WeaponKind, WEAPONS, DESTROYER_GUNS, LAVABOAT_GUN, popupOpen, magmaRise, siloOpen, hangarOpen, GRAVITY_R, STEALTH_SHOW } from './enemies';
import { aimAt } from './bullets';
import { SUB_CYCLE, SUB_UP, SUB_DOWN, ICEBREAKER_GUNS, CHOPPER_HUB, SHIELD_R, SHIELD_GAP, shieldGap } from './mid';
import { Boss, walkerHead, LIGHT_SPREAD, BEAM_AIM, BEAM_LOCK, MORTAR_FUSE, MORTAR_R, CHARGE_FRAMES } from './boss';
import { STAGES } from './stages';
import { Terrain, TILE } from './terrain';
import { MAX_SCORES } from './scores';
import { HELP_PAGES, wrapText } from './help';
import { drawText, drawTextCentered, drawTextScaled, drawTextShadow, textWidth } from './font';
import { Ctx, W, H, WHITE, RED, GREY, LIGHT, DARK, YELLOW, GOLD, BLUE, drawBox, disc, pad, hash } from './draw';
import { spr, has, frames, flash, shadow, rotated, stepFor, drawAt, without } from './sprites';

export { W, H };

/** Air units cast their shadow this far down and right. */
const SHADOW_X = 7;
const SHADOW_Y = 12;

// ---------- the play field ----------

function drawShadow(ctx: Ctx, name: string, x: number, y: number, dist = 1) {
  drawAt(ctx, shadow(name), x + SHADOW_X * dist, y + SHADOW_Y * dist);
}

/** The enemy's sprite, turned to face where it flies (fighters) and white while hit. */
function enemySprite(e: Enemy) {
  const name = e.def.sprite;
  if (e.flash > 0) return flash(name);
  if (['fighter', 'raider', 'interceptor', 'rocket', 'wormHead', 'wormBody', 'serpentHead', 'serpentBody'].includes(e.def.name)) return rotated(name, stepFor(e.vx, e.vy || 0.01));
  // Asteroids tumble, each its own way round.
  if (e.def.name === 'asteroid') return rotated(name, Math.floor(e.t / 7) * ((e.p[0] ?? 0) < 0 ? -1 : 1));
  return spr(name);
}

/** A gun barrel drawn in code, from (x, y) toward `aim`. */
function drawBarrel(ctx: Ctx, x: number, y: number, aim: number, len = 12) {
  const dx = Math.sin(aim), dy = Math.cos(aim);
  // Black outline first, then a steel core, so it reads on dark turrets and light ground alike.
  ctx.fillStyle = '#000';
  for (let k = 3; k <= len; k++) ctx.fillRect(Math.round(x + dx * k) - 1, Math.round(y + dy * k) - 1, 3, 3);
  for (let k = 3; k < len; k++) {
    ctx.fillStyle = k > len - 3 ? '#585858' : '#a8acb4';
    ctx.fillRect(Math.round(x + dx * k), Math.round(y + dy * k), 1, 1);
  }
}

function drawGroundEnemy(ctx: Ctx, e: Enemy, w: World, frame: number) {
  if (e.def.name === 'destroyer') {
    // Foam churned up astern.
    for (let k = 0; k < 6; k++) {
      ctx.fillStyle = (frame + k * 3) % 8 < 4 ? WHITE : '#a8d0f8';
      ctx.fillRect(Math.round(e.x) - 3 + ((k * 5 + (frame >> 3)) % 7), Math.round(e.y) - 34 - (k % 3) * 2, 2, 1);
    }
    drawAt(ctx, enemySprite(e), e.x, e.y);
    for (const gy of DESTROYER_GUNS) drawBarrel(ctx, e.x, e.y + gy, aimAt(w, e.x, e.y + gy), 10);
    return;
  }
  if (e.def.name === 'tank') {
    // Hull faces the way it rolls over the ground; the turret tracks the player.
    const step = stepFor(e.vx, e.vy - w.scroll || 0.01);
    drawAt(ctx, e.flash > 0 ? flash('enemies/tank') : rotated('enemies/tank', step), e.x, e.y);
    drawAt(ctx, rotated('enemies/tank_turret', stepFor(Math.sin(e.aim), Math.cos(e.aim))), e.x, e.y);
    return;
  }
  if (e.def.name === 'magmaTurret') {
    const rise = magmaRise(e);
    if (rise <= 0) {
      // Under the lava: only bubbles give it away.
      if ((frame >> 3) % 3 === 0) disc(ctx, e.x + ((frame >> 3) % 5) - 2, e.y + 2, 1.5, '#ffd860');
      return;
    }
    // Rises out of the lava: shown from the top down as it comes up.
    const s = e.flash > 0 ? flash('enemies/magma_turret') : spr('enemies/magma_turret');
    const h = Math.max(1, Math.round(s.height * rise));
    ctx.drawImage(s, 0, 0, s.width, h, Math.round(e.x - s.width / 2), Math.round(e.y - s.height / 2), s.width, h);
    if (rise >= 1) drawBarrel(ctx, e.x, e.y, e.aim, 10);
    return;
  }
  if (e.def.name === 'silo') {
    const name = siloOpen(e) ? 'enemies/silo_open' : 'enemies/silo_closed';
    drawAt(ctx, e.flash > 0 ? flash(name) : spr(name), e.x, e.y);
    return;
  }
  if (e.def.name === 'lavaboat') {
    drawAt(ctx, enemySprite(e), e.x, e.y);
    drawBarrel(ctx, e.x, e.y + LAVABOAT_GUN, e.aim, 10);
    return;
  }
  if (e.def.name === 'submarine') {
    // Under water it shows as a dark shape; it rises and sinks through the surface, foaming.
    const k = e.t % SUB_CYCLE;
    const up = k < SUB_UP ? k / SUB_UP : k < SUB_DOWN ? 1 : Math.max(0, 1 - (k - SUB_DOWN) / 50);
    ctx.save();
    ctx.globalAlpha = 0.18 + 0.82 * up;
    drawAt(ctx, enemySprite(e), e.x, e.y);
    ctx.restore();
    if (up > 0 && up < 1)
      for (let i = 0; i < 10; i++) {
        const h = hash(i * 31 + (frame >> 2));
        ctx.fillStyle = i % 2 ? WHITE : '#a8d0f8';
        ctx.fillRect(Math.round(e.x - 14 + (h % 28)), Math.round(e.y - 40 + ((h >>> 8) % 80)), 2, 1);
      }
    return;
  }
  if (e.def.name === 'icebreaker') {
    // Broken ice churned up round the bow.
    for (let k = 0; k < 8; k++) {
      ctx.fillStyle = (frame + k * 5) % 10 < 5 ? WHITE : '#c8e8f8';
      ctx.fillRect(Math.round(e.x) - 14 + ((k * 7 + (frame >> 2)) % 28), Math.round(e.y) + 46 + (k % 3) * 3, 2, 2);
    }
    drawAt(ctx, enemySprite(e), e.x, e.y);
    for (const [gx, gy] of ICEBREAKER_GUNS) drawBarrel(ctx, e.x + gx, e.y + gy, aimAt(w, e.x + gx, e.y + gy), 12);
    return;
  }
  if (e.def.name === 'popup' || e.def.name === 'hangar') {
    const open = e.def.name === 'popup' ? popupOpen(e) : hangarOpen(e);
    const name = `enemies/${e.def.name}_${open ? 'open' : 'closed'}`;
    drawAt(ctx, e.flash > 0 ? flash(name) : spr(name), e.x, e.y);
    return;
  }
  drawAt(ctx, enemySprite(e), e.x, e.y);
  if (e.def.name === 'trainCar') drawBarrel(ctx, e.x, e.y, e.aim, 11);
  if (e.def.name === 'artillery') drawAt(ctx, rotated('enemies/artillery_barrel', stepFor(Math.sin(e.aim), Math.cos(e.aim))), e.x, e.y);
}

/** Laser colours per level: outer, body, core. Level 5 burns white-hot. */
const LASER = [
  ['#0040b8', '#2878f8', '#a8d8fc'],
  ['#0058f8', '#3cbcfc', '#d8f0fc'],
  ['#0078f8', '#58d8fc', '#fcfcfc'],
  ['#00a0f8', '#80ecfc', '#fcfcfc'],
  ['#00c8f8', '#b8f8fc', '#fcfcfc'],
];

function drawShot(ctx: Ctx, s: Shot, frame: number) {
  const x = Math.round(s.x), y = Math.round(s.y);
  const lv = s.level ?? 1;
  if (s.kind === 'vulcan') {
    // Bigger and hotter with each level.
    const h = lv >= 5 ? 10 : lv >= 3 ? 9 : 7;
    const w = lv >= 5 ? 4 : 3;
    if (lv >= 3) {
      ctx.fillStyle = 'rgba(248,120,0,0.45)';
      ctx.fillRect(x - Math.floor(w / 2) - 1, y - 4, w + 2, h + 1);
    }
    ctx.fillStyle = lv >= 5 ? '#f8b800' : '#f87800';
    ctx.fillRect(x - Math.floor(w / 2), y - 3, w, h);
    ctx.fillStyle = lv >= 5 ? '#fcfcfc' : '#fcfc80';
    ctx.fillRect(x - (lv >= 5 ? 1 : 0), y - 3, lv >= 5 ? 2 : 1, h - 1);
  } else if (s.kind === 'laser') {
    const wd = s.width!;
    const [outer, body, core] = LASER[lv - 1];
    // Level 5 ripples with heat.
    const wob = lv >= 5 ? Math.round(Math.sin((s.y + frame * 3) / 5) * 1.5) : 0;
    const left = x - Math.floor(wd / 2) + wob;
    if (lv >= 2) {
      ctx.fillStyle = lv >= 5 ? 'rgba(160,240,252,0.32)' : 'rgba(60,188,252,0.25)';
      ctx.fillRect(left - 2, y - 11, wd + 4, 22);
    }
    ctx.fillStyle = outer;
    ctx.fillRect(left, y - 11, wd, 22);
    ctx.fillStyle = body;
    ctx.fillRect(left + 1, y - 11, Math.max(1, wd - 2), 22);
    ctx.fillStyle = core;
    const c = Math.max(1, Math.floor(wd / 3) - ((frame >> 1) % 2));
    ctx.fillRect(x + wob - Math.floor(c / 2), y - 11, c, 22);
    // Sparks crackle along the beam from level 3.
    if (lv >= 3 && (frame + s.t) % 5 === 0) {
      ctx.fillStyle = '#fcfcfc';
      ctx.fillRect(left + ((s.t * 7 + frame) % wd), y - 11 + ((s.t * 13) % 22), 1, 1);
    }
  } else {
    // A missile: body along its heading, flame behind.
    const len = Math.hypot(s.vx, s.vy) || 1;
    const ux = s.vx / len, uy = s.vy / len;
    for (let k = 0; k < 5; k++) {
      ctx.fillStyle = k < 1 ? WHITE : '#a0a8b0';
      ctx.fillRect(Math.round(x - ux * k), Math.round(y - uy * k), 2, 2);
    }
    ctx.fillStyle = frame % 2 ? '#f8b800' : '#f83800';
    ctx.fillRect(Math.round(x - ux * 6), Math.round(y - uy * 6), 2, 2);
  }
}

/** Explosion: the PixelLab frames when there are any, otherwise a growing fireball. */
function drawBlast(ctx: Ctx, b: Blast) {
  const life = b.big ? 48 : 30;
  const strip = frames(b.big ? 'fx/explosion_big' : 'fx/explosion_small');
  if (strip.length) {
    const f = strip[Math.min(strip.length - 1, Math.floor((b.t / life) * strip.length))];
    drawAt(ctx, f, b.x, b.y);
    return;
  }
  const k = b.t / life;
  const r = (b.big ? 26 : 13) * Math.sin(Math.min(1, k * 1.6) * Math.PI * 0.5);
  if (k < 0.7) {
    disc(ctx, b.x, b.y, r, k < 0.15 ? WHITE : k < 0.35 ? '#f8d838' : '#f87800');
    disc(ctx, b.x, b.y, r * 0.6, k < 0.3 ? WHITE : '#f8d838');
  } else disc(ctx, b.x, b.y, r * (1.6 - k), '#585858');
}

/** Each pickup: its sprite, the colour it glows in (r,g,b), and its letter for the placeholder. */
const ITEM_LOOK: Record<ItemKind, [string, string, string]> = {
  vulcan: ['items/vulcan', '248,88,56', 'V'],
  laser: ['items/laser', '60,188,252', 'L'],
  plasma: ['items/plasma', '176,96,248', 'P'],
  missile: ['items/missile', '88,216,84', 'M'],
  bomb: ['items/bomb', '248,216,56', 'B'],
  medal: ['items/medal', '', ''],
};

/** Frames after which a power-up drifts away (see updateItems); it blinks before then. */
const ITEM_LEAVES = 60 * 12;

function drawItem(ctx: Ctx, it: Item, frame: number) {
  const [name, glow, letter] = ITEM_LOOK[it.kind];
  if (it.kind === 'medal') return drawAt(ctx, spr(name), it.x, it.y);
  if (it.t > ITEM_LEAVES - 90 && (frame >> 2) % 2) return;
  const bob = Math.round(Math.sin(frame / 8));
  // A soft glow in its colour, pulsing, so it reads over any ground.
  const r = 14 + Math.sin(frame / 6) * 2;
  const g = ctx.createRadialGradient(it.x, it.y + bob, 2, it.x, it.y + bob, r);
  g.addColorStop(0, `rgba(${glow},0.55)`);
  g.addColorStop(1, `rgba(${glow},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(it.x - r, it.y + bob - r, r * 2, r * 2);
  drawAt(ctx, spr(name), it.x, it.y + bob);
  if (!has(name)) drawTextShadow(ctx, letter, Math.round(it.x) - 2, Math.round(it.y) - 3 + bob);
}

/** Plasma bolts: jagged violet lightning with a white core, new zigzags every frame. */
function drawBolts(ctx: Ctx, w: World, frame: number) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineJoin = 'round';
  for (const b of w.bolts) {
    const path: [number, number][] = [];
    for (let i = 0; i + 3 < b.pts.length; i += 2) {
      const [x0, y0, x1, y1] = b.pts.slice(i, i + 4);
      const len = Math.hypot(x1 - x0, y1 - y0) || 1;
      const nx = -(y1 - y0) / len, ny = (x1 - x0) / len;
      const n = Math.max(2, Math.round(len / 10));
      for (let k = 0; k < n; k++) {
        const f = k / n, h = hash(frame * 31 + i * 7 + k);
        const off = k ? ((h % 9) - 4) * Math.min(1, len / 40) : 0;
        path.push([x0 + (x1 - x0) * f + nx * off, y0 + (y1 - y0) * f + ny * off]);
      }
      if (i + 4 >= b.pts.length) path.push([x1, y1]);
    }
    const fade = 1 - b.t / 4;
    for (const [width, color] of [[7, `rgba(120,40,248,${0.5 * fade})`], [3, `rgba(176,96,248,${fade})`], [1, `rgba(240,220,252,${fade})`]] as const) {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.beginPath();
      path.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.stroke();
    }
    // Where it strikes, a spark.
    for (let i = 2; i < b.pts.length; i += 2) disc(ctx, b.pts[i], b.pts[i + 1], 3 - b.t * 0.5, `rgba(220,180,252,${fade})`);
  }
  ctx.restore();
}

function drawBullets(ctx: Ctx, w: World, frame: number) {
  for (const b of w.bullets) {
    if (b.life !== undefined) {
      // Flame: hot to cool as it burns out.
      const k = b.t / b.life;
      disc(ctx, b.x, b.y, k < 0.5 ? 2.5 : 2, k < 0.3 ? '#fff0a0' : k < 0.6 ? '#f8b800' : '#f85800');
      continue;
    }
    if (b.weave !== undefined) {
      // Frost shard: an ice-blue diamond with a white glint.
      const x = Math.round(b.x), y = Math.round(b.y);
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.moveTo(x, y - 5);
      ctx.lineTo(x + 4, y);
      ctx.lineTo(x, y + 5);
      ctx.lineTo(x - 4, y);
      ctx.fill();
      ctx.fillStyle = ((frame + b.t) >> 3) % 2 ? '#3cbcfc' : '#0070ec';
      ctx.beginPath();
      ctx.moveTo(x, y - 4);
      ctx.lineTo(x + 3, y);
      ctx.lineTo(x, y + 4);
      ctx.lineTo(x - 3, y);
      ctx.fill();
      ctx.fillStyle = WHITE;
      ctx.fillRect(x - 1, y - 1, 2, 2);
      continue;
    }
    if (b.hang !== undefined) {
      // Needle: a brass dart pointing where it will go; it glows red-hot just before it flies.
      const sx = Math.sin(b.ang!), sy = Math.cos(b.ang!);
      const hot = b.t >= b.hang || (b.hang - b.t < 12 && frame % 4 < 2);
      ctx.lineCap = 'round';
      for (const [width, color] of [[4, '#000'], [2, hot ? '#f85838' : '#e8b848']] as const) {
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.beginPath();
        ctx.moveTo(b.x - sx * 5, b.y - sy * 5);
        ctx.lineTo(b.x + sx * 4, b.y + sy * 4);
        ctx.stroke();
      }
      disc(ctx, b.x + sx * 4, b.y + sy * 4, 1, hot ? '#fcfcfc' : '#fce0a8');
      continue;
    }
    if (b.burstN) {
      // Dropped bomb: dark body with fins and a red light that blinks faster before it bursts.
      const x = Math.round(b.x), y = Math.round(b.y);
      ctx.fillStyle = '#000';
      ctx.fillRect(x - 3, y - 5, 7, 10);
      ctx.fillStyle = '#585868';
      ctx.fillRect(x - 2, y - 3, 5, 7);
      ctx.fillRect(x - 3, y - 5, 7, 2);
      const fast = b.t > b.burst! - 15;
      ctx.fillStyle = (frame >> (fast ? 1 : 3)) % 2 ? RED : '#f8d838';
      ctx.fillRect(x - 1, y + 1, 3, 3);
      continue;
    }
    if (b.burst !== undefined) {
      // Lava bomb: a dark crust round a glowing middle that swells before it bursts.
      const r = 3 + (b.t > b.burst - 15 && frame % 4 < 2 ? 1 : 0);
      disc(ctx, b.x, b.y, r + 1, '#000');
      disc(ctx, b.x, b.y, r, '#3a1810');
      disc(ctx, b.x, b.y, r - 1.5, frame % 6 < 3 ? '#f87800' : '#f8d838');
      continue;
    }
    const blink = ((frame + b.t) >> 2) % 2;
    disc(ctx, b.x, b.y, b.r + 1, '#000');
    disc(ctx, b.x, b.y, b.r, b.big ? (blink ? '#f878f8' : '#d800cc') : blink ? '#f83800' : '#f8a000');
    disc(ctx, b.x, b.y, b.r - 1.5, WHITE);
  }
}

function drawPlayer(ctx: Ctx, p: Player, frame: number) {
  if (!p.alive) return;
  if (p.invuln > 0 && p.invuln < 1e6 && (frame >> 2) % 2) return;
  let name = 'ships/player';
  if (p.bank < -0.45 && has('ships/player_l')) name = 'ships/player_l';
  if (p.bank > 0.45 && has('ships/player_r')) name = 'ships/player_r';
  // Engine flame.
  const fl = frame % 3;
  ctx.fillStyle = fl ? '#f8b800' : '#f83800';
  ctx.fillRect(Math.round(p.x) - 1, Math.round(p.y) + 13, 3, 2 + fl);
  drawAt(ctx, p.id ? blueShip(name) : spr(name), p.x, p.y);
  if (p.shield) drawShield(ctx, p.x, p.y, frame);
}

const blueShips = new Map<string, HTMLCanvasElement>();
/** Player 2's ship: player 1's, its reds turned blue. */
function blueShip(name: string) {
  let c = blueShips.get(name);
  if (c) return c;
  const src = spr(name);
  c = document.createElement('canvas');
  c.width = src.width;
  c.height = src.height;
  const g = c.getContext('2d')!;
  g.drawImage(src, 0, 0);
  const img = g.getImageData(0, 0, c.width, c.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const [r, gr, b] = [d[i], d[i + 1], d[i + 2]];
    // Reddish pixels swap red and blue; greys and whites stay.
    if (r > gr + 30 && r > b + 30) {
      d[i] = b;
      d[i + 1] = Math.min(255, gr + (r - gr) * 0.35);
      d[i + 2] = r;
    }
  }
  g.putImageData(img, 0, 0);
  blueShips.set(name, c);
  return c;
}

/** Easy mode's shield: a flickering blue ring round the ship. */
function drawShield(ctx: Ctx, x: number, y: number, frame: number) {
  ctx.save();
  ctx.globalAlpha = 0.75 + Math.sin(frame / 6) * 0.2;
  ctx.lineWidth = 1;
  ctx.strokeStyle = '#000';
  ctx.beginPath();
  ctx.arc(Math.round(x) + 0.5, Math.round(y) + 1.5, 18, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = (frame >> 3) % 2 ? '#d8f8f8' : '#78d8f8';
  ctx.beginPath();
  ctx.arc(Math.round(x) + 0.5, Math.round(y) + 1.5, 17, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawBoss(ctx: Ctx, b: Boss, frame: number) {
  if (b.gone) return;
  const name = b.open ? b.def.openSprite : b.def.sprite;
  const limbs = b.def.limbs;
  if (limbs) {
    // Limbs go under the body, each moved with its pod; the cut overlaps the body by a few rows.
    const s = spr(name);
    const ox = Math.round(b.x - s.width / 2), oy = Math.round(b.y - s.height / 2);
    for (const l of limbs) {
      const [dx, dy] = b.def.podOffset?.(b, l.pod) ?? [0, 0];
      ctx.drawImage(s, l.x, l.y - 4, l.w, l.h + 4, ox + l.x + dx, oy + l.y - 4 + dy, l.w, l.h + 4);
    }
    ctx.drawImage(without(name, limbs), ox, oy);
  } else drawAt(ctx, spr(name), b.x, b.y);
  // A big hull only glints when hit; a full white flash would strobe under the laser.
  if (b.parts.some((p) => p.flash > 0 && !p.armored) && frame % 4 < 2) {
    ctx.globalAlpha = 0.35;
    drawAt(ctx, flash(name), b.x, b.y);
    ctx.globalAlpha = 1;
  }
  b.pods.forEach((pod, i) => {
    const [x, y] = b.podPos(i);
    if (pod.dead) {
      // Wrecked pods smoke and burn.
      disc(ctx, x, y, 8, '#202020');
      disc(ctx, x + ((frame >> 2) % 3) - 1, y - 2, 3 + (frame % 3), frame % 4 < 2 ? '#f87800' : '#f8d838');
    } else if (b.hasGun(i)) drawBarrel(ctx, x, y, pod.aim);
  });
  // The core glows once open, and pulses fast in a rage.
  if (b.open && b.dying < 0) {
    const speed = b.phase === 3 ? 3 : 5;
    const r = 4 + ((frame >> speed) % 2);
    disc(ctx, b.coreX, b.coreY, r + 2, '#f83800');
    disc(ctx, b.coreX, b.coreY, r - 1, b.core.flash ? WHITE : '#f8d838');
  }
}

/** A boss's searchlight and mortar markers, on the ground. */
function drawBossGround(ctx: Ctx, b: Boss, frame: number) {
  if (b.dying >= 0) return;
  if (b.light !== null) {
    const [x, y] = walkerHead(b);
    const len = H * 1.3, caught = b.spotted > 0;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = caught ? (frame % 8 < 4 ? 'rgba(255,80,60,0.30)' : 'rgba(255,120,80,0.22)') : 'rgba(255,240,190,0.16)';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.sin(b.light - LIGHT_SPREAD) * len, y + Math.cos(b.light - LIGHT_SPREAD) * len);
    ctx.lineTo(x + Math.sin(b.light + LIGHT_SPREAD) * len, y + Math.cos(b.light + LIGHT_SPREAD) * len);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  for (const m of b.marks) {
    // A target ring that blinks faster as the shell comes down, and the shell's shadow growing in it.
    const k = m.t / MORTAR_FUSE;
    const on = (frame >> (k > 0.6 ? 1 : 3)) % 2 === 0;
    ctx.strokeStyle = on ? RED : '#f8a000';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(Math.round(m.x) + 0.5, Math.round(m.y) + 0.5, MORTAR_R, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = on ? RED : '#f8a000';
    ctx.fillRect(Math.round(m.x) - 4, Math.round(m.y), 9, 1);
    ctx.fillRect(Math.round(m.x), Math.round(m.y) - 4, 1, 9);
    ctx.globalAlpha = 0.45;
    disc(ctx, m.x, m.y, 1 + k * (MORTAR_R - 4), '#000');
    ctx.globalAlpha = 1;
  }
}

/** A boss's beam: a thin flickering line while it aims, then the beam itself; a charge and its all-out beam. */
function drawBossBeam(ctx: Ctx, b: Boss, frame: number) {
  if (b.dying >= 0) return;
  const x = b.coreX, y = b.coreY + 8;
  ctx.save();
  ctx.lineCap = 'round';
  if (b.beam) {
    const angs = b.beam.twin ? [b.beam.ang, -b.beam.ang] : [b.beam.ang];
    for (const ang of angs) {
      const ex = x + Math.sin(ang) * 500, ey = y + Math.cos(ang) * 500;
      const line = (width: number, color: string) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(ex, ey);
        ctx.stroke();
      };
      if (b.beam.t < BEAM_AIM) {
        // It flickers, and turns white and thicker just before it fires.
        if (b.beam.t >= BEAM_AIM - BEAM_LOCK) line(2, WHITE);
        else line(1, frame % 4 < 2 ? '#f878f8' : '#a800a0');
      } else {
        ctx.globalCompositeOperation = 'lighter';
        line(12 + (frame % 3), 'rgba(216,0,204,0.35)');
        line(7, '#d800cc');
        line(3, '#f8b8f8');
        disc(ctx, x, y, 7 + (frame % 2), '#f878f8');
        ctx.globalCompositeOperation = 'source-over';
      }
    }
  }
  if (b.charge) {
    // Light gathers in the core, faster and brighter; the bar says how long is left to break it.
    const k = b.charge.t / CHARGE_FRAMES;
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 6; i++) {
      const a = i * 1.047 + frame / 10, d = 40 * (1 - ((frame * 2 + i * 9) % 40) / 40);
      disc(ctx, b.coreX + Math.cos(a) * d, b.coreY + Math.sin(a) * d, 1.5, '#f8b8f8');
    }
    disc(ctx, b.coreX, b.coreY, 4 + k * 14 + (frame % 3), 'rgba(216,0,204,0.5)');
    disc(ctx, b.coreX, b.coreY, 2 + k * 8, WHITE);
    ctx.globalCompositeOperation = 'source-over';
    if ((frame >> 3) % 2) drawTextCentered(ctx, 'BREAK THE CORE!', W / 2, b.coreY + 48, YELLOW);
    ctx.fillStyle = '#000';
    ctx.fillRect(W / 2 - 41, b.coreY + 60, 82, 5);
    ctx.fillStyle = '#d800cc';
    ctx.fillRect(W / 2 - 40, b.coreY + 61, Math.round(80 * k), 3);
  }
  if (b.mega > 0) {
    // The all-out beam: the whole screen below the core burns.
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = `rgba(216,0,204,${frame % 4 < 2 ? 0.45 : 0.3})`;
    ctx.fillRect(0, b.coreY, W, H);
    ctx.fillStyle = 'rgba(248,184,248,0.5)';
    ctx.fillRect(W / 2 - 50 + Math.sin(frame / 3) * 6, b.coreY, 100, H);
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.restore();
}

/** Laser fences between satellite pairs, and the reach of gravity drones. */
function drawFields(ctx: Ctx, w: World, frame: number) {
  ctx.save();
  for (const e of w.enemies) {
    if (e.def.name === 'gravity') {
      // A ring of dashes turning inward, faint, to show how far the pull reaches.
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = '#a858f8';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 6]);
      ctx.lineDashOffset = -frame / 2;
      for (const k of [1, 0.6]) {
        ctx.beginPath();
        ctx.arc(e.x, e.y, GRAVITY_R * k * (1 - ((frame / 90) % 1) * 0.15), 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }
    if (e.def.name === 'satellite' && e.link && !e.link.dead && e.p[3] <= Math.PI / 2) {
      ctx.globalCompositeOperation = 'lighter';
      for (const [width, color] of [[5, 'rgba(248,56,120,0.35)'], [2, frame % 4 < 2 ? '#f87898' : '#f83858'], [1, WHITE]] as const) {
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.beginPath();
        ctx.moveTo(e.x, e.y);
        ctx.lineTo(e.link.x, e.link.y);
        ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over';
    }
  }
  ctx.restore();
}

/** A stealth fighter: a faint shimmer while cloaked, flickering in and out as it shows itself. */
function drawStealth(ctx: Ctx, e: Enemy, frame: number) {
  const [show, hide] = STEALTH_SHOW;
  const edge = Math.min(Math.abs(e.t - show), Math.abs(e.t - hide));
  ctx.save();
  if (e.hidden) ctx.globalAlpha = 0.1 + (frame % 6 < 3 ? 0.08 : 0);
  else if (edge < 10 && frame % 4 < 2) ctx.globalAlpha = 0.5;
  drawAt(ctx, enemySprite(e), e.x, e.y);
  ctx.restore();
}

/** Ash drifting down and embers rising, in screen space. */
function drawAsh(ctx: Ctx, frame: number) {
  for (let i = 0; i < 46; i++) {
    const h = hash(i * 97 + 3);
    const vy = 0.25 + ((h >>> 4) % 10) / 25;
    const x = (((h % W) - frame * 0.15 + Math.sin(frame / 50 + i) * 6) % W + W) % W;
    const y = (((h >>> 8) % H) + frame * vy) % H;
    ctx.fillStyle = i % 3 ? '#8a8480' : '#b0aaa4';
    ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
  }
  for (let i = 0; i < 14; i++) {
    const h = hash(i * 131 + 7);
    const x = (h % W) + Math.sin(frame / 20 + i) * 4;
    const y = H - ((((h >>> 8) % H) + frame * (0.5 + (h & 7) / 14)) % H);
    ctx.fillStyle = (frame + i) % 8 < 4 ? '#f8a838' : '#f85800';
    ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
  }
}

/** Two blurred blades spinning over a helicopter's hub. */
/** The frigate's shield: a flickering arc all round it but for the turning gap. */
function drawFrigateShield(ctx: Ctx, e: Enemy, frame: number) {
  const g = shieldGap(e);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  // Canvas angles run from +x; ours from straight down (+y).
  const from = Math.PI / 2 - g + SHIELD_GAP, to = Math.PI / 2 - g - SHIELD_GAP + Math.PI * 2;
  for (const [width, color] of [[6, 'rgba(60,188,252,0.25)'], [2, frame % 4 < 2 ? '#78f8f8' : '#3cbcfc']] as const) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.arc(e.x, e.y, SHIELD_R, -to, -from);
    ctx.stroke();
  }
  ctx.restore();
}

function drawRotor(ctx: Ctx, x: number, y: number, frame: number, size = 30) {
  const a = frame * 0.9;
  ctx.fillStyle = 'rgba(200,210,220,0.55)';
  for (const off of [0, Math.PI / 2]) {
    const dx = Math.cos(a + off), dy = Math.sin(a + off);
    for (let k = -size / 2; k <= size / 2; k++) ctx.fillRect(Math.round(x + dx * k), Math.round(y + dy * k), 1, 1);
  }
  ctx.fillStyle = '#202020';
  ctx.fillRect(Math.round(x) - 1, Math.round(y) - 1, 3, 3);
}

/**
 * Deep space behind the scenery, over open space only: a gas giant far off drifting by very slowly,
 * soft nebula clouds a little nearer, and stars.
 */
function drawSpace(ctx: Ctx, w: World) {
  ctx.save();
  // Clip to the tiles that are all open space, so nothing shows through the station.
  ctx.beginPath();
  const off = w.dist % TILE;
  for (let r = -1; r <= H / TILE; r++)
    for (let c = 0; c < W / TILE; c++) {
      const y = r * TILE + off;
      if ([0, TILE].every((dy) => [0, TILE].every((dx) => w.terrain.levelAt(c * TILE + dx, y + dy, w.dist) === 0))) ctx.rect(c * TILE, y, TILE, TILE);
    }
  ctx.clip();
  drawPlanet(ctx, W - 70, -170 + w.dist * 0.11, 92);
  // Nebula clouds: soft glows that come round again every NEBULA_LOOP pixels.
  const NEBULA_LOOP = 1400;
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 7; i++) {
    const h = hash(i * 4513 + 7);
    const x = (h % (W + 80)) - 40, r = 60 + ((h >>> 9) % 70);
    const y = ((((h >>> 3) % NEBULA_LOOP) + w.dist * 0.25) % NEBULA_LOOP) - r;
    if (y < -r || y > H + r) continue;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const hue = i % 3 === 0 ? '60,200,220' : i % 3 === 1 ? '150,70,230' : '220,60,160';
    g.addColorStop(0, `rgba(${hue},0.20)`);
    g.addColorStop(0.5, `rgba(${hue},0.08)`);
    g.addColorStop(1, `rgba(${hue},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  ctx.globalCompositeOperation = 'source-over';
  drawStars(ctx, w);
  ctx.restore();
}

/** A banded gas giant, lit from the upper left, with a thin ring. */
function drawPlanet(ctx: Ctx, x: number, y: number, r: number) {
  if (y < -r * 1.6 || y > H + r * 1.6) return;
  const ring = (from: number, to: number) => {
    ctx.strokeStyle = 'rgba(200,190,230,0.35)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(x, y, r * 1.55, r * 0.28, -0.35, from, to);
    ctx.stroke();
  };
  ctx.save();
  // The far half of the ring goes behind the planet, the near half in front.
  ring(Math.PI, Math.PI * 2);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.save();
  ctx.clip();
  const bands = ['#5a4a78', '#6c5a8a', '#4c3e6a', '#7a6494', '#5e4c7e', '#463a62', '#6a5888'];
  for (let k = 0; k < bands.length; k++) {
    ctx.fillStyle = bands[k];
    ctx.fillRect(x - r, y - r + (k * 2 * r) / bands.length, r * 2, (2 * r) / bands.length + 1);
  }
  const shade = ctx.createRadialGradient(x - r * 0.45, y - r * 0.45, r * 0.1, x, y, r * 1.05);
  shade.addColorStop(0, 'rgba(255,240,255,0.18)');
  shade.addColorStop(0.6, 'rgba(0,0,0,0)');
  shade.addColorStop(1, 'rgba(0,0,10,0.75)');
  ctx.fillStyle = shade;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.restore();
  ring(0, Math.PI);
  ctx.restore();
}

/** Stars far behind the scenery, slower than it, twinkling. */
function drawStars(ctx: Ctx, w: World) {
  for (let i = 0; i < 90; i++) {
    const h = hash(i * 7919 + 17);
    const depth = 0.15 + (h % 3) * 0.15;
    const x = (h >>> 4) % W;
    const y = (((h >>> 12) % H) + w.dist * depth) % H;
    const tw = (w.frame + (h >>> 20)) % 90 < 6;
    ctx.fillStyle = tw ? WHITE : depth > 0.4 ? '#c8d8f8' : depth > 0.2 ? '#8898c0' : '#506080';
    ctx.fillRect(x, Math.floor(y), tw ? 2 : 1, tw ? 2 : 1);
  }
}

/** Searchlights on the ground, each a cone sweeping to and fro, anchored to the map as it scrolls. */
function drawSearchlights(ctx: Ctx, w: World) {
  const SPACING = 13;
  const first = Math.floor(w.dist / TILE / SPACING) - 1;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let k = first; k < first + 3 + H / TILE / SPACING; k++) {
    const h = hash(k * 7919 + 13);
    const x = 24 + (h % (W - 48));
    const y = H - ((k * SPACING + 6) * TILE - w.dist);
    const a = (h & 1 ? Math.PI : 0) + Math.sin(w.frame / 80 + k) * 0.75;
    const len = 110, spread = 0.13;
    ctx.fillStyle = 'rgba(255,236,170,0.10)';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.sin(a - spread) * len, y + Math.cos(a - spread) * len);
    ctx.lineTo(x + Math.sin(a + spread) * len, y + Math.cos(a + spread) * len);
    ctx.closePath();
    ctx.fill();
    // The pool of light where the beam lands.
    ctx.beginPath();
    ctx.ellipse(x + Math.sin(a) * len, y + Math.cos(a) * len, 15, 15, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** The playing field: ground, things on it, shadows, things in the air, bullets on top. */
function drawWorld(ctx: Ctx, w: World, frame: number) {
  w.terrain.draw(ctx, w.dist, w.frame);
  if (w.terrain.ground.space) drawSpace(ctx, w);
  for (const wr of w.wrecks) drawAt(ctx, spr('enemies/wreck'), wr.x, wr.y);
  for (const e of w.enemies) if (e.def.ground) drawGroundEnemy(ctx, e, w, frame);
  for (const it of w.items) if (it.kind === 'medal') drawItem(ctx, it, frame);
  if (w.boss) drawBossGround(ctx, w.boss, frame);
  if (w.boss?.def.ground) drawBoss(ctx, w.boss, frame);
  for (const b of w.blasts) if (b.ground) drawBlast(ctx, b);

  if (w.terrain.ground.night) drawSearchlights(ctx, w);

  // Shadows of everything in the air; in space nothing casts one.
  const b = w.boss;
  if (!w.terrain.ground.space) {
    for (const e of w.enemies) if (!e.def.ground && e.def.sprite && !e.hidden) drawShadow(ctx, e.def.sprite, e.x, e.y);
    if (b && !b.gone && !b.def.ground) drawShadow(ctx, b.open ? b.def.openSprite : b.def.sprite, b.x, b.y, 2);
    for (const p of w.players) if (p.alive) drawShadow(ctx, 'ships/player', p.x, p.y);
  }
  drawFields(ctx, w, frame);

  for (const s of w.shots) drawShot(ctx, s, frame);
  drawBolts(ctx, w, frame);
  if (b && !b.def.ground) drawBoss(ctx, b, frame);
  for (const e of w.enemies) {
    if (e.def.ground || !e.def.sprite) continue;
    if (e.def.name === 'stealth') {
      drawStealth(ctx, e, frame);
      continue;
    }
    if (e.hidden && (e.def.name === 'wormHead' || e.def.name === 'wormBody')) {
      // Under the sand: a mound of churned sand where it crawls.
      for (let k = 0; k < 4; k++) {
        const h = hash(k * 13 + (frame >> 2) + Math.round(e.x));
        disc(ctx, e.x - 6 + (h % 12), e.y - 4 + ((h >>> 8) % 8), e.def.name === 'wormHead' ? 5 : 3, k % 2 ? '#c8a060' : '#e0c080');
      }
      continue;
    }
    drawAt(ctx, enemySprite(e), e.x, e.y);
    if (e.def.name === 'heli') drawRotor(ctx, e.x, e.y, w.frame);
    if (e.def.name === 'attackChopper') {
      drawRotor(ctx, e.x, e.y + CHOPPER_HUB, w.frame, 64);
    }
    if (e.def.name === 'frigate') drawFrigateShield(ctx, e, frame);
    if (e.def.name === 'rocket') {
      // Exhaust behind it.
      const len = Math.hypot(e.vx, e.vy) || 1;
      ctx.fillStyle = w.frame % 2 ? '#f8d838' : '#f85800';
      ctx.fillRect(Math.round(e.x - (e.vx / len) * 8) - 1, Math.round(e.y - (e.vy / len) * 8) - 1, 2, 2);
    }
  }
  for (const it of w.items) if (it.kind !== 'medal') drawItem(ctx, it, frame);
  for (const b of w.blasts) if (!b.ground) drawBlast(ctx, b);
  for (const q of w.particles) {
    ctx.fillStyle = q.color;
    ctx.fillRect(Math.round(q.x), Math.round(q.y), 1 + (q.life > 25 ? 1 : 0), 1 + (q.life > 25 ? 1 : 0));
  }
  for (const p of w.players) drawPlayer(ctx, p, frame);
  drawBullets(ctx, w, frame);
  if (w.boss) drawBossBeam(ctx, w.boss, frame);
  if (w.terrain.ground.ash) drawAsh(ctx, frame);
  for (const pu of w.popups) drawTextShadow(ctx, pu.text, Math.round(pu.x - textWidth(pu.text) / 2), Math.round(pu.y), pu.t % 4 < 2 ? WHITE : GOLD);

  // The bomb: a white flash, then a shock ring rolling out.
  if (w.bombT >= 0 && w.bombT < 60) {
    const r = w.bombT * 5;
    ctx.strokeStyle = w.bombT % 4 < 2 ? WHITE : '#f8d838';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(w.bombX, w.bombY, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = `rgba(248,120,0,${0.25 * (1 - w.bombT / 60)})`;
    ctx.fillRect(0, 0, W, H);
  }
  if (w.whiteout > 0) {
    ctx.fillStyle = `rgba(252,252,252,${w.whiteout / 10})`;
    ctx.fillRect(0, 0, W, H);
  }
}

// ---------- HUD ----------

function drawHud(ctx: Ctx, game: Game, w: World, frame: number) {
  const two = w.players.length > 1;
  drawTextShadow(ctx, two ? '2P' : '1P', 4, 4, two ? BLUE : RED);
  drawTextShadow(ctx, pad(w.score, 8), 18, 4);
  const best = Math.max(game.best()?.score ?? 0, w.score);
  drawTextShadow(ctx, 'HI', 150, 4, YELLOW);
  drawTextShadow(ctx, pad(best, 8), 164, 4);

  if (two) {
    // Each player's panel in a bottom corner, with their ships and bombs over it.
    w.players.forEach((p, i) => {
      const x0 = i ? W - 82 : 3;
      drawStatus(ctx, w, p, x0, frame);
      const y = H - 26;
      drawMiniShip(ctx, x0, y + 1, i ? BLUE : RED);
      drawText(ctx, String(Math.max(0, p.lives)), x0 + 7, y + 1, WHITE);
      for (let k = 0; k < p.bombs; k++) drawBombIcon(ctx, x0 + 16 + k * 7, y);
    });
  } else {
    // Ships in reserve, bottom left.
    for (let i = 0; i < Math.min(w.lives, 6); i++) drawMiniShip(ctx, 6 + i * 10, H - 12);
    // Bombs, bottom right.
    for (let i = 0; i < w.player.bombs; i++) drawBombIcon(ctx, W - 10 - i * 9, H - 12);
    drawStatus(ctx, w, w.player, Math.round(W / 2 - 40), frame);
  }
  if (game.debug) drawTextShadow(ctx, w.god ? 'DEBUG GOD' : 'DEBUG', 4, 24, w.god ? YELLOW : GREY);

  const m = w.mid;
  if (m && !m.dead && !w.boss) {
    // A mid-boss's health, in yellow.
    ctx.fillStyle = '#000';
    ctx.fillRect(59, 14, 122, 5);
    ctx.fillStyle = DARK;
    ctx.fillRect(60, 15, 120, 3);
    ctx.fillStyle = m.flash ? WHITE : GOLD;
    ctx.fillRect(60, 15, Math.ceil(120 * Math.max(0, m.hp / (m.maxHp ?? m.hp))), 3);
  }
  if (w.boss && w.boss.dying < 0 && w.boss.phase > 0) {
    // Boss health: the pods, then the core.
    const b = w.boss;
    const pods = b.pods.reduce((n, e) => n + Math.max(0, e.dead ? 0 : e.hp), 0);
    const left = b.open ? b.core.hp / b.coreMax : pods / (2 * b.podMax);
    ctx.fillStyle = '#000';
    ctx.fillRect(39, 14, 162, 5);
    ctx.fillStyle = DARK;
    ctx.fillRect(40, 15, 160, 3);
    ctx.fillStyle = b.open ? ((frame >> 2) % 2 ? RED : '#f87800') : YELLOW;
    ctx.fillRect(40, 15, Math.ceil(160 * Math.max(0, left)), 3);
  }
}

/**
 * The weapon in a box (V red, L blue) with a pip per level, then the missiles' pips.
 * Full rows blink to say MAX.
 */
function drawBombIcon(ctx: Ctx, x: number, y: number) {
  ctx.fillStyle = '#000';
  ctx.fillRect(x - 1, y - 1, 7, 10);
  ctx.fillStyle = YELLOW;
  ctx.fillRect(x, y, 5, 8);
  ctx.fillStyle = '#f87800';
  ctx.fillRect(x, y + 6, 5, 2);
  ctx.fillStyle = '#000';
  ctx.fillRect(x + 2, y + 1, 1, 3);
}

/** Each weapon's colour and letter on the status panel. */
const WEAPON_LOOK: Record<WeaponKind, [string, string]> = { vulcan: ['#f85838', 'V'], laser: [BLUE, 'L'], plasma: ['#b060f8', 'P'] };

function drawStatus(ctx: Ctx, w: World, p: Player, x0: number, frame: number) {
  const [color, letter] = WEAPON_LOOK[p.weapon];
  const y = H - 12;
  ctx.fillStyle = '#000';
  ctx.fillRect(x0 - 1, y - 1, 81, 10);
  ctx.fillStyle = color;
  ctx.fillRect(x0, y, 9, 8);
  drawText(ctx, letter, x0 + 2, y + 1 - 0, '#000');
  // The arsenal: a lamp per weapon, lit if you have it, bright for the one in use.
  WEAPONS.forEach((k, i) => {
    const own = p.owned.includes(k);
    ctx.fillStyle = k === p.weapon ? WEAPON_LOOK[k][0] : own ? '#a8a8a8' : '#383838';
    ctx.fillRect(x0 + 10, y + i * 3, 2, 2);
  });
  const pips = (x: number, n: number, max: number, on: string, wd: number) => {
    const full = n >= max && (frame >> 4) % 2 === 0;
    for (let k = 0; k < max; k++) {
      ctx.fillStyle = k < n ? (full ? WHITE : on) : '#383838';
      ctx.fillRect(x + k * (wd + 1), y + 2, wd, 4);
    }
  };
  pips(x0 + 14, p.level, MAX_LEVEL, color, 5);
  ctx.fillStyle = '#58d854';
  ctx.fillRect(x0 + 45, y, 7, 8);
  drawText(ctx, 'M', x0 + 46, y + 1, '#000');
  pips(x0 + 54, p.missiles, MAX_MISSILES, '#58d854', 4);
  if (!w.shielded) return;
  // Easy mode: the shield's charge in a thin bar over the panel.
  ctx.fillStyle = '#000';
  ctx.fillRect(x0 - 1, y - 5, 81, 4);
  ctx.fillStyle = '#383838';
  ctx.fillRect(x0, y - 4, 79, 2);
  ctx.fillStyle = p.shield ? '#3cbcfc' : '#2058a0';
  ctx.fillRect(x0, y - 4, Math.round(79 * (p.shield ? 1 : 1 - p.shieldT / SHIELD_REGEN)), 2);
}

const MINI = ['..#..', '..#..', '.###.', '#####', '#.#.#', '..#..'];
function drawMiniShip(ctx: Ctx, x: number, y: number, color = RED) {
  MINI.forEach((row, py) =>
    [...row].forEach((c, px) => {
      if (c !== '#') return;
      ctx.fillStyle = '#000';
      ctx.fillRect(x + px + 1, y + py + 1, 1, 1);
      ctx.fillStyle = py < 2 ? WHITE : color;
      ctx.fillRect(x + px, y + py, 1, 1);
    }),
  );
}

// ---------- overlays ----------

function stageCard(ctx: Ctx, game: Game, w: World, frame: number) {
  if (game.phase !== 'play' || game.timer > CARD_FRAMES || w.warning > 0 || w.boss) return;
  if (game.timer > CARD_FRAMES - 30 && frame % 4 < 2) return;
  drawBox(ctx, 44, 110, 152, 50);
  const sub = w.loop > 1 ? `LOOP ${w.loop} - ${w.stage.name}` : w.stage.name;
  drawTextCentered(ctx, sub, W / 2, 120, GREY);
  const title = `STAGE ${w.stageIdx + 1}`;
  drawTextScaled(ctx, title, Math.round(W / 2 - (textWidth(title) * 2) / 2), 132, 2, YELLOW);
}

/** The boss warning: a red band with WARNING blinking, the boss's name, and APPROACHING typed out. */
function warningCard(ctx: Ctx, w: World, frame: number) {
  if (w.warning <= 0) return;
  const age = WARNING_FRAMES - w.warning;
  ctx.fillStyle = 'rgba(248,56,0,0.35)';
  ctx.fillRect(0, 114, W, 62);
  ctx.fillStyle = RED;
  ctx.fillRect(0, 114, W, 2);
  ctx.fillRect(0, 174, W, 2);
  const t = 'WARNING';
  if ((frame >> 4) % 2 === 0) drawTextScaled(ctx, t, Math.round(W / 2 - textWidth(t)), 122, 2, WHITE);
  if (age < 30) return;
  drawTextCentered(ctx, w.stage.boss.name, W / 2, 145, YELLOW);
  const sub = 'APPROACHING';
  drawTextCentered(ctx, sub.slice(0, Math.floor((age - 30) / 4)).padEnd(sub.length, ' '), W / 2, 158, LIGHT);
}

/** A mid-boss coming in: a yellow band with CAUTION and its name. */
function cautionCard(ctx: Ctx, w: World, frame: number) {
  if (w.midCard <= 0 || !w.mid) return;
  ctx.fillStyle = 'rgba(248,184,0,0.3)';
  ctx.fillRect(0, 126, W, 36);
  ctx.fillStyle = GOLD;
  ctx.fillRect(0, 126, W, 1);
  ctx.fillRect(0, 161, W, 1);
  if ((frame >> 3) % 2 === 0) drawTextCentered(ctx, 'CAUTION', W / 2, 133, YELLOW);
  drawTextCentered(ctx, w.mid.def.mid!, W / 2, 147, WHITE);
}

function drawPause(ctx: Ctx, w: World) {
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, 0, W, H);
  drawBox(ctx, 44, 120, 152, 76);
  drawTextCentered(ctx, 'PAUSED', W / 2, 130, YELLOW);
  drawTextCentered(ctx, `STAGE ${w.stageIdx + 1}  LOOP ${w.loop}  SHIPS ${w.lives}`, W / 2, 144);
  drawTextCentered(ctx, 'ENTER RESUME', W / 2, 162, LIGHT);
  drawTextCentered(ctx, 'BKSP / SELECT QUIT', W / 2, 176, GREY);
}

function drawClear(ctx: Ctx, game: Game, w: World) {
  if (game.timer < 30) return;
  drawBox(ctx, 24, 96, 192, 104);
  drawTextScaled(ctx, 'STAGE CLEAR', Math.round(W / 2 - textWidth('STAGE CLEAR')), 108, 2, YELLOW);
  game.tally.forEach(([label, pts], i) => {
    if (game.timer < TALLY_AT[i]) return;
    drawText(ctx, label, 36, 136 + i * 14, LIGHT);
    const v = String(pts);
    drawText(ctx, v, 204 - textWidth(v), 136 + i * 14, pts ? WHITE : GREY);
  });
  if (game.timer >= TALLY_AT[game.tally.length]) {
    drawText(ctx, 'SCORE', 36, 136 + game.tally.length * 14 + 6, GREY);
    const v = String(w.score);
    drawText(ctx, v, 204 - textWidth(v), 136 + game.tally.length * 14 + 6, YELLOW);
  }
}

function drawOver(ctx: Ctx, game: Game, w: World, frame: number) {
  if (game.timer < 20) return;
  drawBox(ctx, 36, 110, 168, 92);
  drawTextScaled(ctx, 'GAME OVER', Math.round(W / 2 - textWidth('GAME OVER')), 122, 2, RED);
  const stats: [string, string][] = [
    ['SCORE', String(w.score)],
    ['LOOP', String(w.loop)],
    ['MEDALS', String(w.medals)],
  ];
  stats.forEach(([k, v], i) => {
    drawText(ctx, k, 52, 144 + i * 11, GREY);
    drawText(ctx, v, 188 - textWidth(v), 144 + i * 11);
  });
  if (game.timer > 60 && (frame >> 5) % 2 === 0) drawTextCentered(ctx, 'PRESS ENTER', W / 2, 188, LIGHT);
}

// ---------- screens ----------

export function render(ctx: Ctx, game: Game, frame: number) {
  ctx.save();
  const shake = game.world?.shake ?? 0;
  if (shake > 0 && game.world && (game.phase === 'play' || game.phase === 'clear') && !game.paused)
    ctx.translate(frame % 2 ? 1 : -1, Math.min(3, shake >> 2) * (frame % 4 < 2 ? 1 : -1));
  switch (game.phase) {
    case 'title':
      renderTitle(ctx, game, frame);
      break;
    case 'entry':
    case 'scores':
      renderScores(ctx, game, frame);
      break;
    case 'help':
      renderHelp(ctx, game, frame);
      break;
    default:
      renderPlay(ctx, game, frame);
  }
  ctx.restore();
}

function renderPlay(ctx: Ctx, game: Game, frame: number) {
  const w = game.world!;
  ctx.fillStyle = '#000';
  ctx.fillRect(-4, -4, W + 8, H + 8);
  drawWorld(ctx, w, frame);
  drawHud(ctx, game, w, frame);
  stageCard(ctx, game, w, frame);
  warningCard(ctx, w, frame);
  cautionCard(ctx, w, frame);
  if (game.phase === 'play' && game.paused) drawPause(ctx, w);
  if (game.phase === 'clear') drawClear(ctx, game, w);
  if (game.phase === 'ending') drawEnding(ctx, game, w);
  if (game.phase === 'over') drawOver(ctx, game, w, frame);
}

/** The ending: the story and the credits rolling up over a darkened field, then the score. */
function drawEnding(ctx: Ctx, game: Game, w: World) {
  const t = game.timer;
  ctx.fillStyle = `rgba(0,0,0,${Math.min(0.75, t / 120).toFixed(2)})`;
  ctx.fillRect(0, 0, W, H);
  const lines: [string, string][] = [
    ['MISSION COMPLETE', YELLOW],
    ['', ''],
    ['THE MOTHERSHIP BREAKS APART', WHITE],
    ['AND BURNS UP IN THE ATMOSPHERE.', WHITE],
    ['THE INVASION IS OVER -', WHITE],
    ['FOR NOW.', WHITE],
    ['', ''],
    ['', ''],
    ['STRIKE FIGHTER VEKTOR', RED],
    ['', ''],
    ['GAME', GREY],
    ['TILMAN SCHIEBER', WHITE],
    ['', ''],
    ['CODE AND MUSIC', GREY],
    ['CLAUDE', WHITE],
    ['', ''],
    ['ART', GREY],
    ['PIXELLAB', WHITE],
    ['', ''],
    ['', ''],
    [`SCORE ${w.score}`, YELLOW],
    [`MEDALS ${w.medals}   LOOP ${w.loop}`, WHITE],
    ['', ''],
    ['', ''],
    ['THEY ARE COMING BACK', RED],
    ['STRONGER. GET READY.', RED],
  ];
  const top = H + 10 - t * 0.35;
  lines.forEach(([text, color], i) => {
    const y = Math.round(top + i * 14);
    if (text && y > -10 && y < H) drawTextCentered(ctx, text, W / 2, y, color);
  });
  if (t > 180 && (t >> 5) % 2) drawTextCentered(ctx, 'PRESS ENTER TO GO ON', W / 2, H - 14, GREY);
}

let menuTerrain: Terrain | null = null;

/** Scrolling ground behind the menus, dimmed. */
function backdrop(ctx: Ctx, game: Game, frame: number) {
  menuTerrain ??= new Terrain(99, STAGES[0].ground);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  menuTerrain.draw(ctx, game.titleDist % 3000, frame);
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(0, 0, W, H);
}

function drawLogo(ctx: Ctx, frame: number, y: number) {
  if (has('ui/logo')) {
    drawAt(ctx, spr('ui/logo'), W / 2, y + 22);
    return;
  }
  const t = 'VEKTOR';
  const scale = 6;
  const x = Math.round(W / 2 - (textWidth(t) * scale) / 2);
  drawTextScaled(ctx, t, x + 2, y + 2, scale, '#000');
  drawTextScaled(ctx, t, x, y, scale, '#a8b0c0');
  // A red band through the middle, and a shine sweeping across.
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, y + 3 * scale, W, scale);
  ctx.clip();
  drawTextScaled(ctx, t, x, y, scale, RED);
  ctx.restore();
  const sx = ((frame * 2) % 400) - 80;
  ctx.save();
  ctx.beginPath();
  ctx.rect(sx, y, 10, 7 * scale);
  ctx.clip();
  drawTextScaled(ctx, t, x, y, scale, WHITE);
  ctx.restore();
}

function renderTitle(ctx: Ctx, game: Game, frame: number) {
  backdrop(ctx, game, frame);
  drawLogo(ctx, frame, 40);
  drawTextCentered(ctx, 'STRIKE FIGHTER VEKTOR - SCRAMBLE', W / 2, 92, LIGHT);

  drawBox(ctx, 28, 110, 184, 62);
  const s = game.settings;
  const values: Record<(typeof MENU)[number], string> = {
    MODE: game.mode.name,
    PLAYERS: s.players > 1 ? '2 - CO-OP' : '1',
    MUSIC: MUSIC_NAMES[s.music],
    HELP: 'HOW TO PLAY',
  };
  MENU.forEach((row, i) => {
    const y = 119 + i * 12;
    const on = i === game.menuRow;
    if (on) drawText(ctx, '>', 38, y, YELLOW);
    drawText(ctx, row, 48, y, on ? YELLOW : WHITE);
    const v = values[row];
    drawText(ctx, v, 110, y, on ? WHITE : LIGHT);
    if (on && row !== 'HELP') {
      drawText(ctx, '<', 102, y, GREY);
      drawText(ctx, '>', 112 + textWidth(v), y, GREY);
    }
  });

  drawBox(ctx, 12, 178, 216, 54);
  const best = game.best();
  drawTextCentered(ctx, best ? `TOP ${pad(best.score, 8)} ${best.name}` : 'NO RECORD YET', W / 2, 188, RED);
  if ((frame >> 5) % 2 === 0) drawTextCentered(ctx, 'PRESS ENTER OR FIRE', W / 2, 202, YELLOW);
  drawTextCentered(ctx, 'H SCORES   M MUSIC', W / 2, 216, GREY);
  if (s.players > 1) {
    // Who flies with what depends on the gamepads plugged in (they show once a button is pressed).
    const [one, two] =
      game.pads === 1
        ? ['1P  KEYBOARD  SPACE FIRE  X BOMB', '2P  GAMEPAD']
        : game.pads > 1
          ? ['1P  GAMEPAD 1  (OR W A S D)', '2P  GAMEPAD 2  (OR ARROWS)']
          : ['1P  W A S D  SPACE FIRE  L-SHIFT BOMB', '2P  ARROWS  . FIRE  - BOMB'];
    drawTextCentered(ctx, one, W / 2, 290, LIGHT);
    drawTextCentered(ctx, two, W / 2, 302, LIGHT);
  } else drawTextCentered(ctx, 'ARROWS MOVE  SPACE FIRE  X BOMB', W / 2, 300, LIGHT);
  if (game.debug) {
    drawTextCentered(ctx, 'DEBUG - NO HIGH SCORES', W / 2, 240, YELLOW);
    drawTextCentered(ctx, '1-6 STAGE  N NEXT  B BOSS', W / 2, 256, LIGHT);
    drawTextCentered(ctx, 'U POWER  I INVINCIBLE  V WEAPON', W / 2, 268, LIGHT);
  }
}

function renderScores(ctx: Ctx, game: Game, frame: number) {
  const entering = game.phase === 'entry';
  const name = game.tableName;
  backdrop(ctx, game, frame);

  drawBox(ctx, 16, 40, 208, 176);
  // The name is typed into your own table; afterwards the world table shows by default.
  const world = game.scoresGlobal && !entering && !!game.global;
  const title = entering ? 'NEW RECORD!' : world ? 'WORLD SCORES' : 'LOCAL SCORES';
  drawTextCentered(ctx, title, W / 2, 48, entering ? YELLOW : WHITE);
  drawTextCentered(ctx, entering ? name : `< ${name} >`, W / 2, 59, entering ? LIGHT : GREY);
    const cols: [string, number][] = [['NAME', 40], ['SCORE', 88], ['LP', 150], ['MDL', 172]];
  for (const [label, x] of cols) drawText(ctx, label, x, 72, GREY);
  ctx.fillStyle = '#585858';
  ctx.fillRect(26, 81, 188, 1);

  const blink = (frame >> 4) % 2 === 0;
  const list = world ? (game.global?.[game.table] ?? []) : game.tables[game.table];
  const myRow = world ? game.globalRank : game.entryRank;
  for (let i = 0; i < MAX_SCORES; i++) {
    const y = 86 + i * 12;
    const e = list[i];
    const mine = i === myRow;
    const color = mine ? (entering || blink ? YELLOW : WHITE) : i < 3 ? WHITE : LIGHT;
    const n = String(i + 1);
    drawText(ctx, n, 35 - textWidth(n), y, mine ? color : GREY);
    if (!e) {
      drawText(ctx, '------', 40, y, DARK);
      continue;
    }
    if (mine && entering) {
      drawText(ctx, game.entryName.join(''), 40, y, color);
      if (blink) {
        ctx.fillStyle = WHITE;
        ctx.fillRect(40 + game.entryCursor * 6, y + 8, 5, 1);
      }
    } else drawText(ctx, e.name.slice(0, NAME_LEN), 40, y, color);
    drawText(ctx, pad(e.score, 8), 88, y, color);
    drawText(ctx, String(e.loop), 150, y, color);
    drawText(ctx, pad(e.medals, 3), 172, y, color);
  }

  drawBox(ctx, 16, 222, 208, 24);
  if (entering) drawTextCentered(ctx, 'TYPE NAME  THEN ENTER', W / 2, 230);
  else drawTextCentered(ctx, game.global ? `UP ${world ? 'LOCAL' : 'WORLD'} SCORES   ENTER BACK` : 'ENTER BACK', W / 2, 230, blink ? WHITE : LIGHT);
}

function renderHelp(ctx: Ctx, game: Game, frame: number) {
  const page = HELP_PAGES[game.helpPage];
  backdrop(ctx, game, frame);
  drawBox(ctx, 8, 40, 224, 200);
  drawTextCentered(ctx, `< ${page.title} >`, W / 2, 48, YELLOW);
  ctx.fillStyle = '#585858';
  ctx.fillRect(18, 59, 204, 1);
  wrapText(page.text, 34).forEach((line, i) => drawText(ctx, line, 18, 66 + i * 10, line.includes('   ') ? LIGHT : WHITE));
  drawBox(ctx, 8, 246, 224, 24);
  const blink = (frame >> 4) % 2 === 0;
  drawTextCentered(ctx, `< > PAGE ${game.helpPage + 1}/${HELP_PAGES.length}   ENTER BACK`, W / 2, 254, blink ? WHITE : LIGHT);
}
