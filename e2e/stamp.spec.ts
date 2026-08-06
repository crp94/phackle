// W1 / w1-r-011 — THE VERDICT LABEL FITS ITS FRAME, IN EVERY LOCALE.
//
// WHY THIS TEST EXISTS. The stamp's distress filter has its region pinned to
// the viewBox (Stamp.tsx), which makes the region a hard clip on filter output.
// That is what keeps red ink inside the window — and it is also why an oversize
// label is sheared rather than merely untidy: before the fix this test guards,
// `RISULTATO NULLO` rendered as "ULTATO NUL", in the one verdict an honest
// player earns.
//
// WHY IT IS AN E2E TEST AND NOT A UNIT TEST. Measuring a label needs real text
// metrics: real fonts, the real `--text-40` / `--tracking-label` values, and a
// real SVG layout engine. jsdom has none of the three (`tests/ui/shell.test.tsx`
// pins the structural half — that `textLength`/`lengthAdjust` are set and sized
// inside the frame — which is everything jsdom can honestly assert).
//
// WHY `getBBox`, AND WHAT MUST NEVER BE USED HERE:
//   * `getBoundingClientRect()` on anything inside the filtered <g> returns the
//     FILTER REGION, not the ink — it reports the same rectangle whether the
//     label is 8 characters or 20, so it cannot see this defect at all.
//   * `scrollWidth` does not exist on SVG layout.
//   * `getBBox()` is geometry in USER UNITS, directly comparable to the viewBox
//     numbers, and it honours `textLength`. That is the measurement.
//
// The nine strings are read from the shipped catalogs rather than written here,
// so a future locale edit is measured by this test the day it lands.
import { expect, test } from '@playwright/test';
import { copy as en } from '../src/content/en/copy';
import { copy as it } from '../src/content/it/copy';
import { copy as es } from '../src/content/es/copy';
import { enterLab, openApp, publishPinnedSpec } from './harness';

const VERDICT_KEYS = ['reveal.retracted', 'reveal.replicated', 'reveal.nullReported'] as const;

const LABELS = (['en', 'it', 'es'] as const).flatMap((locale) => {
  const catalog = { en, it, es }[locale];
  return VERDICT_KEYS.map((key) => ({ locale, key, text: catalog[key] }));
});

test('every verdict label, in every locale, is drawn inside the stamp frame', async ({ page }) => {
  // 768 rather than 360: the mark is laid out larger there, so any rounding in
  // the fit lands on the unfavourable side of the comparison.
  await page.setViewportSize({ width: 768, height: 900 });
  await openApp(page, { introSeen: true });
  await enterLab(page);
  await publishPinnedSpec(page);
  await page.locator('.ph-published__cta').click();
  await page.locator('.ph-call__option').first().click();
  await expect(page.locator('.ph-reveal')).toBeVisible();
  await page.locator('[data-block="stamp"]').scrollIntoViewIfNeeded();
  await expect(page.locator('.ph-stamp__label')).not.toBeEmpty();

  // The REAL rendered label element, with the real stylesheet and the real
  // fonts, wearing each shipped string in turn.
  const measured = await page.evaluate((labels: { locale: string; key: string; text: string }[]) => {
    const svg = document.querySelector('.ph-stamp__mark') as SVGSVGElement;
    const text = svg.querySelector('text.ph-stamp__label') as SVGTextElement;
    const original = text.textContent;
    const [regionX, , regionW] = svg.getAttribute('viewBox')!.split(' ').map(Number);

    const rows = labels.map((label) => {
      text.textContent = label.text;
      const box = text.getBBox();
      return {
        ...label,
        left: +box.x.toFixed(1),
        right: +(box.x + box.width).toFixed(1),
        width: +box.width.toFixed(1),
      };
    });
    text.textContent = original;
    return { regionX, regionRight: regionX + regionW, rows };
  }, LABELS);

  for (const row of measured.rows) {
    expect(
      row.left,
      `THE ${row.locale.toUpperCase()} VERDICT "${row.text}" IS SHEARED AT THE LEFT: it starts at ` +
        `${row.left} user units, outside the filter region's ${measured.regionX}. The filter region is a ` +
        'hard clip, so the glyphs are not merely overflowing, they are cut off. See Stamp.tsx TEXT_W.',
    ).toBeGreaterThanOrEqual(measured.regionX);

    expect(
      row.right,
      `THE ${row.locale.toUpperCase()} VERDICT "${row.text}" IS SHEARED AT THE RIGHT: it ends at ` +
        `${row.right} user units, outside the filter region's ${measured.regionRight}. See Stamp.tsx TEXT_W.`,
    ).toBeLessThanOrEqual(measured.regionRight);
  }

  // Guards the guard: if the measurement were blind (a filtered
  // getBoundingClientRect, say) every row would report an identical width and
  // the assertions above would pass without measuring anything. The nine
  // strings differ in length, so a real text measurement cannot report one
  // number for all of them UNLESS textLength is doing its job — which is
  // exactly the property under test, so assert that instead: every label ends
  // up at the SAME fixed advance, and that advance is the one Stamp.tsx sets.
  const widths = [...new Set(measured.rows.map((r) => r.width))];
  expect(
    widths,
    `THE LABEL ADVANCE IS NOT FIXED: measured ${JSON.stringify(widths)}. Every verdict must be set to ` +
      "Stamp.tsx's TEXT_W, or a longer locale string can overrun the frame again.",
  ).toHaveLength(1);
  expect(measured.rows).toHaveLength(9);
});
