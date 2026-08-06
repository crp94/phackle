// GR6 gr6-116 — THE BUNDLE BUDGET.
//
// `npm run build` succeeded and nothing read its output. A bundle has exactly
// one failure mode that review cannot see and a test suite cannot feel: it
// grows. Every individual commit's contribution is defensible; the sum is what
// costs a first-time player their first fifteen seconds on a train.
//
// So this script is the reader. It gzips every emitted asset, sums the ones a
// first-time English player must actually download before the game is playable,
// prints the table either way, and exits non-zero over a constant.
//
// Run with: PATH="/usr/bin:$PATH" npx tsx scripts/check-bundle.ts
// (assumes `npm run build` has already produced dist/)

import { gzipSync } from 'node:zlib';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');

/**
 * THE BUDGET, AND WHY THIS NUMBER.
 *
 * 200 KB gzipped is the figure the GR1b bundle review measured against, and it
 * is kept rather than tightened to today's reading. Measured on the review
 * build, the initial-load set is ~112 KB gz — so the budget carries ~78% of
 * itself as headroom, which is deliberate:
 *
 *   - A budget set just above the current number is a tripwire for ordinary
 *     work. It reds on the commit that adds a chart, gets raised in that same
 *     commit to unblock it, and after two rounds of that it is documenting
 *     history instead of enforcing a limit.
 *   - 200 KB gz is a real-world threshold, not a local one: it is roughly one
 *     second of transfer on a slow 3G profile, which is the budget the player
 *     actually has.
 *   - The failure this guards is a STEP, not a drift — a stray `import` of a
 *     charting library, a locale chunk accidentally pulled into the main graph,
 *     a polyfill bundle. Those arrive in tens or hundreds of KB and this fires.
 *
 * If a deliberate change genuinely needs more, the honest move is to raise this
 * constant in a commit that says why — not to widen INITIAL_LOAD.
 */
const BUDGET_GZ_BYTES = 200 * 1024;

/**
 * The initial-load set: what a first-time English player downloads before the
 * Briefing is interactive.
 *
 *   - `index.html` and the entry JS/CSS: unconditional.
 *   - `registerSW.js`: injected into the document head by vite-plugin-pwa.
 *   - the worker chunk: the day cannot be assembled without it, so it is on
 *     the critical path even though it is fetched as a module worker.
 *   - EXACTLY ONE locale chunk (`en-*.js`), never all three. Charging a player
 *     for the two languages they do not read is precisely the defect gr6-049
 *     removed from the service worker, and this meter must not re-introduce it
 *     in the accounting.
 *   - fonts are EXCLUDED from the sum and reported separately: `woff2` is
 *     already compressed (gzip makes it bigger, not smaller), it loads
 *     `font-display: swap` so it never blocks first paint, and only the two
 *     `latin` subsets are fetched by an English player.
 */
const INITIAL_LOAD = [
  /^index\.html$/,
  /^registerSW\.js$/,
  /^assets\/index-[A-Za-z0-9_-]+\.(?:js|css)$/,
  /^assets\/worker-[A-Za-z0-9_-]+\.js$/,
  /^assets\/en-[A-Za-z0-9_-]+\.js$/,
];

/** Deferred: the other two locales, plus everything the app never fetches. */
const LOCALE_CHUNK = /^assets\/(?:it|es)-[A-Za-z0-9_-]+\.js$/;
const FONT = /\.woff2?$/;

type Row = { url: string; raw: number; gz: number; bucket: 'initial' | 'locale' | 'font' | 'other' };

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

function bucketFor(url: string): Row['bucket'] {
  if (INITIAL_LOAD.some((re) => re.test(url))) return 'initial';
  if (LOCALE_CHUNK.test(url)) return 'locale';
  if (FONT.test(url)) return 'font';
  return 'other';
}

let files: string[];
try {
  files = walk(DIST);
} catch {
  console.error(`check-bundle: no dist/ at ${DIST}. Run \`npm run build\` first.`);
  process.exit(1);
}

