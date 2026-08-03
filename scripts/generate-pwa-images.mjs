// Task T21: renders the two hand-authored SVG sources into the committed PNG
// assets the game actually ships. Not wired into `npm run build` -- per
// master spec §7.6 the OG image is "static, pre-made", and the PWA icons are
// likewise pre-generated once from public/favicon.svg (controller pin: "the
// plugin's asset generation or a script step -- committed PNGs are fine").
// Re-run manually after editing either source SVG:
//
//   PATH="/usr/bin:$PATH" node scripts/generate-pwa-images.mjs
//
// Uses @resvg/resvg-js (devDependency), which loads system fonts by default
// -- exactly what the SVGs' "system serif stack" font-family lists rely on.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Without an explicit family, resvg's generic "serif"/"monospace" fallback
// resolves to "the first font in the list of system fonts" (its own docs'
// wording), which on this box landed on a symbol font -- RETRACTED rendered
// as Greek-letter lookalikes. Pinning real installed families (confirmed via
// `fc-list`) makes the one-time render deterministic regardless of which
// serif happens to sort first on whatever machine re-runs this script; the
// SVGs' own font-family lists stay a generic "system serif stack" for intent,
// this is just resvg's fallback-of-last-resort.
const SERIF_FAMILY = 'DejaVu Serif';
const SANS_FAMILY = 'DejaVu Sans';
const MONO_FAMILY = 'DejaVu Sans Mono';

const FONT_OPTIONS = {
  loadSystemFonts: true,
  serifFamily: SERIF_FAMILY,
  sansSerifFamily: SANS_FAMILY,
  monospaceFamily: MONO_FAMILY,
  defaultFontFamily: SERIF_FAMILY,
};

/**
 * Fix round 1 (Important #2): the families above were previously hardcoded
 * with no check that they actually exist on the machine running this
 * script -- re-running it on a box without DejaVu installed would silently
 * fall through to resvg's own fallback-of-last-resort again and reproduce
 * the exact Greek-glyph bug this pinning exists to prevent (see the T21
 * report §4), just as silently as the original bug happened. This is a
 * manual, one-off script (never part of `npm run build`), so a hard throw
 * naming exactly what's missing -- not a silent degrade -- is correct here.
 */
function assertFontsResolvable(families) {
  let fcList;
  try {
    fcList = execFileSync('fc-list', [], { encoding: 'utf8' });
  } catch (err) {
    const cause = err instanceof Error ? err.message : String(err);
    throw new Error(
      `generate-pwa-images.mjs: could not run \`fc-list\` to verify the pinned font families ` +
        `(${families.map((f) => `"${f}"`).join(', ')}) are installed on this machine (${cause}). ` +
        'Install fontconfig (Debian/Ubuntu: `apt-get install fontconfig`) so `fc-list` is on PATH, then re-run. ' +
        'Without this check, a missing family silently falls back to an arbitrary system font instead of failing loudly.',
    );
  }
  const missing = families.filter((family) => !fcList.includes(family));
  if (missing.length > 0) {
    throw new Error(
      `generate-pwa-images.mjs: required font famil${missing.length === 1 ? 'y' : 'ies'} not found via \`fc-list\`: ` +
        `${missing.map((f) => `"${f}"`).join(', ')}. This script pins these fonts explicitly so resvg's text ` +
        "rendering is deterministic; without them installed, resvg silently falls back to an arbitrary system " +
        'font instead (on a past run, a symbol font that rendered Latin text as Greek-lookalike glyphs -- see ' +
        'the T21 report §4). Install hint (Debian/Ubuntu): `apt-get install fonts-dejavu-core`, then re-run.',
    );
  }
}

assertFontsResolvable([SERIF_FAMILY, SANS_FAMILY, MONO_FAMILY]);

/** @param {string} svgPath @param {string} outPath @param {number} [fitWidth] */
function render(svgPath, outPath, fitWidth) {
  const svg = readFileSync(svgPath);
  const options = {
    font: FONT_OPTIONS,
    ...(fitWidth ? { fitTo: { mode: 'width', value: fitWidth } } : {}),
  };
  const resvg = new Resvg(svg, options);
  const png = resvg.render().asPng();
  writeFileSync(outPath, png);
  console.log(`wrote ${outPath} (${resvg.width}x${resvg.height} source -> ${fitWidth ?? resvg.width}px wide)`);
}

render(resolve(ROOT, 'assets/og-source.svg'), resolve(ROOT, 'public/og.png'));
render(resolve(ROOT, 'public/favicon.svg'), resolve(ROOT, 'public/pwa-192x192.png'), 192);
render(resolve(ROOT, 'public/favicon.svg'), resolve(ROOT, 'public/pwa-512x512.png'), 512);
