# Task T19 — Italian transcreation: report

**Status:** COMPLETE. Full gate green.
**Branch:** `worktree-agent-ac820479677b79f2f`
**Worktree:** `/home/carlos/PycharmProjects/phackle/.claude/worktrees/agent-ac820479677b79f2f`
**Base:** `3fa8621` · **Final SHA:** `1ef01af9cf804480baa69af6a1cb59813a8ae68f`
**Commits:** 1 — `feat: Italian transcreation — full locale content`

---

## STEP 0 — worktree note (read this first)

My assigned working directory was `/home/carlos/PycharmProjects/**website**/.claude/worktrees/agent-ac820479677b79f2f` — a
worktree of the *website* repo, not phackle. No phackle worktree existed for my agent id. I created one at the
conventional path (`git worktree add -b worktree-agent-ac820479677b79f2f .claude/worktrees/agent-ac820479677b79f2f 3fa8621`),
so it started **at** `3fa8621` and the prescribed `git reset --hard 3fa8621` was a no-op. `EnterWorktree` refused to
switch into it (cross-repo), so every file operation used absolute worktree-prefixed paths. Verified `pwd` and
`git rev-parse --show-toplevel` on the phackle worktree throughout; nothing was written to the website checkout.

**Proof-of-corpus discrepancy (benign):** the brief said `src/content/en/index.ts` contains
`"Mentioned {n} times online already"` under `published.altmetricScore`. That string is real and correct but lives in
**`src/content/en/copy.ts:501`** (the copy catalog), not `index.ts`. Confirmed via
`git log -S` that it entered in `08d5fcd` ("braver corpus"), which `3fa8621` merges. I am on the final punched-up corpus.

`npm ci` clean; all npm/npx invocations `PATH="/usr/bin:$PATH"`-prefixed.

---

## TDD trace (genuine RED → GREEN)

| Step | Command | Result |
|---|---|---|
| Baseline | `npx vitest run` | 46 files, **1095 passed** |
| RED (no content) | `npx vitest run tests/content/it.shape.test.ts` | **FAIL** — `Cannot find module '../../src/content/it'` |
| RED (minimal stub) | same | **13 failed / 42 passed** |
| GREEN (full corpus) | same | **55 passed** |
| Gate | `npx tsc --noEmit` | exit **0** |
| Gate | `npx eslint .` | exit **0** |
| Gate | `npx vitest run` | 47 files, **1150 passed**, exit **0** |
| Gate | `npx vite build` | clean; `it-*.js` **46.35 kB as its own chunk** |

