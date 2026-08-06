// Master spec §2.9 — spoiler-safe share grid. Pure logic, plain node env.
import { describe, expect, it } from 'vitest';
import {
  ABANDON_EMOJI,
  CALL_CORRECT,
  CALL_INCORRECT,
  FORK_EMOJI,
  FORK_GROUP_SIZE,
  PREREG_PREFIX,
  SITE_URL,
  SUBMIT_EMOJI,
  shareString,
} from '../../src/game/share';
import { callIsCorrect } from '../../src/game/scoring';
import { countForks } from '../../src/game/forkLog';
import { createGameStore } from '../../src/game/store';
import { EPOCH, N_SCHEDULE } from '../../src/game/tuning';
import { AVAILABLE_LOCALES } from '../../src/i18n/locale';
import { getContent } from '../../src/content';
import { copy as enCopy } from '../../src/content/en/copy';
import type { EngineClient, RevealPayload } from '../../src/engine/protocol';
import type { PathResult, PlayerAction, Spec } from '../../src/engine/types';

// --- fixtures ----------------------------------------------------------------

const baseSpec: Spec = {
  outcome: 0,
  subgroup: 'all',
  covariates: { income: false, risk: false },
  exclusion: 'none',
  transform: 'raw',
  tails: 'two',
};

function spec(overrides: Partial<Omit<Spec, 'covariates'>> & { covariates?: Partial<Spec['covariates']> } = {}): Spec {
  return { ...baseSpec, ...overrides, covariates: { ...baseSpec.covariates, ...overrides.covariates } };
}

function view(s: Spec, seen: boolean, at: number): PlayerAction {
  return { t: 'VIEW_SPEC', spec: s, seen, at };
}
function peek(at: number): PlayerAction {
  return { t: 'PEEK_AND_EXTEND', newN: 250, at };
}
function submit(s: Spec, at: number): PlayerAction {
  return { t: 'SUBMIT', spec: s, p: 0.01, at };
}
function abandon(at: number): PlayerAction {
  return { t: 'ABANDON', at };
}

// Recognizes each legend glyph as a whole token (§2.9's legend, T12's ForkKind
// map) — robust to multi-code-unit glyphs (e.g. the white-flag + VS16 pair in
// 🏳️) that a naive Array.from/codepoint count would miscount.
// 🎯/🔪/🌗 are retired by T29's owner ruling (all four spec-change kinds now
// print 🍴) and are kept in this tokenizer deliberately: it must stay total
// over any trail, including one restored from a pre-T29 saved share string.
const EMOJI_TOKENS = ['🧾', '🎯', '🔪', '🌗', '🍴', '➕', '📄', '🏳️'];
/** Tokenizes the GLYPHS. §1(i)'s group separator (U+0020) is dropped rather
 * than tokenized: every caller below is counting or ordering markers, and a
 * separator is neither. The group SHAPE — where the spaces fall — is pinned
 * by its own describe block further down, so nothing about the chunking is
 * left unasserted by this omission. */
function tokenizeTrail(trail: string): string[] {
  const tokens: string[] = [];
  let rest = trail;
  outer: while (rest.length > 0) {
    if (rest.startsWith(' ')) {
      rest = rest.slice(1);
      continue;
    }
    for (const tok of EMOJI_TOKENS) {
      if (rest.startsWith(tok)) {
        tokens.push(tok);
        rest = rest.slice(tok.length);
        continue outer;
      }
    }
    throw new Error(`unrecognized character in trail: ${JSON.stringify(rest)} (full trail: ${JSON.stringify(trail)})`);
  }
  return tokens;
}

function trailOf(shareOutput: string): string {
  return shareOutput.split('\n')[1].split(' → ')[0];
}

// --- layout ------------------------------------------------------------------

