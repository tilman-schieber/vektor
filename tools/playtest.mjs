#!/usr/bin/env node
// VEKTOR playtest bot: plays the game headless, much faster than real time, and reports how it went.
//
//   npm run playtest -- [options]
//
//   --stages 1-6 | 1,3     stages to play (default 1-6)
//   --runs N               runs per configuration (default 1)
//   --seed S               base seed; run r plays seed S+r, so results are reproducible (default 1)
//   --start-power auto|L,M auto: one continuous campaign from the first to the last stage, keeping what
//                          the bot earns (default; the first stage starts fresh, at level 1).
//                          L,M: each stage on its own, fresh, with weapon level L and M missiles
//                          (and 3 bombs), e.g. 3,2
//   --boss-only            with L,M: skip each stage straight to its boss, so the fight is at that power
//   --mode normal|easy     game mode (default normal)
//   --god                  invincible: measures boss times; counts the hits that would have landed
//   --weapon vulcan|laser  weapon the bot prefers (it leaves orbs of the other colour); with L,M also the
//                          starting weapon. Default: no preference, takes every orb
//   --skill 0..1           0 sluggish and sloppy, 1 sharp (default 0.7)
//   --players 1|2          one ship, or two flown by two bots in a 2-player game (default 1)
//   --bombs on|off         whether the bot bombs its way out when cornered (default on, off with --god)
//   --shots DIR            save a PNG of the screen at each death and when each boss arrives
//   --headful              show the browser
//   --url URL              use a running dev server instead of starting one (e.g. http://localhost:5173/)
//   --out FILE             JSON output (default tools/playtest/out/<timestamp>.json)
//   --batch N              frames per page call (default 6000)
//
// Starts `vite` on a free port, opens the dev build in headless Chromium (puppeteer-core; set CHROMIUM
// to the browser binary, default /usr/bin/chromium), freezes the game's own loop and steps it from
// inside the page: the bot and the bookkeeping live in tools/playtest/page.js. Prints per-stage
// tables (mean (min-max) over runs) and writes every run in full to JSON.
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { summarize, printSummary } from './playtest/report.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');

function parseArgs(argv) {
  const o = { stages: '1-6', runs: 1, seed: 1, startPower: 'auto', mode: 'normal', god: false, bossOnly: false, weapon: null, skill: 0.7, players: 1, bombs: null, shots: null, headful: false, url: null, out: null, batch: 6000 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i], v = () => argv[++i];
    if (a === '--stages') o.stages = v();
    else if (a === '--runs') o.runs = +v();
    else if (a === '--seed') o.seed = +v();
    else if (a === '--start-power') o.startPower = v();
    else if (a === '--mode') o.mode = v();
    else if (a === '--god') o.god = true;
    else if (a === '--boss-only') o.bossOnly = true;
    else if (a === '--weapon') o.weapon = v();
    else if (a === '--skill') o.skill = +v();
    else if (a === '--players') o.players = +v();
    else if (a === '--bombs') o.bombs = v() !== 'off';
    else if (a === '--shots') o.shots = resolve(v());
    else if (a === '--headful') o.headful = true;
    else if (a === '--url') o.url = v();
    else if (a === '--out') o.out = resolve(v());
    else if (a === '--batch') o.batch = +v();
    else if (a === '-h' || a === '--help') {
      console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\nimport ')[0].replace(/^#.*\n/, '').replace(/^\/\/ ?/gm, ''));
      process.exit(0);
    } else throw new Error(`unknown option ${a}`);
  }
  const st = new Set();
  for (const part of String(o.stages).split(',')) {
    const [a, b = a] = part.split('-').map(Number);
    for (let s = a; s <= b; s++) st.add(s);
  }
  o.bombs ??= !o.god;
  o.stageList = [...st].sort((a, b) => a - b);
  if (!o.stageList.length || o.stageList.some((s) => !(s >= 1 && s <= 6))) throw new Error(`bad --stages ${o.stages}`);
  if (o.startPower !== 'auto') {
    const [level, missiles = 0] = o.startPower.split(',').map(Number);
    if (!(level >= 1 && level <= 5 && missiles >= 0 && missiles <= 5)) throw new Error(`bad --start-power ${o.startPower}`);
    o.power = { level, missiles };
  }
  if (o.bossOnly && !o.power) throw new Error('--boss-only needs --start-power L,M');
  if (o.weapon && !['vulcan', 'laser'].includes(o.weapon)) throw new Error(`bad --weapon ${o.weapon}`);
  if (!(o.skill >= 0 && o.skill <= 1)) throw new Error(`bad --skill ${o.skill}`);
  if (o.players !== 1 && o.players !== 2) throw new Error(`bad --players ${o.players}`);
  return o;
}

const freePort = () =>
  new Promise((res, rej) => {
    const s = createServer();
    s.on('error', rej);
    s.listen(0, '127.0.0.1', () => {
      const { port } = s.address();
      s.close(() => res(port));
    });
  });