const rows: Row[] = files
  .map((file) => {
    const bytes = readFileSync(file);
    const url = relative(DIST, file).split(/[\\/]/).join('/');
    return { url, raw: bytes.length, gz: gzipSync(bytes, { level: 9 }).length, bucket: bucketFor(url) };
  })
  .sort((a, b) => b.gz - a.gz);

const kb = (n: number) => `${(n / 1024).toFixed(1)} KB`;
const initial = rows.filter((r) => r.bucket === 'initial');
const initialGz = initial.reduce((sum, r) => sum + r.gz, 0);

const width = Math.max(...rows.map((r) => r.url.length), 24);
const MARK: Record<Row['bucket'], string> = { initial: '*', locale: 'L', font: 'F', other: ' ' };

console.log('');
console.log(`BUNDLE REPORT — ${relative(ROOT, DIST)} (* = initial load · L = deferred locale · F = font)`);
console.log(`  ${'asset'.padEnd(width)}  ${'raw'.padStart(10)}  ${'gzip'.padStart(10)}`);
console.log(`  ${'-'.repeat(width)}  ${'-'.repeat(10)}  ${'-'.repeat(10)}`);
for (const row of rows) {
  console.log(`${MARK[row.bucket]} ${row.url.padEnd(width)}  ${kb(row.raw).padStart(10)}  ${kb(row.gz).padStart(10)}`);
}
console.log(`  ${'-'.repeat(width)}  ${'-'.repeat(10)}  ${'-'.repeat(10)}`);
console.log(`  ${`INITIAL LOAD (${initial.length} files, en)`.padEnd(width)}  ${''.padStart(10)}  ${kb(initialGz).padStart(10)}`);
console.log(`  ${'BUDGET'.padEnd(width)}  ${''.padStart(10)}  ${kb(BUDGET_GZ_BYTES).padStart(10)}`);
console.log('');

const problems: string[] = [];

// The set is defined by pattern, so a renamed or dropped entry chunk would
// silently shrink the meter and report a comfortable pass. A meter that can
// measure zero is worse than no meter — so every pattern must still match
// something, and the failure names the pattern rather than a count (a count
// says how many and cannot say which).
const unmatched = INITIAL_LOAD.filter((re) => !rows.some((r) => re.test(r.url)));
if (unmatched.length > 0) {
  problems.push(
    `${unmatched.length} initial-load pattern(s) matched nothing in dist/: ${unmatched.map(String).join(', ')}. ` +
      'An entry was renamed or is missing, so this budget is no longer measuring the whole critical path.',
  );
}

// gr6-084: Fontsource's legacy `.woff` fallback is stripped in vite.config.ts
// before Vite can emit it. If a dependency upgrade ever restores that shape,
// 161 KB of fonts nobody fetches quietly re-enters the deploy — so the saving
// is guarded here rather than trusted to hold.
const legacyWoff = rows.filter((r) => r.url.endsWith('.woff'));
if (legacyWoff.length > 0) {
  problems.push(
    `${legacyWoff.length} legacy .woff file(s) emitted (${kb(legacyWoff.reduce((s, r) => s + r.raw, 0))} raw). ` +
      'No browser able to run this app requests one — see fontsourceWoff2Only() in vite.config.ts.',
  );
}

if (initialGz > BUDGET_GZ_BYTES) {
  problems.push(
    `initial load is ${kb(initialGz)} gz, over the ${kb(BUDGET_GZ_BYTES)} budget by ${kb(initialGz - BUDGET_GZ_BYTES)}.`,
  );
}

if (problems.length > 0) {
  for (const problem of problems) console.error(`BUNDLE CHECK FAILED — ${problem}`);
  process.exit(1);
}

console.log(
  `BUNDLE CHECK PASSED — initial load ${kb(initialGz)} gz, ` +
    `${kb(BUDGET_GZ_BYTES - initialGz)} under the ${kb(BUDGET_GZ_BYTES)} budget.`,
);
