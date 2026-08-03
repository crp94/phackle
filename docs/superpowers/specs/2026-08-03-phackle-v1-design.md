# P-hackle v1 — Design decisions (delta spec)

**Date:** 2026-08-03 · **Status:** approved by Carlos · **Master spec:** [`docs/implementation_plan.md`](../../implementation_plan.md)

The master spec is implemented **verbatim**. This document records only the
decisions taken on top of it. Where the two conflict, this document wins;
conflicts beyond the four deltas below must be flagged, not resolved silently.

## Decisions

| Topic | Master spec | Decision |
|---|---|---|
| Localization | English v1; Spanish v2 | **EN (default) / IT / ES at launch, full transcreation** |
| Hosting | Cloudflare Pages or GitHub Pages | **Vercel**, domain `phackle.carlosrodriguezpardo.es` (ops parity with climatle) |
| EPOCH (puzzle #1) | 2026-09-01 | **The date of first production deploy.** Set once in `tuning.ts` at deploy time, then frozen forever (streak comparability). Before deploy, dev builds use practice mode. |
| Analytics | "none, or Plausible if desired" | **Vercel Web Analytics** (free on Hobby: 50k events/mo, cookieless, no banner). Integration: `@vercel/analytics` `inject()` + dashboard toggle. About page discloses: anonymous cookieless page counts only; no cookies, no personal data; all game state (scores, streaks, history) stays in the browser. Fallback if the free cap is ever outgrown: GoatCounter. |

Scope is the full v1 (milestones M0–M5): Hacking Mode, Prereg Mode,
achievements, share grid, stats, dark theme, PWA. The confidence slider stays
deferred to v1.1 per the master spec (§2.6); the binary call is the v1 core.

## Aesthetic direction (added 2026-08-03, approved)

Direction A — **"Preprint Gothic, Nothing-disciplined"**: the master spec's
manuscript language (§7.1–7.2) executed with hard restraint — hairlines
instead of boxes, paper/ink surfaces only, `--sig-red` as the single loud
color (green/gold demoted to inline text scale and confetti), mono tabular
numerals, a fixed 4–64px spacing scale, and the §7.5 motion budget as an
exhaustive list. Codified in `docs/DESIGN.md` (task T28), binding on all UI
tasks (T5, T14–T18) and enforced by a screenshot-driven polish pass (T29).
Considered and declined: a full Nothing-OS reskin and a two-act visual
split — the manuscript look is load-bearing for the satire.

## i18n architecture

Principles: the engine is language-blind; content is data; missing
translations are compile errors, not runtime fallbacks.

1. **Engine isolation.** Nothing in `src/engine/` imports or branches on
   locale. Seeding, scenario selection, day type, DGP, and the specification
   curve are identical across languages: same date ⇒ same puzzle worldwide,
   in every language. Scenario **IDs** are shared across locales; only prose
   differs.
2. **`src/i18n/`.** `type Locale = 'en' | 'it' | 'es'`. Detection:
   `navigator.language` prefix match → fallback `en`. A visible toggle in the
   running header; choice persisted in the localStorage `settings` object
   (extending the master spec's persistence schema, which its §6 permits).
   `<html lang>` is kept in sync on switch.
3. **`src/content/{en,it,es}/`.** Each locale directory exports one object of
   the same TypeScript shape: scenarios, Grantwell emails, press blurbs,
   journal pool, achievement citations, reveal copy, and a flat UI copy
   catalog (`Record<CopyKey, string>`). Exhaustiveness is enforced by the
   type — an untranslated key fails `tsc`. Locales are loaded via dynamic
   `import()` so each session ships one language.
4. **No i18n library.** A small typed `t(key, params)` interpolation helper
   (~20 lines) is sufficient; plural forms are handled by explicit keys where
   needed. This matches the master spec's typed-constants content rule and
   its auditability pillar.
5. **Deliberate non-translations.**
   - Journal mastheads (*Nature Feline Finance* …) and fake DOIs stay
     **English in all locales** — verisimilitude: that is where Italian and
     Spanish academics publish.
   - Statistical notation uses the decimal **point** in all locales
     (`p = 0.049`, never `0,049`); documented on the About page.
   - Press outlet names *are* transcreated (consumer media, not journals).
6. **Share strings.** The human words are localized ("7 forks" / "7 fork" /
   "7 bifurcaciones"); the emoji grid, puzzle number, and URL are identical
   across locales so grids remain comparable worldwide. The spoiler-safety
   property test (§8.4 of the master spec) runs against all three locales.

## Content plan (trilingual)

English is the comedic source of truth, authored to the master spec §4
(≥20 scenarios, ≥12 Grantwell emails, journal pool, press blurbs,
achievement citations, reveal copy, About + glossary). Italian and Spanish
are **transcreations by dedicated agents**, briefed on the register rules
(Act I sincere, Act II clinical, mock-academic; never smug) and the
harm-check policy (absurd-but-benign; no medical/nutrition claims). One
review pass per language for humor, tone, and register before launch.
Content is data: a weak translation is patchable post-launch without code
changes.

## Testing & deploy deltas

- Copy-catalog completeness: compile-time (see i18n §3).
- Share spoiler property test: ×3 locales.
- E2E: one added smoke assertion for the language toggle (switch to IT,
  assert briefing renders Italian, reload, assert persistence).
- A11y pass includes `lang` attribute correctness.
- Deploy: Vercel static output; `index.html` no-cache, hashed assets
  immutable (master spec §10); DNS CNAME `phackle` added alongside
  climatle's existing record.

## Risks (delta-specific)

| Risk | Mitigation |
|---|---|
| Transcreated humor falls flat in IT/ES | Per-language review pass; content-as-data means post-launch patches are copy edits, not releases |
| Locale layer leaks into engine | Lint rule: `src/engine/` may not import from `src/i18n/` or `src/content/` (extends the master spec's no-React-in-engine lint rule) |
| Localized share words break grid comparability | Emoji/number/URL layout fixed across locales; only the trailing words differ; covered by share-string tests |