The stub RED failed on exactly the assertions that matter — validator parity, scenario ids/order, counts, press
tier bindings, copy-key set, interpolation tokens, decimal point, Grantwell's name, Reviewer 2, the **Italian
direction lexicon** (the stub's `'Riduzione del rendimento'`), and both plumbing cases. Not a module-resolution
artefact.

---

## What shipped

`src/content/it/index.ts` + `src/content/it/copy.ts`: **20 scenarios, 22 Grantwell emails, 21 press blurbs,
14 retraction sublines, 11 achievement citations, 8 glossary entries, 213 copy keys** — 609 user-facing strings,
exactly matching EN's 609.

Wiring (the two shared lines the controller resolves): `AVAILABLE_LOCALES` → `['en', 'it']`;
`getContent`'s `case 'it'` → `await import('./it')`.

### Contract compliance

- **CopyKey union** satisfied exactly — `tsc` is the gate and passes.
- **Structure identical to EN**: scenario ids, order, `journalTags`, press `tier`s and press `scenarioIds`, asserted
  index-by-index.
- **Journals + DOIs stay English** (`src/content/journals.ts` untouched — that is where Italian academics publish).
  `published.test.tsx` proves the masthead renders English while the app runs in Italian.
- **Prof. Grantwell** keeps his name; **Reviewer 2** stays Reviewer 2 (Italian academics say it in English).
- **Decimal POINT** everywhere; `about.decimalNote` translated faithfully and a test asserts **no** `\d,\d` anywhere
  in the catalog.
- **Positive-direction contract** preserved, enforced mechanically by `IT_NEGATIVE_DIRECTION_LEXICON`.
- **Token discipline**: no value repeats a token (`t()` substitutes only the first occurrence); every key carries
  exactly EN's token set; `published.altmetricScore` uses one `{n}` and plural-only phrasing (floor is 40, so safe).
- **Em-dash budget**: **3 dashes in 35,381 chars = 1 per 11,794** (floor 2,500; EN itself is 1 per 10,310). The three
  are `stats.noData`'s glyph and two deliberate TV-chyron dashes, mirroring EN exactly. A test additionally pins IT's
  dash count ≤ EN's.
- `stats.avgScore` translated (`'Punteggio medio'`) despite being unconsumed, as flagged.
- `share.forksWord` / `share.streakWord` → `'biforcazioni'` / `'serie'`. Line 3 renders **`12 biforcazioni · serie 7`**.
  I chose `biforcazioni` over borrowing "fork": it is the ledger's own earlier example, it is the word the glossary
  and the fork trail already use, so the share string teaches the term it counts.

### Required lexicons (`tests/content/it.shape.test.ts`)

EN's lexicons live in `tests/content/shape.test.ts` as exported consts; I mirrored that structure exactly rather than
inventing a new home.

- `IT_HARM_LEXICON` — 14 stems: `vaccin, farmac, cancro, tumor, dieta, diete, dietetic, cura, cure, terapi,
  integrator, malatti, sintom, medicinal`. Two deliberate divergences from a naive translation, both documented in
  code: **`diet` is excluded** because `\bdiet` matches the innocent preposition *dietro*; **`cura` is included**
  because the common Italian collisions (*accuratezza*, *sicurezza*) have a word character before the "cura" and so
  never form a boundary. A negative test pins both.
- `IT_NEGATIVE_DIRECTION_LEXICON` — 25 terms, **ASCII-only on purpose**: JS's `\b` (non-unicode) does not treat
  accented letters as word characters, so a term like `più` would anchor unpredictably.

---

## Ten best transcreations

1. **`thirteen-mortgage` → the number 17.** In Italy the unlucky number is 17, not 13 (XVII anagrams to VIXI,
   "I have lived"); 17 is what hotels and aircraft actually skip. The scenario id stays `thirteen-mortgage` because
   ids are a cross-locale contract and never reach a player. The cover story scores
   **`il punteggio di eptacaidecafobia`** — the real Italian word for fear of 17, and the exact register-match for
   the English "triskaidekaphobia score".
2. **`Rete Sottopancia`** (Nightly Chyron Network). *Sottopancia* is the actual Italian TV term for a lower-third
   caption. An Italian reader doesn't decode the joke, they hear the newsroom.
3. **`P MINORE DI ZERO VIRGOLA ZERO CINQUE — SPIEGHIAMO DOPO LA PUBBLICITÀ`.** The anchor is *speaking*, so the
   separator is the word *virgola*, not a digit — no notation, no decimal-rule conflict, and it makes you hear a real
   TG voice. (Flagged deliberately: this is spoken-word, and the only place "virgola" appears in the locale.)
4. **`l'endecasillabo`** for iambic pentameter. Italian prosody's own canonical line, so "decades on backs and wrists
   and almost none of it on iambic pentameter" lands as a joke about *Italian* literature departments.
5. **`Top {n}% di tutti i prodotti della ricerca, di sempre`.** *Prodotti della ricerca* is the precise phrase Italian
   research assessment uses for a paper. The bureaucratic noun does the comedy for free.
6. **`Il loro barone e il mio si salutano ai convegni. Siamo tecnicamente in gara. Loro non lo sanno.`** The rival-lab
   email, relocated: in Italy the race is between two *baroni* who are perfectly cordial in person.
7. **`Chirurgo degli Outlier` / `Per meriti nella rimozione di esseri umani scomodi.`** *Per meriti* is the literal
   opening formula of an Italian state honour, which is exactly the register an award citation needs.
8. **`Clickeria`** (Clickwell). The clickbait farm gets the same shop-sign suffix as a *pizzeria* / *gelateria*.
9. **`Gli effetti veri si addensano. Il rumore si sparpaglia.`** The pinned §7.3 sentence. *Addensarsi* / *sparpagliarsi*
   are physical, unliterary verbs — it keeps the clinical Act II beat and stays as short as the English.
10. **`La tua sedia da ufficio ti sta costando un Premio Strega?`** and **`il tuo gruppo WhatsApp`** — the Pulitzer and
    the group chat, both re-pointed at what an Italian reader would actually name.

Runner-up worth noting: `lab.peekFootnoteArmitage` opens **`Curiosità:`** — Act I's single permitted wink, kept as
quiet in Italian as "Fun fact:" is in English, and it remains the only one.

---

## Two pre-existing tests I had to change (disclosed)

Both were assertions about the locale list's *current length*, not about behaviour, and real Italian content
falsified them. Neither is in my declared ownership, so flagging explicitly:

1. **`tests/ui/shell.test.tsx`** — "stays hidden while AVAILABLE_LOCALES has only one entry". Rephrased against
   `AVAILABLE_LOCALES` itself, so it now holds for `['en']`, `['en','it']` **and** `['en','it','es']`. Written this
   way deliberately so the parallel Spanish agent's landing cannot falsify it again.
2. **`tests/ui/published.test.tsx`** — the English-masthead-under-Italian-locale test waited on `<html lang>` before
   asserting. `LocaleProvider` sets `lang` as soon as the locale is *detected*, one tick before `getContent()`
   resolves. That gap was invisible while `'it'` aliased the already-imported English module, and became a genuine
   empty-render race the moment `src/content/it/` became its own dynamic import. It now waits on content and asserts
   `lang` afterwards — strictly more than it proved before.

---

## Concerns / notes for the controller

1. **Expected merge conflicts, as briefed:** `src/i18n/locale.ts` (`AVAILABLE_LOCALES`) and `src/content/index.ts`
   (the loader `case`). I touched only the `'it'` line in each and left `case 'es'` returning the English alias.
2. **`tests/ui/shell.test.tsx` and `tests/ui/published.test.tsx` will likely conflict with the Spanish agent**, who
   must hit the identical two failures. My shell-test rewrite is already length-agnostic, so taking either side and
   keeping the `AVAILABLE_LOCALES`-relative form resolves it correctly. The published.test.tsx fix is locale-agnostic
   (it waits on content) and needs no per-locale variant.
3. **Duplicate test registration, cosmetic:** `tests/content/it.shape.test.ts` imports `validateLocaleContent` and the
   lexicon helpers from `tests/content/shape.test.ts` — which the EN file's own doc comment explicitly designs for
   ("Reused as-is by the IT/ES shape tests in T19/T20"). Because the source is itself a test file, its ~30 EN
   `describe`s re-register inside my file, which is why my suite reports 55 tests rather than ~25. They pass; the
   count is inflated, not the coverage. Extracting the validator into a non-test module would fix it but would touch
   a shared file both transcreation agents depend on, so I left it. Worth a small follow-up after both locales merge.
4. **`molino cooperativo`** (sourdough cover story) uses the milling-trade spelling rather than standard `mulino`.
   Intentional — it reads as an actual Italian flour business — but a reviewer may flag it as a typo.
5. Nothing pushed, no branch switches, no merges. `src/content/es/**` untouched.

---

# Fix round 1 (T19 review: APPROVED with two required edits + directed pass)

**Commit:** `51abd66eafeced9136fbfde2e4d9c15034ee9161` on top of `1ef01af`
**Gate:** `tsc --noEmit` exit **0** · `eslint .` exit **0** · `vitest run` exit **0**, **1164/1164** (was 1150; +14 new pinned cases)
**Scope:** `src/content/it/index.ts` and `tests/content/it.shape.test.ts` only. Nothing pushed.
**Still holding:** em dashes **3 in 35,449 chars = 1 per 11,816** (floor 2,500), and the IT ≤ EN dash-count pin (3 ≤ 3). All 213 copy keys, token discipline and the decimal-point rule unchanged.

## REQUIRED

**1. Direction lexicon hole + false comment.** Confirmed and fixed. The old comment claimed every accented
decrease-word contained an unaccented head word already on the list; `basso` was not on it. **Added:** `basso, bassa,
bassi, basse, breve, brevi, corto, corta, corti, corte, ridotte, riduzioni, cali` (25 → 38 terms). The comment is
rewritten to say the true thing: Italian builds comparatives *analytically* ("più basso", "più breve"), so the
**adjective** is what must be listed — matching `più` would be useless because it equally heads every *increase*
phrase ("più alto", "più lungo"). The ASCII-only rationale is kept and now correctly scoped to the lexicon entries
rather than to the labels. Eight reviewer probe labels are pinned as `it.each` regression cases. **No shipped label
was reworded** — all 80 still name gains and were verified clean against the expanded list before it was committed.

**2. horoscope-parking closer.** Both faults confirmed: `indovinare` means to guess *correctly*, and `era vicino` is a
spatial calque. I took the reviewer's diagnosis but a different verb, because the participants are specifically
guessing *the hypothesis* and I wanted to keep that image rather than flatten it to "tried":

> **`Due hanno tirato a indovinare lo stesso, e nessuno dei due c'è andato vicino.`**

`tirare a indovinare` is the exact Italian idiom for guessing *as an attempt* (with no implication of success), which
removes the contradiction at its source, and `andarci vicino` is the idiomatic "was close".

## DIRECTED

**3. `retto` ×2.** Replaced with the natural collocations — Italian *holds* a silence and *sustains* an exchange:
> fern: `Silenzio più lungo **tenuto** dopo una controproposta`
> stairs: `Scambio di chiacchiere più lungo **sostenuto**`

Both still name a maximum, so the positive direction is unchanged.

**4. Calques.** Agreed on all three:
> `I nostri codificatori **lavorano in cieco rispetto alla** condizione` (what Italian methods sections actually say)
> `**installiamo una sonda sul** client di posta per un trimestre. **La sonda** conta soltanto metadati.` (*strumentare* is for orchestras; the follow-on noun is carried through so the next sentence still works)
> `una batteria **di domande sulle** preferenze numeriche **di tutti i giorni**` (*batteria* is standard Italian psychometrics, but it takes items/questions, not preferences)

**5. Grantwell funding logic.** Confirmed: an assessment agency evaluates output and grants no money, so pitching it
would be a joke about a body that cannot grant the wish.
> **`Nella domanda ERC ho scritto che era "alto rischio, alto guadagno". Della seconda parte occupati tu.`**

"Alto rischio, alto guadagno" is the ERC's own high-risk/high-gain formula, which is why Grantwell reaches for it —
desperate and still sincere, no wink. The bank keeps ample Italian institutional flavour (il preside, la commissione
di abilitazione, l'assegno di ricerca, il rettore, i due baroni), and the header comment was corrected to match.

**6. Two outlets.** Agreed — *Ledger* and *Public Record* parody an Anglo naming tradition with no Italian referent:
> `Il Registro Settimanale` → **`La Gazzetta di Provincia`** (×2)
> `Cronaca Pubblica Settimanale` → **`Il Bollettino Civico`** (×2)

*Gazzetta* and *Bollettino* are the shapes Italian local print genuinely uses, and "di Provincia" carries the
small-town dustiness the tier-1 register needs. They now sit in the same room as Clickeria, Rete Sottopancia,
Clamore & Lenzuolo, Il Cinguettio del Mattino and L'Inserto della Domenica. Journals untouched.

**7. Harm hardening (optional, taken).** `medicinal` → **`medic`** (now catches medicina/medico/medici too), plus
**`salute`, `clinic`, `ospedal`, `guarigione`** — 14 → 18 stems. Every addition was probed against all 20 scenarios'
prose *before* being added: **zero false positives**, so no string was reworded. Six new cases pin them. `cura` is
left exactly as adjudicated, and its residual `curatore`/`curare` risk is now written down in the comment as
knowingly accepted rather than left implied.

## Rulings observed

`molino cooperativo` untouched. `locale.ts` and the content loader untouched beyond the original `'it'` lines (the
transitional es-browser state left to self-resolve). Validator extraction still deferred. `shell.test.tsx` and
`published.test.tsx` left exactly as they were.
