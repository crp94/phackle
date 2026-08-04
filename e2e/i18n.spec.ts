// T23 — I18N SMOKE, in the built app, booting straight into the locale.
//
// The strings below are HARDCODED on purpose rather than imported from
// src/content/**. Importing them would compare the catalog to itself and pass
// no matter what reaches the screen; typing them out is what makes this a
// test of the RENDERED product. The briefing CTA in particular is pinned
// forever by owner request: "Apri i dati" / "Abrir los datos" is the string
// that was wrong on screen once, and this is the assertion that says so if it
// ever is again.
//
// Booting INTO the locale (seeded settings) rather than toggling into it is
// deliberate too — a toggle mid-session exercises the switch path, whereas a
// returning player's very first paint is what the fallback bugs live in.
import { expect, test } from '@playwright/test';
import { enterLab, openApp } from './harness';

interface LocaleCase {
  locale: 'it' | 'es';
  briefingCta: string;
  labSubmit: string;
  labReportNull: string;
  navAbout: string;
}

const CASES: LocaleCase[] = [
  {
    locale: 'it',
    briefingCta: 'Apri i dati',
    labSubmit: 'Invia per la pubblicazione',
    labReportNull: 'Riporta un risultato nullo',
    navAbout: 'Informazioni',
  },
  {
    locale: 'es',
    briefingCta: 'Abrir los datos',
    labSubmit: 'Enviar a publicación',
    labReportNull: 'Informar de un resultado nulo',
    navAbout: 'Información',
  },
];

for (const c of CASES) {
  test(`${c.locale}: the app boots translated, one screen deep, with decimal points in the dial`, async ({ page }) => {
    await openApp(page, { locale: c.locale });

    // --- the document declares its language (delta spec i18n §2) ----------
    await expect(
      page.locator('html'),
      `THE PAGE IS LYING ABOUT ITS LANGUAGE: content is being served in ${c.locale} under the wrong ` +
        '<html lang>, which is what a screen reader reads it with.',
    ).toHaveAttribute('lang', c.locale);

    // --- the briefing CTA, pinned forever ---------------------------------
    await expect(
      page.locator('.ph-briefing__cta'),
      `THE BRIEFING CTA IS NOT TRANSLATED IN ${c.locale.toUpperCase()}: it must read "${c.briefingCta}". ` +
        'This is the exact string that shipped in English once.',
    ).toHaveText(c.briefingCta);

    // The header nav too — the shell is not exempt from the catalog.
    await expect(page.locator('.ph-header__nav .ph-seg').last()).toHaveText(c.navAbout);

    // --- one screen deep: real translated content, not an EN fallback -----
    await enterLab(page);

    await expect(
      page.locator('.ph-lab__submit'),
      `THE LAB FELL BACK TO ENGLISH IN ${c.locale.toUpperCase()}: the deeper screens are served by the ` +
        'same locale bundle as the briefing, and one of them did not arrive.',
    ).toHaveText(c.labSubmit);
    await expect(page.locator('.ph-lab__abandon')).toHaveText(c.labReportNull);

    // Raw copy KEYS on screen is what a missed bundle looks like.
    await expect(page.locator('body')).not.toContainText('lab.submit');
    await expect(page.locator('.ph-lab__submit')).not.toHaveText('Submit for publication');

    // --- notation stays notation (about.decimalNote) ----------------------
    const dial = page.locator('.ph-dial__value');
    await expect(dial).toHaveText(/^p\s*[=<]/);
    const dialText = (await dial.innerText()).trim();
    expect(
      dialText,
      `THE p-VALUE WAS LOCALISED IN ${c.locale.toUpperCase()}: "${dialText}" uses a decimal comma. ` +
        'p-values are notation, not prose — "p = 0,043" reads as a different number to half the ' +
        'world, and the About page promises a decimal point in every locale.',
    ).not.toContain(',');
    expect(dialText, `THE DIAL IS NOT SHOWING A 3-DECIMAL p-VALUE: "${dialText}".`).toMatch(
      /^p (= \d\.\d{3}|< 0\.001)$/,
    );

    // The n/df line beneath it is the same promise.
    await expect(page.locator('.ph-dial__meta')).toHaveText(/\d/);
    expect((await page.locator('.ph-dial__meta').innerText()).trim()).not.toContain(',');
  });
}