describe('shareString — §2.9 layout', () => {
  it('is exactly 4 lines: puzzle number, trail, forks/streak, URL', () => {
    const log: PlayerAction[] = [view(spec(), false, 0), submit(spec(), 1)];
    const out = shareString({ puzzleNumber: 5, log, mode: 'hack', callCorrect: true, streak: 1, copy: enCopy });
    const lines = out.split('\n');
    expect(lines).toHaveLength(4);
    // §1(i): line 1 is the brand + issue number, then the catalog's own
    // tagline as the hook. The brand half stays a literal (invariant); the
    // hook half is read from the same `copy` bundle line 3 reads.
    expect(lines[0]).toBe(`P-hackle #5 · ${enCopy['nav.tagline']}`);
    expect(lines[3]).toBe(SITE_URL);
  });

  it('SITE_URL is the real production domain', () => {
    expect(SITE_URL).toBe('https://phackle.carlosrodriguezpardo.es');
  });

  it('line 3 reports forks and streak using the localized words', () => {
    const log: PlayerAction[] = [
      view(spec(), false, 0),
      view(spec({ outcome: 1 }), true, 1),
      submit(spec({ outcome: 1 }), 2),
    ];
    const forks = countForks(log);
    const out = shareString({ puzzleNumber: 9, log, mode: 'hack', callCorrect: true, streak: 12, copy: enCopy });
    expect(out.split('\n')[2]).toBe(`Forks: ${forks} · Streak: 12`);
  });

  // Generic-contract test (post-review re-scope): this hand-built log
  // contains a literal SUBMIT entry, which a REAL prereg day never produces
  // (store.ts's preregCommit() logs only VIEW_SPEC entries — see the "real
  // preregCommit shape" test below for that actual case). It still passes
  // unchanged because buildTrail's prefix is unconditional on `prereg` and
  // its terminal is now ALSO mode-decided rather than log-decided (any
  // literal SUBMIT/ABANDON in a prereg-tagged log is deliberately ignored,
  // and the same single 📄 is appended regardless) — this test is exercising
  // that generic mechanical contract (the prefix), not a realistic log shape.
  it('prereg mode prefixes the trail with 🧾', () => {
    const log: PlayerAction[] = [view(spec(), false, 0), submit(spec(), 1)];
    const out = shareString({ puzzleNumber: 1, log, mode: 'prereg', callCorrect: true, streak: 0, copy: enCopy });
    expect(trailOf(out).startsWith('🧾')).toBe(true);
  });

  // Real preregCommit shape (post-review fix): store.ts's preregCommit()
  // never logs a SUBMIT or ABANDON action at all — a preregistered commit is
  // always run and reported (§2.6/§7.3 — there is no abandon path) — and
  // never makes a call (§2.8: no CALL step), so callCorrect is always null.
  // This is the log shape (and the exact expected output) a REAL prereg day
  // actually produces.
  it('the real preregCommit shape (a single un-seen VIEW_SPEC, no SUBMIT/ABANDON at all) still ends in exactly one 📄, with no ⚖️ suffix at all', () => {
    const log: PlayerAction[] = [view(spec(), false, 0)];
    const out = shareString({ puzzleNumber: 1, log, mode: 'prereg', callCorrect: null, streak: 0, copy: enCopy });
    expect(out.split('\n')[1]).toBe('🧾 📄');
  });

  it('hack mode never prefixes with 🧾', () => {
    const log: PlayerAction[] = [view(spec(), false, 0), submit(spec(), 1)];
    const out = shareString({ puzzleNumber: 1, log, mode: 'hack', callCorrect: true, streak: 0, copy: enCopy });
    expect(trailOf(out).startsWith('🧾')).toBe(false);
  });

  it('a correct call ends the trail with ⚖️✅, an incorrect call with ⚖️❌', () => {
    const log: PlayerAction[] = [view(spec(), false, 0), submit(spec(), 1)];
    const correct = shareString({ puzzleNumber: 1, log, mode: 'hack', callCorrect: true, streak: 0, copy: enCopy });
    const incorrect = shareString({ puzzleNumber: 1, log, mode: 'hack', callCorrect: false, streak: 0, copy: enCopy });
    expect(correct.split('\n')[1].endsWith('⚖️✅')).toBe(true);
    expect(incorrect.split('\n')[1].endsWith('⚖️❌')).toBe(true);
  });

  it('an abandoned day ends the trail with 🏳️, a published day with 📄', () => {
    const publishedLog: PlayerAction[] = [view(spec(), false, 0), submit(spec(), 1)];
    const abandonedLog: PlayerAction[] = [view(spec(), false, 0), abandon(1)];
    const published = shareString({ puzzleNumber: 1, log: publishedLog, mode: 'hack', callCorrect: true, streak: 0, copy: enCopy });
    const abandoned = shareString({ puzzleNumber: 1, log: abandonedLog, mode: 'hack', callCorrect: true, streak: 0, copy: enCopy });
    const publishedTokens = tokenizeTrail(trailOf(published));
    const abandonedTokens = tokenizeTrail(trailOf(abandoned));
    expect(publishedTokens[publishedTokens.length - 1]).toBe('📄');
    expect(abandonedTokens[abandonedTokens.length - 1]).toBe('🏳️');
  });
});

