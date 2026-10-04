import { Game, MENU, MUSIC_NAMES, NAME_LEN, CARD_FRAMES, TALLY_AT } from './game';
import { World, Shot, Blast, Item, MAX_LEVEL, MAX_MISSILES } from './world';
import { Enemy, DESTROYER_GUNS, LAVABOAT_GUN, popupOpen, magmaRise, siloOpen } from './enemies';
import { aimAt } from './bullets';
import { Boss } from './boss';
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
  if (e.def.name === 'fighter' || e.def.name === 'interceptor' || e.def.name === 'rocket') return rotated(name, stepFor(e.vx, e.vy || 0.01));
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
  if (e.def.name === 'popup') {
    const name = popupOpen(e) ? 'enemies/popup_open' : 'enemies/popup_closed';
    drawAt(ctx, e.flash > 0 ? flash(name) : spr(name), e.x, e.y);
    return;
  }
  drawAt(ctx, enemySprite(e), e.x, e.y);
  if (e.def.name === 'trainCar') drawBarrel(ctx, e.x, e.y, e.aim, 11);
  if (e.def.name === 'artillery') drawAt(ctx, rotated('enemies/artillery_barrel', stepFor(Math.sin(e.aim), Math.cos(e.aim))), e.x, e.y);
}

/** Laser colours per level: outer, body, core. Level 5 turns to violet plasma. */
const LASER = [
  ['#0040b8', '#2878f8', '#a8d8fc'],
  ['#0058f8', '#3cbcfc', '#d8f0fc'],
  ['#0078f8', '#58d8fc', '#fcfcfc'],
  ['#00a0f8', '#80ecfc', '#fcfcfc'],
  ['#7038f8', '#c090fc', '#fcfcfc'],
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
    // Level 5 ripples like plasma.
    const wob = lv >= 5 ? Math.round(Math.sin((s.y + frame * 3) / 5) * 1.5) : 0;
    const left = x - Math.floor(wd / 2) + wob;
    if (lv >= 2) {
      ctx.fillStyle = lv >= 5 ? 'rgba(160,96,248,0.3)' : 'rgba(60,188,252,0.25)';
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

const ITEM_SPRITE: Record<string, string> = { missile: 'items/orb_m', bomb: 'items/orb_b', medal: 'items/medal' };

function drawItem(ctx: Ctx, it: Item, frame: number) {
  let name = ITEM_SPRITE[it.kind];
  let letter = it.kind === 'missile' ? 'M' : it.kind === 'bomb' ? 'B' : '';
  if (it.kind === 'weapon') {
    const laser = World.weaponFace(it) === 'laser';
    name = laser ? 'items/orb_l' : 'items/orb_v';
    letter = laser ? 'L' : 'V';
  }
  const bob = it.kind === 'medal' ? 0 : Math.round(Math.sin(frame / 8));
  drawAt(ctx, spr(name), it.x, it.y + bob);
  // The placeholder orbs need their letter.
  if (letter && !has(name)) drawTextShadow(ctx, letter, Math.round(it.x) - 2, Math.round(it.y) - 3 + bob);
}

function drawBullets(ctx: Ctx, w: World, frame: number) {
  for (const b of w.bullets) {
    if (b.life !== undefined) {
      // Flame: hot to cool as it burns out.
      const k = b.t / b.life;
      disc(ctx, b.x, b.y, k < 0.5 ? 2.5 : 2, k < 0.3 ? '#fff0a0' : k < 0.6 ? '#f8b800' : '#f85800');
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

function drawPlayer(ctx: Ctx, w: World, frame: number) {
  const p = w.player;
  if (!p.alive) return;
  if (p.invuln > 0 && p.invuln < 1e6 && (frame >> 2) % 2) return;
  let name = 'ships/player';
  if (p.bank < -0.45 && has('ships/player_l')) name = 'ships/player_l';
  if (p.bank > 0.45 && has('ships/player_r')) name = 'ships/player_r';
  // Engine flame.
  const fl = frame % 3;
  ctx.fillStyle = fl ? '#f8b800' : '#f83800';
  ctx.fillRect(Math.round(p.x) - 1, Math.round(p.y) + 13, 3, 2 + fl);
  drawAt(ctx, spr(name), p.x, p.y);
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
function drawRotor(ctx: Ctx, x: number, y: number, frame: number) {
  const a = frame * 0.9;
  ctx.fillStyle = 'rgba(200,210,220,0.55)';
  for (const off of [0, Math.PI / 2]) {
    const dx = Math.cos(a + off), dy = Math.sin(a + off);
    for (let k = -15; k <= 15; k++) ctx.fillRect(Math.round(x + dx * k), Math.round(y + dy * k), 1, 1);
  }
  ctx.fillStyle = '#202020';
  ctx.fillRect(Math.round(x) - 1, Math.round(y) - 1, 3, 3);
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
  for (const wr of w.wrecks) drawAt(ctx, spr('enemies/wreck'), wr.x, wr.y);
  for (const e of w.enemies) if (e.def.ground) drawGroundEnemy(ctx, e, w, frame);
  for (const it of w.items) if (it.kind === 'medal') drawItem(ctx, it, frame);
  if (w.boss?.def.ground) drawBoss(ctx, w.boss, frame);
  for (const b of w.blasts) if (b.ground) drawBlast(ctx, b);

  if (w.terrain.ground.night) drawSearchlights(ctx, w);

  // Shadows of everything in the air.
  for (const e of w.enemies) if (!e.def.ground && e.def.sprite) drawShadow(ctx, e.def.sprite, e.x, e.y);
  const b = w.boss;
  if (b && !b.gone && !b.def.ground) drawShadow(ctx, b.open ? b.def.openSprite : b.def.sprite, b.x, b.y, 2);
  if (w.player.alive) drawShadow(ctx, 'ships/player', w.player.x, w.player.y);

  for (const s of w.shots) drawShot(ctx, s, frame);
  if (b && !b.def.ground) drawBoss(ctx, b, frame);
  for (const e of w.enemies) {
    if (e.def.ground || !e.def.sprite) continue;
    drawAt(ctx, enemySprite(e), e.x, e.y);
    if (e.def.name === 'heli') drawRotor(ctx, e.x, e.y, w.frame);
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
  drawPlayer(ctx, w, frame);
  drawBullets(ctx, w, frame);
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
  drawTextShadow(ctx, '1P', 4, 4, RED);
  drawTextShadow(ctx, pad(w.score, 8), 18, 4);
  const best = Math.max(game.best()?.score ?? 0, w.score);
  drawTextShadow(ctx, 'HI', 150, 4, YELLOW);
  drawTextShadow(ctx, pad(best, 8), 164, 4);

  // Ships in reserve, bottom left.
  for (let i = 0; i < Math.min(w.lives, 6); i++) drawMiniShip(ctx, 6 + i * 10, H - 12);
  // Bombs, bottom right.
  for (let i = 0; i < w.player.bombs; i++) {
    const x = W - 10 - i * 9, y = H - 12;
    ctx.fillStyle = '#000';
    ctx.fillRect(x - 1, y - 1, 7, 10);
    ctx.fillStyle = YELLOW;
    ctx.fillRect(x, y, 5, 8);
    ctx.fillStyle = '#f87800';
    ctx.fillRect(x, y + 6, 5, 2);
    ctx.fillStyle = '#000';
    ctx.fillRect(x + 2, y + 1, 1, 3);
  }
  drawStatus(ctx, w, frame);

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
function drawStatus(ctx: Ctx, w: World, frame: number) {
  const p = w.player;
  const vulcan = p.weapon === 'vulcan';
  const color = vulcan ? '#f85838' : BLUE;
  const x0 = Math.round(W / 2 - 40), y = H - 12;
  ctx.fillStyle = '#000';
  ctx.fillRect(x0 - 1, y - 1, 81, 10);
  ctx.fillStyle = color;
  ctx.fillRect(x0, y, 9, 8);
  drawText(ctx, vulcan ? 'V' : 'L', x0 + 2, y + 1 - 0, '#000');
  const pips = (x: number, n: number, max: number, on: string, wd: number) => {
    const full = n >= max && (frame >> 4) % 2 === 0;
    for (let k = 0; k < max; k++) {
      ctx.fillStyle = k < n ? (full ? WHITE : on) : '#383838';
      ctx.fillRect(x + k * (wd + 1), y + 2, wd, 4);
    }
  };
  pips(x0 + 11, p.level, MAX_LEVEL, color, 5);
  ctx.fillStyle = '#58d854';
  ctx.fillRect(x0 + 44, y, 7, 8);
  drawText(ctx, 'M', x0 + 45, y + 1, '#000');
  pips(x0 + 53, p.missiles, MAX_MISSILES, '#58d854', 4);
}

const MINI = ['..#..', '..#..', '.###.', '#####', '#.#.#', '..#..'];
function drawMiniShip(ctx: Ctx, x: number, y: number) {
  MINI.forEach((row, py) =>
    [...row].forEach((c, px) => {
      if (c !== '#') return;
      ctx.fillStyle = '#000';
      ctx.fillRect(x + px + 1, y + py + 1, 1, 1);
      ctx.fillStyle = py < 2 ? WHITE : RED;
      ctx.fillRect(x + px, y + py, 1, 1);
    }),
  );
}

// ---------- overlays ----------

function stageCard(ctx: Ctx, game: Game, w: World, frame: number) {
  if (game.phase !== 'play' || game.timer > CARD_FRAMES) return;
  if (game.timer > CARD_FRAMES - 30 && frame % 4 < 2) return;
  drawBox(ctx, 44, 110, 152, 50);
  const sub = w.loop > 1 ? `LOOP ${w.loop} - ${w.stage.name}` : w.stage.name;
  drawTextCentered(ctx, sub, W / 2, 120, GREY);
  const title = `STAGE ${w.stageIdx + 1}`;
  drawTextScaled(ctx, title, Math.round(W / 2 - (textWidth(title) * 2) / 2), 132, 2, YELLOW);
}

function warningCard(ctx: Ctx, w: World, frame: number) {
  if (w.warning <= 0 || (frame >> 4) % 2) return;
  ctx.fillStyle = 'rgba(248,56,0,0.35)';
  ctx.fillRect(0, 120, W, 40);
  ctx.fillStyle = RED;
  ctx.fillRect(0, 120, W, 2);
  ctx.fillRect(0, 158, W, 2);
  const t = 'WARNING';
  drawTextScaled(ctx, t, Math.round(W / 2 - textWidth(t)), 133, 2, WHITE);
}

function drawPause(ctx: Ctx, w: World) {
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, 0, W, H);
  drawBox(ctx, 44, 120, 152, 76);
  drawTextCentered(ctx, 'PAUSED', W / 2, 130, YELLOW);
  drawTextCentered(ctx, `STAGE ${w.stageIdx + 1}  LOOP ${w.loop}  SHIPS ${w.lives}`, W / 2, 144);
  drawTextCentered(ctx, 'ENTER RESUME', W / 2, 162, LIGHT);
  drawTextCentered(ctx, 'BKSP QUIT', W / 2, 176, GREY);
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
  if (game.phase === 'play' && game.paused) drawPause(ctx, w);
  if (game.phase === 'clear') drawClear(ctx, game, w);
  if (game.phase === 'over') drawOver(ctx, game, w, frame);
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

  drawBox(ctx, 28, 120, 184, 40);
  const s = game.settings;
  const values: Record<(typeof MENU)[number], string> = {
    MUSIC: MUSIC_NAMES[s.music],
    HELP: 'HOW TO PLAY',
  };
  MENU.forEach((row, i) => {
    const y = 130 + i * 12;
    const on = i === game.menuRow;
    if (on) drawText(ctx, '>', 38, y, YELLOW);
    drawText(ctx, row, 48, y, on ? YELLOW : WHITE);
    const v = values[row];
    drawText(ctx, v, 102, y, on ? WHITE : LIGHT);
    if (on && row !== 'HELP') {
      drawText(ctx, '<', 94, y, GREY);
      drawText(ctx, '>', 104 + textWidth(v), y, GREY);
    }
  });

  drawBox(ctx, 12, 168, 216, 54);
  const best = game.best();
  drawTextCentered(ctx, best ? `TOP ${pad(best.score, 8)} ${best.name}` : 'NO RECORD YET', W / 2, 178, RED);
  if ((frame >> 5) % 2 === 0) drawTextCentered(ctx, 'PRESS ENTER OR FIRE', W / 2, 192, YELLOW);
  drawTextCentered(ctx, 'H SCORES   M MUSIC', W / 2, 206, GREY);
  drawTextCentered(ctx, 'ARROWS MOVE  SPACE FIRE  X BOMB', W / 2, 300, LIGHT);
}

function renderScores(ctx: Ctx, game: Game, frame: number) {
  const entering = game.phase === 'entry';
  const mode = game.mode;
  backdrop(ctx, game, frame);

  drawBox(ctx, 16, 40, 208, 176);
  // The name is typed into your own table; afterwards the world table shows by default.
  const world = game.scoresGlobal && !entering && !!game.global;
  const title = entering ? 'NEW RECORD!' : world ? 'WORLD SCORES' : 'LOCAL SCORES';
  drawTextCentered(ctx, title, W / 2, 48, entering ? YELLOW : WHITE);
    const cols: [string, number][] = [['NAME', 40], ['SCORE', 88], ['LP', 150], ['MDL', 172]];
  for (const [label, x] of cols) drawText(ctx, label, x, 72, GREY);
  ctx.fillStyle = '#585858';
  ctx.fillRect(26, 81, 188, 1);

  const blink = (frame >> 4) % 2 === 0;
  const list = world ? (game.global?.[mode.id] ?? []) : game.tables[mode.id];
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
