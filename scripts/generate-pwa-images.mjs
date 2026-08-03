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
const FONT_OPTIONS = {
  loadSystemFonts: true,
  serifFamily: 'DejaVu Serif',
  sansSerifFamily: 'DejaVu Sans',
  monospaceFamily: 'DejaVu Sans Mono',
  defaultFontFamily: 'DejaVu Serif',
};

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