// --- emoji count === forks (+ markers) ---------------------------------------

describe('emoji trail length matches countForks exactly (§2.10 is the source of truth)', () => {
  it('hack mode: trail length === forks + 1 (the terminal 📄/🏳️ marker)', () => {
    const log: PlayerAction[] = [
      view(spec(), false, 0), // free
      view(spec({ outcome: 1 }), true, 1), // fork: spec
      view(spec({ subgroup: 'urban' }), true, 2), // fork: subgroup
      peek(3), // fork: peek
      view(spec({ subgroup: 'urban', exclusion: 'z2' }), true, 4), // fork: exclusion
      submit(spec({ subgroup: 'urban', exclusion: 'z2' }), 5),
    ];
    const forks = countForks(log);
    const out = shareString({ puzzleNumber: 1, log, mode: 'hack', callCorrect: true, streak: 0, copy: enCopy });
    expect(tokenizeTrail(trailOf(out))).toHaveLength(forks + 1);
  });

  // Generic-contract test (post-review re-scope): the trailing abandon()
  // here is not a shape a real prereg day can produce (Prereg Mode has no
  // abandon path at all — see the doc comment on buildTrail); it is
  // deliberately IGNORED for prereg now, and the single, fixed terminal 📄
  // is appended regardless, so the length still comes out the same (one
  // terminal either way) — this is checking the generic "prefix + one
  // terminal, regardless of log content" contract, not a realistic log.
  it('prereg mode: trail length === forks + 2 (🧾 prefix + terminal marker)', () => {
    const log: PlayerAction[] = [
      view(spec(), false, 0),
      view(spec({ outcome: 1 }), true, 1),
      view(spec({ tails: 'one' }), true, 2),
      abandon(3),
    ];
    const forks = countForks(log);
    const out = shareString({ puzzleNumber: 1, log, mode: 'prereg', callCorrect: true, streak: 0, copy: enCopy });
    expect(tokenizeTrail(trailOf(out))).toHaveLength(forks + 2);
  });

  it('a change made before the previous result rendered (seen:false) contributes no emoji, matching countForks', () => {
    const log: PlayerAction[] = [
      view(spec(), false, 0),
      view(spec({ outcome: 1 }), false, 1), // debounce-collapsed: does not count
      view(spec({ outcome: 2 }), true, 2), // counts, classified against spec(outcome:1)
      submit(spec({ outcome: 2 }), 3),
    ];
    const forks = countForks(log); // = 1
    const out = shareString({ puzzleNumber: 1, log, mode: 'hack', callCorrect: true, streak: 0, copy: enCopy });
    expect(forks).toBe(1);
    expect(tokenizeTrail(trailOf(out))).toHaveLength(2); // 1 fork + terminal
  });
});

// --- exact §2.9 sample, reproduced with a scripted log -----------------------

