// In-page half of the playtest bot: the harness that runs a stage or a campaign frame by frame,
// the bot that plays it, and the bookkeeping that turns it into metrics.
// Injected into the dev build as a classic script; it reaches the game through window.game and
// dynamic imports of the game's own ES modules. Exposes window.__playtest = { init, start, advance }.
(() => {
  const W = 240, H = 320;
  /** Player speed per frame, from world.ts (PLAYER_SPEED). */
  const SPEED = 2;
  const PREF_Y = H - 72;

  let M; // the game's modules
  let run; // the run in progress

  async function init() {
    const [world, rng, sprites, modes, boss, enemies, mid] = await Promise.all([
      import('/src/world.ts'), import('/src/rng.ts'), import('/src/sprites.ts'), import('/src/modes.ts'), import('/src/boss.ts'), import('/src/enemies.ts'), import('/src/mid.ts'),
    ]);
    M = { ...world, ...rng, has: sprites.has, MODES: modes.MODES, boss, enemies, mid };
    for (let i = 0; i < 400 && !(window.game && window.sim && M.has('boss/boss')); i++) await new Promise((r) => setTimeout(r, 25));
    if (!window.sim) throw new Error('no window.sim: not a dev build?');
    window.sim(0); // freezes the live loop; we step the game ourselves from here on
    // No high scores or score uploads from bots.
    game.debug = true;
    return { stages: (await import('/src/stages.ts')).STAGES.length };
  }

  // ---------- bot ----------

  /** Turns the skill knob (0..1) into how the bot perceives and reacts. */
  function botParams(knob, bombs) {
    // The knob is bent so 0.7 lands on a decent player rather than a near-perfect one.
    const k = Math.pow(1 - knob, 0.6), skill = 1 - k;
    return {
      knob,
      skill,
      bombs,
      /** New bullets go unnoticed for this many frames (reaction time). */
      delay: Math.round(5 + 14 * k),
      /** How far ahead it looks, frames. */
      horizon: Math.round(6 + 16 * skill),
      /** It re-plans every this many frames and holds its input in between. */
      think: 1 + Math.round(6 * k),
      /** It keeps track of only this many bullets, the nearest. */
      attention: 3 + Math.round(12 * skill),
      /** How wrong it judges a bullet: position (px), heading (rad), speed (fraction); fixed per bullet. */
      posErr: 4 * k,
      angErr: 0.35 * k,
      spdErr: 0.4 * k,
      /** Clearance it likes to keep, px. */
      margin: 2 + 4 * skill,
      /** How much it wants its goal (items, targets) against safety. */
      greed: 0.05 * (1 + 2 * k),
      /** Chance per decision of a sloppy input: it just keeps doing what it did. */
      slip: 0.1 * k,
      /** Chance per frame of a lapse: for a moment it only sees what is right on top of it. */
      lapse: 0.008 * k,
      /** Chance it thinks of the bomb at all when cornered, and how early it presses it. */
      bombChance: 0.3 + 0.55 * skill,
      bombLead: 1 + Math.round(3 * skill),
      /** Bullets close round it (36 px) that make it feel swamped. */
      crowd: 6,
    };
  }

  const DIRS = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  // A candidate: hold a direction for `hold` frames, then stand still.
  const CANDS = [];
  for (const d of DIRS) for (const hold of [99, 4, 10]) if (hold === 99 || d[0] || d[1]) CANDS.push({ d, hold });

  /** Where bullet b will be in 1..n frames, as the bot judges it. NaN once it's gone. */
  function predict(b, n, B) {
    const xs = new Float32Array(n + 1), ys = new Float32Array(n + 1);
    let e = run.misjudge.get(b);
    if (!e) {
      const g = () => run.rnd() + run.rnd() - 1; // -1..1, peaked at 0
      run.misjudge.set(b, (e = { x: g() * B.posErr, y: g() * B.posErr, a: g() * B.angErr, s: 1 + g() * B.spdErr }));
    }
    const ca = Math.cos(e.a), sa = Math.sin(e.a);
    let x = b.x + e.x, y = b.y + e.y;
    let vx = (b.vx * ca - b.vy * sa) * e.s, vy = (b.vx * sa + b.vy * ca) * e.s;
    for (let t = 1; t <= n; t++) {
      const age = b.t + t;
      if (b.hang !== undefined) {
        // Needle: coasts while it hangs, then accelerates along its heading.
        if (age <= b.hang) (vx *= 0.93), (vy *= 0.93);
        else {
          const s = Math.min(b.dash, Math.hypot(vx, vy) + 0.14);
          vx = Math.sin(b.ang) * s;
          vy = Math.cos(b.ang) * s;
        }
      } else if (b.weave !== undefined) {
        const a = b.ang + b.weave * Math.sin(((age / 60) * 2 + (b.phase ?? 0)) * Math.PI);
        vx = Math.sin(a) * b.spd;
        vy = Math.cos(a) * b.spd;
      }
      x += vx;
      y += vy;
      const gone = (b.life !== undefined && age >= b.life) || (b.burst !== undefined && age >= b.burst);
      xs[t] = gone ? NaN : x;
      ys[t] = y;
    }
    return { xs, ys, r: b.r };
  }

  /** A lava bomb about to burst: the ring it will make, as virtual bullets (the pattern is learnable). */
  function burstRing(b, n, w, out) {
    const k = b.burst - b.t;
    if (k < 1 || k > n) return;
    const bx = b.x + b.vx * k, by = b.y + b.vy * k;
    const m = 8 + w.loop * 2, s = 1.2 * w.bulletSpeed, off = b.burst / 9;
    for (let j = 0; j < m; j++) {
      const a = off + (j / m) * Math.PI * 2;
      const xs = new Float32Array(n + 1).fill(NaN), ys = new Float32Array(n + 1);
      for (let t = k; t <= n; t++) {
        xs[t] = bx + Math.sin(a) * s * (t - k);
        ys[t] = by + Math.cos(a) * s * (t - k);
      }
      out.push({ xs, ys, r: 2 });
    }
  }

  const isAir = (e) => !e.def.ground && !e.dead;
  const partName = (w, e) => {
    const i = e.p[0];
    return `boss${w.stageIdx + 1}:${i >= 0 ? `pod${i}` : i === -1 ? 'core' : 'body'}`;
  };

  /** The ship the bot is flying this moment (in a 2-player run it takes turns). */
  let me = null;
  const ship = (w) => me ?? w.player;

  /** What to go for: an item, a boss weak point, an enemy, or the middle of the lower screen. */
  function pickGoal(w, B) {
    const p = ship(w);
    let best = null, bd = 1e9;
    for (const it of w.items) {
      if (it.y < 4 || it.y > H - 4) continue;
      if (it.kind === 'weapon' && wrongFace(w, it, B)) continue;
      const d = Math.hypot(it.x - p.x, it.y - p.y) * (it.kind === 'medal' ? 1.3 : 1);
      if (d < bd) (bd = d), (best = it);
    }
    if (best && bd < 220) return { x: best.x + best.vx * 6, y: Math.max(40, best.y + best.vy * 6), item: true };

    const b = w.boss;
    if (b && b.dying < 0) {
      const pods = b.pods.filter((q) => !q.dead);
      const tgt = pods.length ? pods.reduce((a, q) => (Math.abs(q.x - p.x) < Math.abs(a.x - p.x) ? q : a)) : b.core;
      return { x: tgt.x, y: Math.max(PREF_Y, tgt.y + 110) };
    }

    let tgt = null, tc = 1e9;
    for (const e of w.enemies) {
      if (e.dead || e.hidden || e.y < 0 || e.y > H - 50 || e.x < 0 || e.x > W) continue;
      const pr = e.def.name === 'carrier' ? 90 : e.drop ? 50 : isAir(e) ? 30 : 0;
      const c = Math.abs(e.x - p.x) - e.y * 0.3 - pr + (e.armored ? 60 : 0);
      if (c < tc) (tc = c), (tgt = e);
    }
    if (tgt) return { x: tgt.x, y: Math.max(PREF_Y, tgt.y + (isAir(tgt) ? 90 : 40)) };
    return { x: W / 2, y: PREF_Y };
  }

  /** A weapon orb showing the other weapon, that won't turn before we could get there. */
  function wrongFace(w, it, B) {
    if (!B.weapon || M.World.weaponFace(it) === B.weapon) return false;
    const toFlip = M.ITEM_CYCLE - (it.t % M.ITEM_CYCLE);
    return toFlip > Math.hypot(it.x - ship(w).x, it.y - ship(w).y) / SPEED;
  }

  /**
   * Hazards that aren't bullets, as a player sees them: a boss beam (its aiming line shows where it
   * will burn), mortar markers, laser fences between satellites. Danger at (x, y), t frames ahead.
   */
  function hazards(w) {
    const out = [];
    const b = w.boss;
    if (b && b.dying < 0) {
      const ox = b.coreX, oy = b.coreY + 8;
      if (b.beam) {
        const fireIn = Math.max(0, M.boss.BEAM_AIM - b.beam.t);
        const angs = b.beam.twin ? [b.beam.ang, -b.beam.ang] : [b.beam.ang];
        out.push((x, y, t) => {
          if (t + 6 < fireIn) return 0;
          let d = 0;
          for (const a of angs) {
            const dx = x - ox, dy = y - oy;
            if (dx * Math.sin(a) + dy * Math.cos(a) <= 0) continue;
            const perp = Math.abs(dx * Math.cos(a) - dy * Math.sin(a));
            // Scissor beams swing, the walker's tracks: keep a wide berth.
            const safe = b.beam.twin ? 26 : 12;
            if (perp < 8 && t >= fireIn) d += 1000;
            else if (perp < safe) d += 40 * (1 - perp / safe);
          }
          return d;
        });
      }
      for (const m of b.marks) {
        const left = M.boss.MORTAR_FUSE - m.t;
        out.push((x, y, t) => {
          const d = Math.hypot(x - m.x, y - m.y);
          if (d < M.boss.MORTAR_R + 3 && Math.abs(t - left) <= 2) return 1000;
          return d < M.boss.MORTAR_R + 10 && t <= left ? 15 : 0;
        });
      }
    }
    // A sandworm's mound: it bursts out of it soon. A player keeps off it.
    for (const e of w.enemies) {
      if (e.def.name !== 'wormHead' || !e.hidden) continue;
      const left = M.mid.WORM_UNDER - (e.t % M.mid.WORM_CYCLE);
      if (left > 50) continue;
      out.push((x, y) => {
        const d = Math.hypot(x - e.x, y - e.y);
        return d < 30 ? 600 : d < 50 ? 40 : 0;
      });
    }
    for (const e of w.enemies) {
      if (e.def.name !== 'satellite' || !e.link || e.link.dead || e.p[3] > Math.PI / 2) continue;
      const o = e.link;
      out.push((x, y, t) => {
        const ax = e.x + e.vx * t, ay = e.y + e.vy * t, bx = o.x + o.vx * t, by = o.y + o.vy * t;
        const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy || 1;
        const k = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len2));
        const d = Math.hypot(ax + dx * k - x, ay + dy * k - y);
        return d < M.enemies.FENCE_R + 3 ? 1000 : d < 14 ? 8 : 0;
      });
    }
    return out;
  }

  function decide(w, B) {
    const p = ship(w);
    const bot = run.bot;
    if (!p.alive || p.timer > 0 || w.state !== 'play') return { dx: 0, dy: 0, bomb: false };
    if (bot.wait > 0 && bot.last) {
      bot.wait--;
      return { ...bot.last, bomb: false };
    }
    bot.wait = B.think - 1;
    const rnd = run.rnd;
    if (bot.lapse > 0) bot.lapse -= B.think;
    else if (rnd() < B.lapse * B.think) bot.lapse = 8 + rnd() * 16;
    const lapsing = bot.lapse > 0, n = lapsing ? 5 : B.horizon;

    // Threats it can see.
    const reach = lapsing ? 18 : n * (SPEED + 4) + 24;
    const th = [];
    if (w.bombT < 0 || w.bombT > 90) {
      let seen = w.bullets.filter((b) => b.t >= B.delay && Math.abs(b.x - p.x) < reach && Math.abs(b.y - p.y) < reach);
      if (seen.length > B.attention) {
        const d = (b) => (b.x - p.x) ** 2 + (b.y - p.y) ** 2;
        seen = seen.sort((a, b) => d(a) - d(b)).slice(0, B.attention);
      }
      for (const b of seen) {
        th.push(predict(b, n, B));
        if (b.burst !== undefined) burstRing(b, n, w, th);
      }
    }
    const foes = w.enemies.filter((e) => isAir(e) && Math.abs(e.x - p.x) < reach + 30 && Math.abs(e.y - p.y) < reach + 30);
    const shooters = w.enemies.filter((e) => !e.dead && !e.hidden && e.y > -10 && e.y < H && e.def.name !== 'part' && e.def.name !== 'groundPart');
    const avoid = w.items.filter((it) => it.kind === 'weapon' && wrongFace(w, it, B));
    // Beams, markers and fences are big and bright: even a lapsing player sees them.
    const hz = hazards(w);
    const goal = pickGoal(w, B);
    bot.goal = goal;

    let best = null;
    const m = B.margin;
    for (const c of CANDS) {
      let [dx, dy] = c.d;
      const k = dx && dy ? Math.SQRT1_2 : 1;
      let x = p.x, y = p.y, danger = 0, firstHit = 99;
      let gx = x, gy = y;
      for (let t = 1; t <= n; t++) {
        if (t <= c.hold) {
          x = Math.max(10, Math.min(W - 10, x + dx * k * SPEED));
          y = Math.max(16, Math.min(H - 14, y + dy * k * SPEED));
        }
        if (t === Math.min(n, 10)) (gx = x), (gy = y);
        if (p.invuln > t) continue;
        const wt = 1.2 - t / n;
        for (const q of th) {
          const bx = q.xs[t];
          if (bx !== bx) continue;
          const ddx = bx - x, ddy = q.ys[t] - y, rh = q.r + 2;
          if (Math.abs(ddx) > rh + m || Math.abs(ddy) > rh + m) continue;
          const d = Math.hypot(ddx, ddy);
          if (d < rh + 0.5) {
            danger += 1000 * wt;
            if (t < firstHit) firstHit = t;
          } else if (d < rh + m) danger += 12 * wt * ((rh + m - d) / m) ** 2;
        }
        for (const e of foes) {
          const r = (e.r ?? e.def.r) * 0.6 + 2;
          const ex = Math.abs(e.x + e.vx * t - x), ey = Math.abs(e.y + e.vy * t - y);
          if (ex < r + 1 && ey < r + 1) {
            danger += 1000 * wt;
            if (t < firstHit) firstHit = t;
          } else if (ex < r + 10 && ey < r + 10) danger += 6 * wt;
        }
        for (const it of avoid) if (Math.abs(it.x + it.vx * t - x) < 14 && Math.abs(it.y + it.vy * t - y) < 14) danger += 40;
        for (const h of hz) {
          const d = h(x, y, t) * wt;
          danger += d;
          if (d >= 500 && t < firstHit) firstHit = t;
        }
      }
      // Where it wants to be: the goal, away from walls, in the lower half.
      let cost = danger;
      cost += (Math.abs(gx - goal.x) + 0.6 * Math.abs(gy - goal.y)) * B.greed;
      if (gx < 24) cost += (24 - gx) * 0.15;
      if (gx > W - 24) cost += (gx - W + 24) * 0.15;
      if (gy > H - 26) cost += (gy - H + 26) * 0.15;
      if (!goal.item && gy < H * 0.45) cost += (H * 0.45 - gy) * 0.05;
      // Shooters: don't sit right in front of them; better players keep their distance.
      for (const e of shooters) {
        const d = Math.hypot(e.x - gx, e.y - gy);
        if (d < 70) cost += (70 - d) * 0.06 * B.skill;
      }
      if (bot.last && bot.last.dx === dx && bot.last.dy === dy) cost -= 0.3;
      cost += rnd() * 0.6 * (1 - B.skill);
      if (!best || cost < best.cost) best = { cost, dx, dy, firstHit, danger };
    }

    let act = { dx: best.dx, dy: best.dy, bomb: false };
    if (bot.last && rnd() < B.slip) act = { ...bot.last, bomb: false };

    // Cornered (no clean way out) or swamped (bullets all round): a bomb, if this player keeps their
    // head, decided once per scare.
    let crowd = 0;
    for (const b of w.bullets) if (b.t >= B.delay && Math.abs(b.x - p.x) < 36 && Math.abs(b.y - p.y) < 36) crowd++;
    const swamped = crowd >= B.crowd && best.danger >= 8;
    if (best.firstHit <= 8 || swamped) {
      if (bot.scare === undefined) bot.scare = rnd() < B.bombChance;
      const now = best.firstHit <= B.bombLead || (swamped && rnd() < 0.2);
      if (B.bombs && bot.scare && now && p.bombs > 0 && w.bombT < 0 && p.invuln <= 0) act.bomb = true;
      bot.calm = 0;
    } else if (++bot.calm > 20) bot.scare = undefined;
    // The mothership's charge: a player who can't break it bombs just before it fires.
    const ch = w.boss?.charge;
    if (ch && ch.t >= M.boss.CHARGE_FRAMES - 6 && B.bombs && p.bombs > 0 && w.bombT < 0 && p.invuln <= 0) act.bomb = true;
    bot.last = act;
    bot.planned = best;
    return act;
  }

  // ---------- harness ----------

  const snap = (w) => ({
    weapon: w.player.weapon, level: w.player.level, missiles: w.player.missiles, bombs: w.player.bombs,
    lives: w.lives, score: w.score, medals: w.medals,
  });

  function bulletKind(b) {
    if (b.burst !== undefined) return 'lava';
    if (b.life !== undefined) return 'flame';
    if (b.hang !== undefined) return 'needle';
    if (b.weave !== undefined) return 'frost';
    return b.big ? 'big' : 'plain';
  }

  /** Tags each new bullet with whoever was nearest where it came from. */
  function tagBullets(w, before) {
    for (const b of w.bullets) {
      if (run.src.has(b)) continue;
      const ox = b.x - b.vx * b.t, oy = b.y - b.vy * b.t;
      let best = 'unknown', bd = 40;
      // Shooters as they were before this frame too: one may have been shot down since.
      for (const e of [...w.enemies, ...before]) {
        const d = Math.hypot(e.x - ox, e.y - oy);
        if (d < bd) (bd = d), (best = e.def.name === 'part' ? partName(w, e) : e.def.name);
      }
      if (best === 'unknown' && b.t <= 1) for (const s of run.lastBursts) if (Math.hypot(s.x - ox, s.y - oy) < 6) best = s.src;
      run.src.set(b, best);
    }
    run.lastBursts = w.bullets.filter((b) => b.burst !== undefined && b.t === b.burst - 1).map((b) => ({ x: b.x + b.vx, y: b.y + b.vy, src: `${run.src.get(b)} burst` }));
  }

  /** What hit the ship, from the bullets and enemies as they stood when it happened. */
  function culprit(w, bullets, enemies, p = w.player) {
    for (const b of bullets) {
      const dx = b.x - p.x, dy = b.y - p.y;
      if (dx * dx + dy * dy < (b.r + 2) ** 2) return { type: 'bullet', kind: bulletKind(b), src: run.src.get(b) ?? 'unknown', age: b.t, seen: b.t >= run.B.delay };
    }
    for (const e of enemies) {
      if (e.def.ground || e.dead) continue;
      const r = (e.r ?? e.def.r) * 0.6 + 2;
      if (Math.abs(e.x - p.x) < r && Math.abs(e.y - p.y) < r) return { type: 'ram', kind: 'ram', src: e.def.name === 'part' ? partName(w, e) : e.def.name };
    }
    // Not a bullet or a ram: one of the bosses' other weapons, or a laser fence.
    const b = w.boss;
    if (b?.mega > 0) return { type: 'hazard', kind: 'mega', src: 'boss' };
    if (b?.beam) return { type: 'hazard', kind: 'beam', src: 'boss' };
    if (b?.marks.some((m) => m.t >= M.boss.MORTAR_FUSE - 1)) return { type: 'hazard', kind: 'mortar', src: 'boss' };
    if (enemies.some((e) => e.def.name === 'satellite' && e.link)) return { type: 'hazard', kind: 'fence', src: 'satellite' };
    return { type: 'unknown', kind: 'unknown', src: 'unknown' };
  }

  function newStage(w) {
    const st = {
      stage: w.stageIdx + 1, loop: w.loop, frames: 0, start: snap(w), bossStart: null, end: null,
      bossArrive: null, boss: null, deaths: [], shieldHits: [], godHits: [], bombs: 0, bombsBot: 0,
      items: {}, medalsMissed: 0, cleared: false, gameOver: false,
      density: { sum: 0, max: 0, near: 0, crowded: 0, n: 0 },
    };
    run.stages.push(st);
    run.st = st;
    return st;
  }

  function item(st, kind) {
    return (st.items[kind] ??= { dropped: 0, got: 0 });
  }

  function where(w, st) {
    const b = w.boss;
    return b ? (b.phase === 0 ? 'boss-intro' : `boss-p${b.phase}`) : `d${Math.round(w.dist)}`;
  }

  /** Starts a run: cfg = { seed, first, last (0-based stages), power: null | {level, missiles}, bossOnly, weapon, mode, god, bombs, skill, shots }. */
  function start(cfg) {
    const mode = M.MODES.findIndex((m) => m.id === cfg.mode);
    if (mode < 0) throw new Error(`no mode ${cfg.mode}`);
    game.settings.mode = mode;
    game.startGame();
    const md = M.MODES[mode];
    const w = (game.world = new M.World(M.makeRng(cfg.seed), md.lives, md.shield, cfg.players || 1));
    game.settings.players = cfg.players || 1;
    if (cfg.first > 0) w.goTo(cfg.first);
    if (cfg.power) for (const q of w.players) Object.assign(q, { level: cfg.power.level, missiles: cfg.power.missiles, weapon: cfg.weapon || 'vulcan' });
    w.god = !!cfg.god;
    // Straight to the boss, like the debug B key.
    if (cfg.bossOnly) w.skipTo(w.stage.length - 20);
    run = {
      cfg, B: { ...botParams(cfg.skill, cfg.bombs), weapon: cfg.weapon || null }, rnd: M.makeRng(cfg.seed ^ 0x5eed),
      bots: w.players.map(() => ({ wait: 0, last: null, calm: 0 })), stages: [], src: new WeakMap(), misjudge: new WeakMap(), seenItems: new WeakSet(),
      lastBursts: [], frame: 0, done: false, shots: [], godCool: 0,
    };
    newStage(w);
    return true;
  }

  const input = { held: new Set(), pressed: new Set(), typed: [], dragX: 0, dragY: 0, touching: false, p2: { held: new Set(), pressed: new Set() } };

  function shot(reason, w, bullets) {
    if (!run.cfg.shots) return;
    // Draw the moment before: the bullets that did it, and the ship.
    const keep = w.bullets, alive = w.player.alive;
    if (bullets) w.bullets = bullets;
    w.player.alive = true;
    window.sim(0);
    w.bullets = keep;
    w.player.alive = alive;
    run.shots.push({ name: `s${run.st.stage}-${reason}-f${run.st.frames}`, data: document.getElementById('screen').toDataURL('image/png') });
  }

  function stepOnce() {
    const w = game.world, st = run.st;
    const ps = w.players;
    // Each ship decides for itself; player 2's goes into its own controls.
    const acts = ps.map((q, i) => {
      me = q;
      run.bot = run.bots[i];
      return decide(w, run.B);
    });
    me = null;
    run.bot = run.bots[0];
    input.held.clear();
    input.pressed.clear();
    input.p2.held.clear();
    input.p2.pressed.clear();
    acts.forEach((act, i) => {
      const held = i ? input.p2.held : input.held, pressed = i ? input.p2.pressed : input.pressed;
      held.add('fire');
      if (act.dx > 0) held.add('right');
      if (act.dx < 0) held.add('left');
      if (act.dy > 0) held.add('down');
      if (act.dy < 0) held.add('up');
      if (act.bomb) pressed.add('bomb');
    });
    const act = { bomb: acts.some((a) => a.bomb) };
    const p = ps[0];

    const befores = ps.map((q) => ({ alive: q.alive, shield: q.shield, bombs: q.bombs, level: q.level, missiles: q.missiles }));
    const before = { ...befores[0], stageIdx: w.stageIdx, loop: w.loop, medals: w.medals };
    const bullets = w.bullets, enemies = w.enemies, items = w.items;
    const phase = w.boss ? w.boss.phase : -1, place = where(w, st);

    game.step(input);
    run.frame++;
    st.frames++;
    const w2 = game.world;

    // Moved on to the next stage (campaign).
    if (w2.stageIdx !== before.stageIdx || w2.loop !== before.loop) {
      if (st.cleared && (w2.stageIdx > run.cfg.last || w2.loop > 1)) return (run.done = true);
      newStage(w2);
      return;
    }

    ps.forEach((q, i) => {
      const bf = befores[i], bot = run.bots[i];
      if (bf.alive && !q.alive) {
        const c = culprit(w, bullets, enemies, q);
        st.deaths.push({ at: place, frame: st.frames, ship: i + 1, x: Math.round(q.x), y: Math.round(q.y), cause: c, level: bf.level, missiles: bf.missiles, bombsLeft: bf.bombs, bulletsNear: bullets.filter((b) => Math.hypot(b.x - q.x, b.y - q.y) < 60).length, predicted: bot.planned?.firstHit ?? 99, danger: Math.round(bot.planned?.danger ?? 0), lapse: bot.lapse > 0 });
        shot(`death${st.deaths.length}`, w, bullets.filter((b) => !b.dead || Math.hypot(b.x - q.x, b.y - q.y) < 8));
      } else if (bf.shield && !q.shield && q.alive) st.shieldHits.push({ at: place, frame: st.frames, cause: culprit(w, w.bullets, enemies, q) });
      if (q.bombs < bf.bombs && q.alive) {
        st.bombs++;
        if (acts[i].bomb) st.bombsBot++;
      }
    });

    // God mode: count the hits that would have been.
    if (w.god && p.alive && p.timer <= 0 && p.invuln <= 0 && w.state === 'play' && run.godCool-- <= 0) {
      const c = culprit(w, w.bullets, w.enemies);
      if (c.type !== 'unknown') {
        st.godHits.push({ at: where(w, st), frame: st.frames, cause: c });
        run.godCool = 60;
      }
    }

    // Items: new ones dropped, and which of the old ones went into the ship.
    for (const it of w.items) if (!run.seenItems.has(it)) (run.seenItems.add(it), item(st, it.kind).dropped++);
    for (const it of items) {
      if (!it.dead) continue;
      if (it.y <= H + 12) item(st, it.kind).got++;
      else if (it.kind === 'medal') st.medalsMissed++;
    }
    tagBullets(w, enemies);

    // Bullet pressure: how many on screen, and how many close round the ship (48 px).
    if (p.alive && w.state === 'play') {
      const dn = st.density;
      let near = 0;
      for (const b of w.bullets) if (Math.abs(b.x - p.x) < 48 && Math.abs(b.y - p.y) < 48) near++;
      dn.n++;
      dn.sum += w.bullets.length;
      dn.max = Math.max(dn.max, w.bullets.length);
      dn.near += near;
      if (near >= 6) dn.crowded++;
    }

    // The boss: arrival, phases, kill.
    const b = w.boss;
    if (b && !st.boss) {
      st.bossArrive = st.frames;
      st.bossStart = snap(w);
      st.boss = { phaseAt: { 0: st.frames }, killedAt: null };
      shot('boss', w);
    }
    if (b && b.phase !== phase && phase >= 0) st.boss.phaseAt[b.phase] = st.frames;
    if (b && b.dying >= 0 && st.boss.killedAt === null) st.boss.killedAt = st.frames;

    if (w.state === 'clear' && !st.cleared) {
      st.cleared = true;
      st.end = snap(w);
      if (run.cfg.power || w.stageIdx >= run.cfg.last) return (run.done = true);
    }
    if (w.state === 'over') {
      st.gameOver = true;
      st.end = snap(w);
      run.done = true;
    }
  }

  /** Runs up to n frames; returns progress, and the result once the run is over. */
  function advance(n) {
    const t0 = performance.now();
    for (let i = 0; i < n && !run.done; i++) {
      stepOnce();
      // Safety net: a stuck run (boss never dies) ends after 15 minutes of game time per stage.
      if (run.st.frames > 60 * 60 * 15) {
        run.st.timeout = true;
        run.st.end = snap(game.world);
        run.done = true;
      }
    }
    const shots = run.shots;
    run.shots = [];
    const w = game.world;
    return {
      done: run.done, frame: run.frame, ms: performance.now() - t0, shots,
      status: { stage: w.stageIdx + 1, dist: Math.round(w.dist), lives: w.lives, boss: w.boss?.phase ?? null },
      result: run.done ? { frames: run.frame, stages: run.stages.map(finish), score: w.score, lives: w.lives } : null,
    };
  }

  /** Derived numbers for a stage record. */
  function finish(st) {
    const dn = st.density;
    if (dn.n !== undefined) st.density = { mean: dn.sum / Math.max(1, dn.n), max: dn.max, near: dn.near / Math.max(1, dn.n), crowded: dn.crowded / Math.max(1, dn.n) };
    const b = st.boss;
    if (b) {
      const at = b.phaseAt;
      const end = b.killedAt ?? st.frames;
      const span = (from, to) => (at[from] !== undefined ? (at[to] ?? end) - at[from] : null);
      b.fight = at[1] !== undefined ? end - at[1] : null;
      b.phases = { p1: span(1, 2), p2: span(2, 3), p3: at[3] !== undefined ? end - at[3] : null };
      b.killed = b.killedAt !== null;
    }
    return st;
  }

  window.__playtest = { init, start, advance };
})();
