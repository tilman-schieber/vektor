// Summaries of playtest results: per-stage averages over runs, printed as compact tables.

const sec = (f) => (f == null ? null : f / 60);
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : null);
const fmt = (v, d = 1) => (v == null ? '-' : Number.isInteger(v) && d < 2 ? String(v) : v.toFixed(d));

/** "mean (min-max)" of the non-null values, or "-". */
function range(vals, d = 1) {
  const a = vals.filter((v) => v != null);
  if (!a.length) return '-';
  const lo = Math.min(...a), hi = Math.max(...a);
  return lo === hi ? fmt(lo, d) : `${fmt(mean(a), d)} (${fmt(lo, d)}-${fmt(hi, d)})`;
}

/** The n most common values, as "value xCount". */
function top(vals, n = 3) {
  const c = new Map();
  for (const v of vals) c.set(v, (c.get(v) ?? 0) + 1);
  return [...c].sort((a, b) => b[1] - a[1]).slice(0, n).map(([v, k]) => `${v} x${k}`).join(', ') || '-';
}

/** Stage distances in buckets of 1000; boss phases as they are. */
const bucket = (at) => (at.startsWith('d') ? `${Math.floor(+at.slice(1) / 1000)}k` : at);

export function summarize(runs) {
  const byStage = new Map();
  for (const r of runs) for (const st of r.stages) {
    if (!byStage.has(st.stage)) byStage.set(st.stage, []);
    byStage.get(st.stage).push(st);
  }
  const rows = [];
  for (const [stage, sts] of [...byStage].sort((a, b) => a[0] - b[0])) {
    const deaths = sts.flatMap((s) => s.deaths);
    const hits = sts.flatMap((s) => [...s.deaths, ...s.shieldHits, ...s.godHits]);
    // Weapon pickups count together, whichever weapon.
    const kinds = (k) => (k === 'weapon' ? ['vulcan', 'laser', 'plasma'] : [k]);
    const it = (k, f) => sts.map((s) => kinds(k).reduce((n, x) => n + (s.items[x]?.[f] ?? 0), 0));
    const got = (k) => `${fmt(mean(it(k, 'got')))}/${fmt(mean(it(k, 'dropped')))}`;
    const killed = sts.filter((s) => s.boss?.killed);
    rows.push({
      stage,
      runs: sts.length,
      cleared: sts.filter((s) => s.cleared).length,
      gameOver: sts.filter((s) => s.gameOver).length,
      deaths: range(sts.map((s) => s.deaths.length)),
      deathsTotal: deaths.length,
      shieldHits: range(sts.map((s) => s.shieldHits.length)),
      godHits: range(sts.map((s) => s.godHits.length)),
      bombs: range(sts.map((s) => s.bombs)),
      causes: top(hits.map((d) => `${d.cause.kind}:${d.cause.src}`)),
      where: top(hits.map((d) => bucket(d.at))),
      weapon: got('weapon'),
      missile: got('missile'),
      bomb: got('bomb'),
      medals: `${fmt(mean(it('medal', 'got')))}/${fmt(mean(it('medal', 'dropped')))}`,
      lvStart: range(sts.map((s) => s.start.level)),
      lvBoss: range(sts.map((s) => s.bossStart?.level)),
      lvEnd: range(sts.map((s) => s.end?.level)),
      msStart: range(sts.map((s) => s.start.missiles)),
      msBoss: range(sts.map((s) => s.bossStart?.missiles)),
      msEnd: range(sts.map((s) => s.end?.missiles)),
      bossArrive: range(sts.map((s) => sec(s.bossArrive)), 0),
      bossFight: range(killed.map((s) => sec(s.boss.fight)), 0),
      p1: range(killed.map((s) => sec(s.boss.phases.p1)), 0),
      p2: range(killed.map((s) => sec(s.boss.phases.p2)), 0),
      p3: range(killed.map((s) => sec(s.boss.phases.p3)), 0),
      bullets: range(sts.map((s) => s.density.mean)),
      bulletsMax: range(sts.map((s) => s.density.max), 0),
      near: range(sts.map((s) => s.density.near), 2),
      crowded: range(sts.map((s) => s.density.crowded * 100)),
      score: range(sts.map((s) => (s.end ? s.end.score - s.start.score : null)), 0),
    });
  }
  return rows;
}

function table(rows, cols) {
  const head = cols.map(([h]) => h);
  const body = rows.map((r) => cols.map(([, k]) => String(typeof k === 'function' ? k(r) : r[k])));
  const wid = head.map((h, i) => Math.max(h.length, ...body.map((b) => b[i].length)));
  const line = (cells) => cells.map((c, i) => c.padEnd(wid[i])).join('  ').trimEnd();
  return [line(head), line(wid.map((n) => '-'.repeat(n))), ...body.map(line)].join('\n');
}

export function printSummary(rows, { god, shield }) {
  const out = [];
  out.push(table(rows, [
    ['stage', 'stage'],
    ['runs', 'runs'],
    ['clear', (r) => `${r.cleared}/${r.runs}`],
    ['over', 'gameOver'],
    [god ? 'would-be hits' : 'deaths', god ? 'godHits' : 'deaths'],
    ...(shield ? [['shield hits', 'shieldHits']] : []),
    ['bombs', 'bombs'],
    ['top causes', 'causes'],
    ['where', 'where'],
  ]));
  out.push('');
  out.push(table(rows, [
    ['stage', 'stage'],
    ['W got/drop', 'weapon'],
    ['M got/drop', 'missile'],
    ['B got/drop', 'bomb'],
    ['medals', 'medals'],
    ['lv start', 'lvStart'],
    ['lv boss', 'lvBoss'],
    ['lv end', 'lvEnd'],
    ['ms start', 'msStart'],
    ['ms boss', 'msBoss'],
    ['ms end', 'msEnd'],
  ]));
  out.push('');
  out.push(table(rows, [
    ['stage', 'stage'],
    ['boss at s', 'bossArrive'],
    ['boss fight s', 'bossFight'],
    ['p1 s', 'p1'],
    ['p2 s', 'p2'],
    ['p3 s', 'p3'],
    ['bullets avg', 'bullets'],
    ['peak', 'bulletsMax'],
    ['near ship', 'near'],
    ['crowded %', 'crowded'],
    ['stage score', 'score'],
  ]));
  return out.join('\n');
}