describe('reproduces the master spec §2.9 illustrative sample', () => {
  // The spec's own illustration reads:
  //   P-hackle #37
  //   🍴🎯🍴🔪➕🍴📄 → ⚖️✅
  //   7 forks · streak 12
  //   phackle.example
  // Byte-inspecting that emoji line (see task report) shows exactly 7 code
  // points: 🍴🎯🍴🔪➕🍴📄 — 6 fork/peek markers plus the terminal 📄. The "7
  // forks" caption is off by one against its own illustration. This test
  // reproduces the identical STRUCTURE and emoji SEQUENCE with a scripted log
  // built from real Spec transitions, and asserts the fork count our
  // countForks()-driven line 3 actually reports for that exact trail — which
  // is 6, matching the emoji shown (not the spec prose's inconsistent "7").
  // (URL uses the real SITE_URL, not the illustrative "phackle.example".)
  //
  // T29 (owner ruling, documented at share.ts's FORK_EMOJI): the four
  // spec-change fork kinds now all render as 🍴, so the same six transitions
  // print 🍴🍴🍴🍴➕🍴 instead of 🍴🎯🍴🔪➕🍴. The assertion below is
  // repointed, NOT relaxed: the log is unchanged, the transitions are
  // unchanged, classifyChange still returns spec/subgroup/spec/exclusion/spec
  // for them (the four kinds are still four kinds — achievements read them),
  // countForks still reports 6, the peek marker is still distinct, and the
  // terminal + call markers are untouched. Only the glyph each fork kind maps
  // to changed, which is exactly what this test now pins.
  //
  // T37 fix round 1 (controller ruling, documented at share.ts's shareString):
  // line 3's LAYOUT is amended from "{forks} {forksWord} · {streakWord}
  // {streak}" to the label-colon-count form, because the spec's own shape
  // prints "1 forks" (and "1 biforcazioni", "1 bifurcaciones") on a one-fork
  // day, in the one string that leaves the app. Same two numbers, same two
  // localized words, same absence of any day-type input: this assertion is
  // repointed for the new punctuation and nothing else.
  //
  // §1(i) (owner ruling, documented at share.ts's `groupForkRun` and
  // `shareString`): line 1 gains the tagline hook and line 2's fork run is
  // grouped in fives. Six forks is one full group and one of one, so this
  // sample now prints "🍴🍴🍴🍴➕ 🍴 📄". Same log, same transitions, same six
  // markers in the same order, same terminal, same call suffix — repointed
  // for the two typographic rulings and nothing else.
  it('🍴🍴🍴🍴➕ 🍴 📄 → ⚖️✅ / Forks: 6 · Streak: 12 / SITE_URL', () => {
    const s0 = spec();
    const s1 = spec({ outcome: 1 }); // only outcome differs from s0 -> 'spec' (🍴)
    const s2 = spec({ outcome: 1, subgroup: 'urban' }); // only subgroup differs from s1 -> 'subgroup' (🍴)
    const s3 = spec({ outcome: 2, subgroup: 'urban' }); // only outcome differs from s2 -> 'spec' (🍴)
    const s4 = spec({ outcome: 2, subgroup: 'urban', exclusion: 'z2' }); // only exclusion differs -> 'exclusion' (🍴)
    const s5 = spec({ outcome: 3, subgroup: 'urban', exclusion: 'z2' }); // only outcome differs from s4 -> 'spec' (🍴)

    const log: PlayerAction[] = [
      view(s0, false, 0),
      view(s1, true, 1),
      view(s2, true, 2),
      view(s3, true, 3),
      view(s4, true, 4),
      peek(5),
      view(s5, true, 6),
      submit(s5, 7),
    ];

    expect(countForks(log)).toBe(6);

    const out = shareString({ puzzleNumber: 37, log, mode: 'hack', callCorrect: true, streak: 12, copy: enCopy });
    expect(out).toBe(
      [
        `P-hackle #37 · ${enCopy['nav.tagline']}`,
        '🍴🍴🍴🍴➕ 🍴 📄 → ⚖️✅',
        'Forks: 6 · Streak: 12',
        SITE_URL,
      ].join('\n')
    );
  });

  // The owner ruling's own acceptance criterion, pinned so a future edit
  // cannot quietly re-expand the set: in-trail vocabulary is exactly two
  // glyphs, and the whole vocabulary is seven.
  it('renders every fork with 🍴 and every peek with ➕ — a two-glyph in-trail vocabulary', () => {
    expect(new Set(Object.values(FORK_EMOJI))).toEqual(new Set(['🍴', '➕']));
    expect(FORK_EMOJI.subgroup).toBe(FORK_EMOJI.spec);
    expect(FORK_EMOJI.exclusion).toBe(FORK_EMOJI.spec);
    expect(FORK_EMOJI.tails).toBe(FORK_EMOJI.spec);
    expect(FORK_EMOJI.peek).not.toBe(FORK_EMOJI.spec);

    const vocabulary = new Set([
      ...Object.values(FORK_EMOJI),
      PREREG_PREFIX,
      SUBMIT_EMOJI,
      ABANDON_EMOJI,
      CALL_CORRECT,
      CALL_INCORRECT,
    ]);
    expect(vocabulary.size).toBe(7);
  });
});

// --- §1(i): the run is grouped, and line 1 has a hook ------------------------