async function startVite() {
  const port = await freePort();
  const proc = spawn('npx', ['vite', '--port', String(port), '--strictPort', '--host', '127.0.0.1'], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = '';
  proc.stdout.on('data', (d) => (log += d));
  proc.stderr.on('data', (d) => (log += d));
  const url = `http://127.0.0.1:${port}/`;
  for (let i = 0; i < 150; i++) {
    if (proc.exitCode !== null) throw new Error(`vite exited:\n${log}`);
    try {
      if ((await fetch(url)).ok) return { url, stop: () => proc.kill() };
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  proc.kill();
  throw new Error(`vite did not start:\n${log}`);
}

/** One configuration of a run: the stages it plays, and its seed. */
function jobs(o) {
  const out = [];
  for (let r = 0; r < o.runs; r++) {
    const seed = o.seed + r;
    if (o.power) for (const s of o.stageList) out.push({ run: r, seed, worldSeed: seed * 7919 + s, first: s - 1, last: s - 1 });
    else out.push({ run: r, seed, worldSeed: seed, first: o.stageList[0] - 1, last: o.stageList.at(-1) - 1 });
  }
  return out;
}

async function main() {
  const o = parseArgs(process.argv.slice(2));
  const server = o.url ? { url: o.url, stop() {} } : await startVite();
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROMIUM || '/usr/bin/chromium',
    headless: !o.headful,
    args: ['--mute-audio', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'],
  });
  const cleanup = async () => {
    await browser.close().catch(() => {});
    server.stop();
  };
  process.on('SIGINT', () => cleanup().then(() => process.exit(130)));
  try {
    const page = await browser.newPage();
    // Only the dev server: no score fetches or uploads.
    const origin = new URL(server.url).origin;
    await page.setRequestInterception(true);
    page.on('request', (rq) => (rq.url().startsWith(origin) || rq.url().startsWith('data:') ? rq.continue() : rq.abort()));
    page.on('pageerror', (e) => console.error('page error:', e.message));
    await page.goto(server.url, { waitUntil: 'load' });
    await page.addScriptTag({ content: readFileSync(join(HERE, 'playtest/page.js'), 'utf8') });
    await page.evaluate(() => window.__playtest.init());
    if (o.shots) mkdirSync(o.shots, { recursive: true });

    const runs = [];
    const t0 = Date.now();
    for (const j of jobs(o)) {
      const cfg = { seed: j.worldSeed, first: j.first, last: j.last, power: o.power ?? null, bossOnly: o.bossOnly, weapon: o.weapon, mode: o.mode, god: o.god, bombs: o.bombs, skill: o.skill, players: o.players, shots: !!o.shots };
      await page.evaluate((c) => window.__playtest.start(c), cfg);
      const tj = Date.now();
      let res;
      do {
        res = await page.evaluate((n) => window.__playtest.advance(n), o.batch);
        for (const s of res.shots) writeFileSync(join(o.shots, `r${j.run}-${s.name}.png`), Buffer.from(s.data.split(',')[1], 'base64'));
        const st = res.status;
        if (process.stderr.isTTY) process.stderr.write(`\rrun ${j.run + 1}/${o.runs} seed ${j.worldSeed}: stage ${st.stage} ${st.boss !== null ? `boss p${st.boss}` : `d${st.dist}`} lives ${st.lives}   `);
      } while (!res.done);
      const r = { run: j.run, seed: j.worldSeed, ...res.result, wallMs: Date.now() - tj };
      runs.push(r);
      const last = r.stages.at(-1);
      process.stderr.write(`${process.stderr.isTTY ? '\r' : ''}run ${j.run + 1}/${o.runs} seed ${j.worldSeed}: ${r.stages.map((s) => `S${s.stage} ${s.cleared ? 'clear' : s.gameOver ? 'OVER' : 'stopped'} ${s.deaths.length}d`).join(', ')}, score ${r.score}, ${(r.frames / 60).toFixed(0)}s game in ${(r.wallMs / 1000).toFixed(1)}s${last.timeout ? ' (timeout)' : ''}\n`);
    }

    const summary = summarize(runs);
    console.log(`\nVEKTOR playtest: stages ${o.stages}, ${o.runs} run(s), seed ${o.seed}, start power ${o.startPower}${o.bossOnly ? ', boss only' : ''}, ${o.mode}${o.players > 1 ? ', 2 players' : ''}${o.god ? ', god' : ''}, skill ${o.skill}, bombs ${o.bombs ? 'on' : 'off'}${o.weapon ? `, prefers ${o.weapon}` : ''} (${((Date.now() - t0) / 1000).toFixed(1)}s)\n`);
    console.log(printSummary(summary, { god: o.god, shield: o.mode === 'easy' }));

    const outFile = o.out ?? join(HERE, 'playtest/out', `${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
    mkdirSync(dirname(outFile), { recursive: true });
    const { stageList, power, ...opts } = o;
    writeFileSync(outFile, JSON.stringify({ options: opts, summary, runs }, null, 1));
    console.log(`\nfull results: ${outFile}`);
  } finally {
    await cleanup();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