describe('§1(i) — the fork run is read as groups of five, and line 1 says what the game is', () => {
  // A log with EXACTLY k counted forks: one free default view, then k seen
  // changes alternating between two specs (each transition is a real
  // `classifyChange` fork), then a terminal. Built from real Spec transitions
  // so `countForks` — the number line 3 prints — is the same k by the same
  // rule the walk uses, not by arithmetic performed here.
  function logWithForks(k: number, terminal: 'submit' | 'abandon' = 'submit'): PlayerAction[] {
    const log: PlayerAction[] = [view(spec(), false, 0)];
    for (let i = 0; i < k; i++) log.push(view(spec({ outcome: (i % 2) + 1 }), true, i + 1));
    log.push(terminal === 'submit' ? submit(spec({ outcome: (k % 2) + 1 }), k + 1) : abandon(k + 1));
    return log;
  }

  function line2Of(log: PlayerAction[], mode: 'hack' | 'prereg' = 'hack'): string {
    return shareString({ puzzleNumber: 12, log, mode, callCorrect: null, streak: 4, copy: enCopy }).split('\n')[1];
  }

  /** The parts of line 2 that are runs of fork glyphs — i.e. everything
   * except the prefix and the terminal, which are their own parts. */
  function forkGroupsOf(line2: string): string[] {
    return line2
      .split(' ')
      .filter((part) => part !== PREREG_PREFIX && part !== SUBMIT_EMOJI && part !== ABANDON_EMOJI);
  }

  it('the group size is five — the largest run a reader takes in without counting', () => {
    expect(FORK_GROUP_SIZE).toBe(5);
  });

  it.each([0, 1, 4, 5, 6, 10, 11, 43, 60])('%i forks: every group but the last is full, and the last is never empty', (k) => {
    const log = logWithForks(k);
    expect(countForks(log)).toBe(k);
    const groups = forkGroupsOf(line2Of(log));
    expect(groups).toHaveLength(Math.ceil(k / FORK_GROUP_SIZE));
    groups.forEach((group, i) => {
      const size = tokenizeTrail(group).length;
      if (i < groups.length - 1) expect(size).toBe(FORK_GROUP_SIZE);
      else expect(size).toBeGreaterThanOrEqual(1);
      expect(size).toBeLessThanOrEqual(FORK_GROUP_SIZE);
    });
  });

  // The measured worst case in the finding (gr2-010: 0-60 forks over 32 days
  // x 3 models) spelled out, because it is the day the ruling was about.
  it('the 43-fork day is eight full groups and a three — one readable object, not a wall', () => {
    const line2 = line2Of(logWithForks(43));
    expect(forkGroupsOf(line2).map((g) => tokenizeTrail(g).length)).toEqual([5, 5, 5, 5, 5, 5, 5, 5, 3]);
    expect(line2.endsWith(` ${SUBMIT_EMOJI}`)).toBe(true);
  });

  // THE CAP WAS DECLINED (see groupForkRun's doc comment for the three
  // reasons). This is the guard on that decision: a future edit that quietly
  // truncates the run to keep the line short loses glyphs here, and the
  // failure names the count.
  it('nothing is ever truncated: a sixty-fork day still prints sixty fork glyphs', () => {
    const log = logWithForks(60);
    const tokens = tokenizeTrail(line2Of(log));
    expect(tokens.filter((t) => t === FORK_EMOJI.spec)).toHaveLength(60);
    expect(tokens).toHaveLength(61); // 60 forks + the terminal
    expect(line2Of(log)).not.toContain('+');
  });

  // Separator hygiene across the whole plausible range, both modes, both
  // terminals: no leading space, no trailing space, no doubled space, and
  // never a space inside a group. Zero forks is included in the sweep, which
  // is where a naive join produces `🧾  📄`.
  it('no leading, trailing or doubled space at any fork count, in either mode, with either terminal', () => {
    for (let k = 0; k <= 62; k++) {
      for (const mode of ['hack', 'prereg'] as const) {
        for (const terminal of ['submit', 'abandon'] as const) {
          const line2 = line2Of(logWithForks(k, terminal), mode);
          expect(line2, `k=${k} mode=${mode} terminal=${terminal}: ${JSON.stringify(line2)}`).not.toMatch(
            /^ | $| {2}/
          );
        }
      }
    }
  });

  it('grouping is presentation only: strip the separators and the ungrouped trail is exactly there', () => {
    for (let k = 0; k <= 30; k++) {
      const log = logWithForks(k);
      const ungrouped = tokenizeTrail(line2Of(log)).join('');
      expect(line2Of(log).replace(/ /g, '')).toBe(ungrouped);
      // ...and the count line still agrees with the glyphs, which is the
      // invariant grouping could most easily have broken.
      expect(tokenizeTrail(line2Of(log))).toHaveLength(countForks(log) + 1);
    }
  });

  it('a zero-fork prereg day is 🧾 📄 and a zero-fork abandoned hack day is just 🏳️', () => {
    expect(line2Of(logWithForks(0), 'prereg')).toBe(`${PREREG_PREFIX} ${SUBMIT_EMOJI}`);
    expect(line2Of(logWithForks(0, 'abandon'), 'hack')).toBe(ABANDON_EMOJI);
  });

  it('line 1 carries the LOCALE’s own tagline, and the brand half stays invariant', async () => {
    for (const locale of AVAILABLE_LOCALES) {
      const content = await getContent(locale);
      const line1 = shareString({
        puzzleNumber: 88,
        log: logWithForks(2),
        mode: 'hack',
        callCorrect: true,
        streak: 3,
        copy: content.copy,
      }).split('\n')[0];
      expect(line1).toBe(`P-hackle #88 · ${content.copy['nav.tagline']}`);
      expect(line1.startsWith('P-hackle #88 · ')).toBe(true);
      // The hook is a real sentence, not an empty or placeholder value: the
      // whole point of the row is that a stranger reads a content word.
      expect(content.copy['nav.tagline'].length).toBeGreaterThan(10);
    }
  });

  // The hook must not become a second channel. It takes no day input at all —
  // pinned here directly (constant across every other varying argument) as
  // well as by the 300-draw property test below, which compares whole strings.
  it('line 1 varies with the puzzle number and NOTHING else the day decides', () => {
    const a = shareString({ puzzleNumber: 4, log: logWithForks(1), mode: 'hack', callCorrect: true, streak: 0, copy: enCopy });
    const b = shareString({ puzzleNumber: 4, log: logWithForks(9), mode: 'prereg', callCorrect: null, streak: 41, copy: enCopy });
    expect(a.split('\n')[0]).toBe(b.split('\n')[0]);
  });

  // §2.9's line-3 ruling is untouched by either half of §1(i): still exactly
  // the two figures, still no third.
  it('line 3 still takes only forks and streak', () => {
    const out = shareString({ puzzleNumber: 3, log: logWithForks(7), mode: 'hack', callCorrect: false, streak: 9, copy: enCopy });
    expect(out.split('\n')[2]).toBe('Forks: 7 · Streak: 9');
  });
});

// --- spoiler-safety property test (§2.9's signature rule) --------------------

describe('spoiler-safety property test: the string never leaks day type', () => {
  // Tiny seeded LCG (Numerical Recipes / glibc constants) — deterministic,
  // NOT Math.random (banned across this codebase, and a fixed seed is what
  // makes a property-test failure reproducible).
  function makeLcg(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 4294967296;
    };
  }

  const pool: Spec[] = [
    spec(),
    spec({ outcome: 1 }),
    spec({ subgroup: 'urban' }),
    spec({ exclusion: 'z2' }),
    spec({ tails: 'one' }),
  ];

  /** A causally-plausible random action pattern: some VIEW_SPEC traffic
   * (revisits + new specs, each newly-introduced spec reachable only once
   * the prior one rendered, matching real store causality — see
   * forkLog.test.ts's identical convention), some peeks, terminated by a
   * SUBMIT or ABANDON so the trail always has its terminal marker. */
  function genPattern(rng: () => number): { log: PlayerAction[]; mode: 'hack' | 'prereg' } {
    const log: PlayerAction[] = [];
    const exploredIdx: number[] = [0];
    let at = 0;
    log.push(view(pool[0], rng() < 0.5, at++));
    const steps = 1 + Math.floor(rng() * 15);
    for (let i = 0; i < steps; i++) {
      if (rng() < 0.2) {
        log.push(peek(at++));
        continue;
      }
      const introduceNew = exploredIdx.length < pool.length && rng() < 0.5;
      if (introduceNew) {
        const idx = exploredIdx.length;
        exploredIdx.push(idx);
        log.push(view(pool[idx], true, at++));
      } else {
        const idx = exploredIdx[Math.floor(rng() * exploredIdx.length)];
        log.push(view(pool[idx], rng() < 0.5, at++));
      }
    }
    const lastIdx = exploredIdx[exploredIdx.length - 1];
    // Terminal action: `at`'s incremented value is never read again after
    // this, so no post-increment here (that's what no-useless-assignment
    // above was flagging).
    log.push(rng() < 0.5 ? submit(pool[lastIdx], at) : abandon(at));
    const mode: 'hack' | 'prereg' = rng() < 0.5 ? 'hack' : 'prereg';
    return { log, mode };
  }

  it('holds over 300 seeded-random action patterns, for every locale in AVAILABLE_LOCALES', async () => {
    expect(AVAILABLE_LOCALES.length).toBeGreaterThan(0); // sanity: the loop below isn't vacuous
    const rng = makeLcg(0x5eed01);

    for (const locale of AVAILABLE_LOCALES) {
      const content = await getContent(locale);
      const copy = content.copy;

      for (let trial = 0; trial < 300; trial++) {
        const { log, mode } = genPattern(rng);
        const puzzleNumber = 1 + Math.floor(rng() * 500);
        const streak = Math.floor(rng() * 60);

        // Same action pattern, opposite underlying day types, both resolving
        // to a CORRECT call: (null day, called noise) vs (effect day, called
        // real). If day type ever leaked, these would differ.
        const correctOnNull = shareString({
          puzzleNumber,
          log,
          mode,
          callCorrect: callIsCorrect('noise', 'null'),
          streak,
          copy,
        });
        const correctOnEffect = shareString({
          puzzleNumber,
          log,
          mode,
          callCorrect: callIsCorrect('real', 'effect'),
          streak,
          copy,
        });
        expect(correctOnEffect).toBe(correctOnNull);

        // Same pattern, opposite day types, both resolving to a WRONG call.
        const wrongOnNull = shareString({
          puzzleNumber,
          log,
          mode,
          callCorrect: callIsCorrect('real', 'null'),
          streak,
          copy,
        });
        const wrongOnEffect = shareString({
          puzzleNumber,
          log,
          mode,
          callCorrect: callIsCorrect('noise', 'effect'),
          streak,
          copy,
        });
        expect(wrongOnEffect).toBe(wrongOnNull);

        // Correctness itself IS meant to be visible (not a spoiler) — the
        // correct-pair and wrong-pair strings should differ from each other.
        expect(correctOnNull).not.toBe(wrongOnNull);
      }
    }
  });

  // --- T18 post-review fix: the property test that would have caught the
  // original bug (preregCommit logs no SUBMIT/ABANDON at all, and
  // `callCorrect ?? false` coerced Prereg Mode's real `null` into an
  // unconditional wrong-call reading — neither was exercised by the test
  // above, which only ever varies `callCorrect` between two BOOLEAN values
  // computed from callIsCorrect, never null, and always terminates its
  // generated log with a literal SUBMIT/ABANDON that a real prereg day would
  // never contain).
  //
  // Prereg Mode's real spoiler surface is narrower than hack mode's: it never
  // calls at all, so callCorrect is always null, and preregCommit's own log-
  // building never consults the result (§2.6 — nothing is ever shown before
  // commit), so the SAME action log is what a significant day and a
  // non-significant day both produce.
  //
  // gr6-053 / gr1c-024: THIS TEST USED TO BE A TAUTOLOGY. It called
  // shareString twice with BYTE-IDENTICAL arguments — two hand-built logs, the
  // same callCorrect: null — and asserted the outputs matched. `f(x) === f(x)`
  // holds for any deterministic shareString, including one leaking day type
  // through some other channel entirely, and it held it 300 times a run.
  // Significance was never an input.
  //
  // It is now driven through the REAL path: two `createGameStore()` instances
  // booted in prereg mode against a fake EngineClient, one whose runSpec
  // returns a genuinely significant PathResult (valid, p < .05) and one whose
  // runSpec returns a genuinely non-significant one, each taken all the way
  // through `preregCommit()` — the production code that builds the log. The
  // logs the assertion compares are the store's OWN, and significance is
  // really the only varied input. The stores' divergent `preregResult`/`reveal`
  // state is asserted first, so a fake that failed to make the day types differ
  // could not pass this test by making both sides trivially equal.
  //
  // 300 draws stay HERE, because this is where fuzzing pays: the committed
  // spec, puzzle number and streak vary per draw.
  async function runPreregDay(committed: Spec, significant: boolean) {
    const result: PathResult = {
      spec: committed,
      n: 400,
      beta: significant ? 0.42 : 0.01,
      se: 0.05,
      t: significant ? 8.4 : 0.2,
      // The exact signal preregCommit reads: `result.valid && result.p < 0.05`.
      p: significant ? 0.001 : 0.62,
      ci: significant ? [0.32, 0.52] : [-0.09, 0.11],
      excludedCount: 0,
      valid: true,
    };
    const reveal: RevealPayload = {
      totalPaths: 1792,
      sigPaths: significant ? 900 : 40,
      sigFraction: significant ? 0.5 : 0.02,
      playerExplored: 1,
      pHitAtK: 0.5,
      curve: [],
      stamp: significant ? 'REPLICATED' : 'RETRACTED',
      peeks: 0,
      dayType: significant ? 'effect' : 'null',
      trueOutcome: significant ? committed.outcome : null,
      trueBeta: significant ? 0.4 : 0,
      hetero: null,
      capExhausted: false,
    };
    const client: EngineClient = {
      init: async () => ({ scenarioIndex: 0, n: N_SCHEDULE[0] }),
      runSpec: async () => result,
      extend: async () => ({ n: N_SCHEDULE[N_SCHEDULE.length - 1] }),
      reveal: async () => reveal,
      onCrash: () => {},
    };

    const store = createGameStore();
    await store.getState().boot(client, EPOCH, { practice: false, mode: 'prereg', scenarioCount: 20 });
    store.getState().chooseMode('prereg');
    await store.getState().preregCommit(committed);
    return store.getState();
  }

  it('prereg mode: the share string produced by a real preregCommit() on a SIGNIFICANT day is byte-identical to the one produced on a NON-SIGNIFICANT day', async () => {
    const rng = makeLcg(0x9e3779b9);
    const content = await getContent('en');
    const copy = content.copy;

    for (let trial = 0; trial < 300; trial++) {
      const committed = pool[Math.floor(rng() * pool.length)];
      const puzzleNumber = 1 + Math.floor(rng() * 500);
      const streak = Math.floor(rng() * 60);

      const sigDay = await runPreregDay(committed, true);
      const nullDay = await runPreregDay(committed, false);

      // The two days really ARE different days — asserted before comparing the
      // share strings, so this can never quietly degrade back into f(x)===f(x)
      // by both sides becoming the same run.
      expect(sigDay.preregResult?.p).toBeLessThan(0.05);
      expect(nullDay.preregResult?.p).toBeGreaterThan(0.05);
      expect(sigDay.reveal?.stamp).not.toBe(nullDay.reveal?.stamp);
      expect(sigDay.reveal?.dayType).not.toBe(nullDay.reveal?.dayType);

      // Summary.tsx's real wiring: `call` stays null regardless of preregSig
      // (Prereg Mode never makes a call at all). Everything else on both sides
      // is the store's own output for its own day.
      const fromSig = shareString({ puzzleNumber, log: sigDay.log, mode: 'prereg', callCorrect: null, streak, copy });
      const fromNull = shareString({ puzzleNumber, log: nullDay.log, mode: 'prereg', callCorrect: null, streak, copy });
      expect(fromSig).toBe(fromNull);
    }
  });

  // The other half of the old test, kept because it is NOT vacuous — but run
  // ONCE rather than 300 times, because it proves a different proposition and
  // has no random input to fuzz. If a future regression derived callCorrect
  // from significance (the exact bug class: "sig -> true -> ⚖️✅",
  // "non-sig -> false -> ⚖️❌"), the two outputs would visibly differ — which
  // is what makes the null-callCorrect contract above load-bearing rather than
  // decorative.
  it('callCorrect IS a real leak channel: the same prereg log with callCorrect true vs false produces different strings', async () => {
    const content = await getContent('en');
    const copy = content.copy;
    const log: PlayerAction[] = [view(pool[0], false, 0), view(pool[1], false, 1)];

    const leakedIfSig = shareString({ puzzleNumber: 7, log, mode: 'prereg', callCorrect: true, streak: 3, copy });
    const leakedIfNonSig = shareString({ puzzleNumber: 7, log, mode: 'prereg', callCorrect: false, streak: 3, copy });
    expect(leakedIfSig).not.toBe(leakedIfNonSig);
  });
});
