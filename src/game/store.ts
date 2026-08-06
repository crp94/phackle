// Master spec §2.2 (game flow state machine) + §2.10 (fork logging). Zustand
// VANILLA store: all logic lives here and is testable with a fake
// EngineClient + fake timers, no React involved. `useGameStore` at the
// bottom is a thin binding onto a singleton instance for app code.
import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand/react';
import type { EngineClient, RevealPayload } from '../engine/protocol';
import type { PathResult, PlayerAction, Spec, WindowN } from '../engine/types';
import { specKey } from '../engine/specGrid';
import { countForks, distinctExplored } from './forkLog';
import { practiceSeed, puzzleNumber } from './daily';
import { DEBOUNCE_MS, N_SCHEDULE } from './tuning';

// T18 addition (additive, not contradicting the brief's original six):
// 'prereg' is Prereg Mode's own screen — the preregistration form (§7.3).
// Reached from 'briefing' via chooseMode('prereg') instead of openData()'s
// 'lab'; see chooseMode/preregCommit below and src/ui/screens/Prereg.tsx.
export type Screen = 'briefing' | 'lab' | 'published' | 'call' | 'reveal' | 'summary' | 'prereg';

/** The free, un-hacked starting point (master spec §2.4 defaults). */
export const DEFAULT_SPEC: Spec = {
  outcome: 0,
  subgroup: 'all',
  covariates: { income: false, risk: false },
  exclusion: 'none',
  transform: 'raw',
  tails: 'two',
};

const MAX_N: WindowN = N_SCHEDULE[N_SCHEDULE.length - 1];

/**
 * gr6-107 — every guard's throw, by NAME.
 *
 * The tests that pinned these as literals (`rejects.toThrow('max N')`) were
 * coupled to prose they were never about: rewording a message for clarity
 * broke them, and `'max N'` was a substring loose enough that it did not even
 * identify its own throw uniquely. Exported so both sides — the throw and the
 * assertion — reference the same constant, which pins the IDENTITY of the
 * failure and leaves the wording free to improve.
 *
 * `as const` (not merely `Record<string, string>`) so each value is its own
 * literal type: a typo in a test's `STORE_ERR.notBooteed` is a compile error,
 * not a runtime `undefined` that `toThrow(undefined)` would happily accept.
 */
export const STORE_ERR = {
  notBooted: 'not booted',
  openFromBriefing: 'can only open the data from the briefing',
  changeSpecFromLab: 'can only change the spec from the lab',
  peekFromLab: 'can only collect more data from the lab',
  noResult: 'no result visible to extend',
  maxN: 'the sample window is already at its maximum',
  submitFromLab: 'can only submit from the lab',
  cannotSubmit: 'cannot submit: no settled, valid, significant result',
  abandonFromLab: 'can only abandon from the lab',
  cannotCall: 'cannot call: nothing published or abandoned yet, or a reveal is already in flight',
  chooseModeFromBriefing: 'can only choose a mode from the briefing',
  cannotPrereg: 'can only commit a preregistration once, from the prereg screen, in prereg mode',
} as const;

/** T30: one entry per settled spec whose result was ACTUALLY displayed to
 * the player — captured the moment it's superseded by the next settled spec
 * (see `commitSettledSpec`'s own `seenPrev` check below, which this reuses
 * exactly: an entry is only pushed when a result had genuinely rendered for
 * the spec being replaced, never for one still `pending`). `key` is the
 * canonical, N-independent spec-shape key (`engine/specGrid.ts`'s own
 * `specKey` — already used by the reveal/curve pipeline for exactly this
 * "same spec, regardless of sample size" notion). Feeds
 * `dayComplete.ts`'s `computeDecisiveTails` (§2.11 "The One-Tailed Bandit"):
 * was the SAME spec, two-tailed, ever seen non-significant before the player
 * flipped it to one-tailed and published? Additive-only: entries are never
 * pruned within a day; the whole array is reset to `[]` only by `boot()` (a
 * fresh puzzle day), same as `log`/`forks`. */
export interface ResultLogEntry {
  key: string;
  p: number;
  valid: boolean;
}

export interface GameStore {
  screen: Screen;
  mode: 'hack' | 'prereg';
  practice: boolean;
  puzzleNumber: number;
  /** The ISO date `boot()` was called with — the puzzle's OWN day. Empty
   * string until boot() completes. Distinct, deliberately, from whatever
   * `localIsoDate()` (a live wall-clock read) returns at some LATER moment —
   * e.g. after the player has sat on a nav page (Stats/Legend/About) past a
   * real midnight rollover. Summary's persistence (T17 review round 2)
   * anchors to THIS field, never to the wall clock, so that a
   * finish-before-midnight / re-render-after-midnight straddle can never
   * key a save under the wrong day. */
  iso: string;
  /** T40 (FINDING F2): true once boot() has FIXED today's day — `iso`,
   * `scenarioIndex` and `puzzleNumber` all correct — set inside the very
   * same `set()` call as those three, never before and never separately.
   * False from `initialState()` and reset to false at the top of every
   * `boot()` (via the `{ ...initialState() }` spread there), same as `iso`.
   * This is the UI's boot gate (App.tsx): not `iso !== ''` (a byte-string
   * whose emptiness is incidental to its type, not its meaning) and
   * absolutely not `scenarioIndex !== 0` (scenario #0 is a real, playable
   * scenario one day in twenty — the T23 report measured the bug this
   * field exists to close by proving the Briefing rendered scenario #0's
   * question, cover story and Grantwell email BEFORE the worker had
   * finished assembling the real day, for 74-117ms on a fast desktop and
   * longer on a phone). A crash during `client.init()` (caught below) never
   * sets this true — the day was never actually fixed — so a booting
   * failure is read off `error`, not off a `booted` that lied. */
  booted: boolean;
  scenarioIndex: number;
  spec: Spec;
  result: PathResult | null;
  pending: boolean;
  n: WindowN;
  log: PlayerAction[];
  forks: number;
  /** See `ResultLogEntry`'s own doc comment (T30). */
  resultLog: ResultLogEntry[];
  published: Spec | null;
  call: 'real' | 'noise' | null;
  reveal: RevealPayload | null;
  error: string | null;
  /** T18: the committed spec's OWN N=400 PathResult, set exactly once, by
   * preregCommit() below — never by anything Hacking Mode touches (`result`
   * above stays the field Lab reads/writes; this is deliberately a SEPARATE
   * field rather than a reuse of `result`, so a prereg day's significance
   * signal can never be confused with whatever Lab last happened to leave in
   * `result`, even though in practice Lab never mounts on a prereg day at
   * all — see Prereg.tsx). Reset to null by every boot() (a fresh puzzle
   * day), same as `log`/`forks`/`resultLog`. Summary.tsx's
   * persistAndComputeSummary reads this directly to compute the REAL
   * `preregSig` signal (`preregResult.valid && preregResult.p < 0.05`),
   * replacing T17's documented `stamp !== 'NULL_REPORTED'` approximation. */
  preregResult: PathResult | null;

  /** Initializes the engine for `iso`'s puzzle and prefetches the default
   * spec's result, but stays on 'briefing' (§2.3: "Open the data" is a player
   * CTA, not automatic) — the prefetch just means the lab has a result ready
   * to show the instant the player opens it. */
  boot(
    client: EngineClient,
    iso: string,
    opts: { practice: boolean; mode: 'hack' | 'prereg'; scenarioCount: number },
  ): Promise<void>;
  /** The briefing's "Open the data" CTA (§2.3): pure navigation from
   * 'briefing' to 'lab' — no log entry, no fork implications. Guarded to
   * only fire from 'briefing'. */
  openData(): void;
  /** Debounced DEBOUNCE_MS; only the settled spec reaches runSpec + the log
   * (§2.10: rapid multi-knob changes before results render count once).
   * Guarded to only fire from 'lab'. */
  changeSpec(next: Spec): void;
  /** "Collect 50 more" — guarded to only fire from 'lab', and only while a
   * rendered result is visible there. */
  peekAndExtend(): Promise<void>;
  /** SUBMIT TO JOURNAL — guarded to only fire from 'lab', on a settled,
   * valid, significant result. */
  submit(): Promise<void>;
  /** "Report a null result" — from the lab, any time. */
  abandon(): Promise<void>;
  /** The call modal's verdict — valid once published or abandoned. */
  makeCall(v: 'real' | 'noise'): Promise<void>;
  finishReveal(): void;
  /** T18: the briefing's mode chooser (§2.2 "prereg unlocked: choose mode
   * first"), visible only once achievements.first_retraction exists.
   * Guarded to only fire from 'briefing' (mirrors openData's own guard).
   * 'prereg' is the only value the real UI ever passes (Prereg.tsx's screen
   * is reached ONLY this way, never via openData) — the Briefing chooser's
   * OWN "hacking mode" option calls the existing, already-tested openData()
   * instead, since mode is already 'hack' by construction (boot()'s opts);
   * 'hack' is accepted here too, for a symmetric, fully general primitive,
   * and is exactly equivalent to openData() (mode was already 'hack'). */
  chooseMode(mode: 'hack' | 'prereg'): void;
  /** T18 (§2.6/§7.3/§2.8) — Prereg Mode's one irreversible action. Guarded to
   * screen==='prereg' && mode==='prereg' && !pending (the last conjunct
   * closes the reentrancy window a bare screen-guard would leave open: screen
   * does not flip to 'reveal' until this whole async sequence finishes, so a
   * second call while the first is still in flight would otherwise pass —
   * exactly peekAndExtend's own `s.pending` reentrancy guard, reused here for
   * the same reason). `spec` has never had a result shown for it (Prereg.tsx
   * manages it as pure local component state, never store.spec/changeSpec,
   * which is itself guarded to 'lab' only). Runs it EXACTLY once, at N=400 —
   * see the implementation's own doc comment for why four extend() calls,
   * not a protocol change, get there — then fetches the reveal (published =
   * spec, explored = [spec], per the controller's own pin) and lands on
   * 'reveal'. No CALL screen is ever visited in this path (§2.8: the prereg
   * score rows replace the call entirely). */
  preregCommit(spec: Spec): Promise<void>;
}

function initialState(): Omit<
  GameStore,
  | 'boot'
  | 'openData'
  | 'changeSpec'
  | 'peekAndExtend'
  | 'submit'
  | 'abandon'
  | 'makeCall'
  | 'finishReveal'
  | 'chooseMode'
  | 'preregCommit'
> {
  return {
    screen: 'briefing',
    mode: 'hack',
    practice: false,
    puzzleNumber: 0,
    iso: '',
    booted: false,
    scenarioIndex: 0,
    spec: DEFAULT_SPEC,
    result: null,
    pending: false,
    n: N_SCHEDULE[0],
    log: [],
    forks: 0,
    resultLog: [],
    published: null,
    call: null,
    reveal: null,
    error: null,
    preregResult: null,
  };
}

export function createGameStore() {
  // Bound to this store instance via closure (not store state — see brief:
  // only `boot` takes a client; every other action reaches it this way).
  let client: EngineClient | null = null;
  let debounceHandle: ReturnType<typeof setTimeout> | null = null;
  // Shared sequence number across changeSpec/peekAndExtend/boot: whichever
  // runSpec-triggering call is dispatched LAST "owns" the next state update;
  // any earlier call's response that resolves afterward is stale and
  // discarded on arrival ("last-write-wins by request ordering").
  let requestSeq = 0;

  function clearDebounce(): void {
    if (debounceHandle !== null) {
      clearTimeout(debounceHandle);
      debounceHandle = null;
    }
  }

  /**
   * gr6-043 — the ONE error path every awaiting action shares.
   *
   * Before this, only `boot` and `commitSettledSpec` caught anything at all,
   * so a rejected RPC anywhere else left `pending: true` forever and lit no
   * error surface: Prereg Mode became a hard dead-end for the whole day
   * (`preregCommit`'s own `|| s.pending` guard then rejected every retry),
   * the Lab's Collect and Submit both died (`canCollectMore`/`canSubmit` are
   * both false while pending), and the dial sat at `aria-busy` until reload.
   *
   * Two properties, and both matter:
   *   - `pending: false` — whatever failed, the day is playable again.
   *   - the staleness check — a rejection that arrives AFTER a newer request
   *     has taken ownership of the state (a fresh `boot()`, a later settled
   *     spec) is discarded rather than surfaced, exactly as its resolved
   *     counterpart already is. Otherwise a superseded failure would paint an
   *     error banner over a day it no longer describes.
   *
   * The error itself lands in `error`, which ScreenRouter already renders as
   * `errors.workerCrash` above whatever screen is current — no screen is ever
   * replaced, so the player keeps whatever they were looking at.
   *
   * ITS OTHER HALF (review fix round 1, w6-r-002): every dispatch site pairs
   * `pending: true` with `error: null`. `error` had exactly one writer that
   * ever cleared it — `boot`, via its `initialState()` spread — so the FIRST
   * failure of a session made it permanently non-null, and two things broke
   * downstream. The crash banner outlived the crash, sitting over a day that
   * had since recovered. And Prereg.tsx's freeze-release reads
   * `submitting && error === null`, so after any earlier failure the form
   * never froze again: a mode whose entire premise is irreversible commitment
   * rendered an unlocked, re-submittable form while its own commit was in
   * flight. An attempt owns the error surface it is about to write; clearing
   * is not swallowing, since a retry that fails again writes its own message
   * through this same catch.
   */
  async function withEngineErrors(myReq: number, fn: () => Promise<void>): Promise<void> {
    try {
      await fn();
    } catch (err) {
      if (myReq !== requestSeq) return;
      store.setState({ pending: false, error: err instanceof Error ? err.message : String(err) });
    }
  }

  const store = createStore<GameStore>()((set, get) => ({
    ...initialState(),

    async boot(c, iso, opts) {
      client = c;
      clearDebounce();
      // One sequence number for the whole boot: it invalidates anything left
      // over from a prior boot AND owns every request this one dispatches, so
      // a superseded boot's init/runSpec/rejection are all discarded on the
      // same test (gr6-043 folded the two increments this used to take into
      // one, which is what lets withEngineErrors below judge staleness).
      const myReq = ++requestSeq;
      set({ ...initialState(), mode: opts.mode, practice: opts.practice });
      c.onCrash(() => set({ error: 'engine crashed' }));
      await withEngineErrors(myReq, async () => {
        const seed = opts.practice ? practiceSeed() : undefined;
        const info = await c.init(iso, opts.scenarioCount, seed);
        if (myReq !== requestSeq) return; // superseded by a newer boot — discard
        // `booted: true` lands in this SAME set() call, deliberately — see
        // the field's own doc comment. It marks the exact instant the day
        // is fixed, not some later moment (the prefetch below still has to
        // run, but the UI's boot gate does not need to wait out a whole
        // extra runSpec round trip once the scenario/date are already
        // correct).
        set({ scenarioIndex: info.scenarioIndex, n: info.n, puzzleNumber: puzzleNumber(iso), iso, booted: true });

        set({ pending: true });
        const result = await c.runSpec(DEFAULT_SPEC);
        if (myReq !== requestSeq) return; // superseded mid-boot — discard

        const at = Date.now();
        set((s) => {
          // Initial default spec is free (§2.10) — logged so distinctExplored
          // / the fork trail have a first entry, but never itself a fork.
          // screen stays 'briefing': prefetching is intentional, but landing
          // on 'lab' is the player's own doing via openData() (§2.3).
          const log: PlayerAction[] = [...s.log, { t: 'VIEW_SPEC', spec: DEFAULT_SPEC, seen: false, at }];
          return { spec: DEFAULT_SPEC, result, pending: false, log, forks: countForks(log) };
        });
      });
    },

    openData() {
      if (get().screen !== 'briefing') throw new Error(STORE_ERR.openFromBriefing);
      set({ screen: 'lab' });
    },

    changeSpec(next) {
      if (get().screen !== 'lab') throw new Error(STORE_ERR.changeSpecFromLab);
      // The visible control state updates immediately; only the debounced
      // runSpec dispatch + VIEW_SPEC log entry wait out DEBOUNCE_MS.
      set({ spec: next });
      clearDebounce();
      debounceHandle = setTimeout(() => {
        debounceHandle = null;
        void commitSettledSpec(next);
      }, DEBOUNCE_MS);
    },

    async peekAndExtend() {
      const c = client;
      if (!c) throw new Error(STORE_ERR.notBooted);
      const s = get();
      if (s.screen !== 'lab') throw new Error(STORE_ERR.peekFromLab);
      if (s.pending || !s.result) throw new Error(STORE_ERR.noResult);
      if (s.n === MAX_N) throw new Error(STORE_ERR.maxN);

      clearDebounce();
      const myReq = ++requestSeq;
      set({ pending: true, error: null }); // w6-r-002 — see withEngineErrors
      await withEngineErrors(myReq, async () => {
        const info = await c.extend();
        if (myReq !== requestSeq) return;

        const at = Date.now();
        set((st) => {
          const log: PlayerAction[] = [...st.log, { t: 'PEEK_AND_EXTEND', newN: info.n, at }];
          return { n: info.n, log, forks: countForks(log) };
        });

        const result = await c.runSpec(get().spec);
        if (myReq !== requestSeq) return;
        set({ result, pending: false });
      });
    },

    async submit() {
      const s = get();
      if (s.screen !== 'lab') throw new Error(STORE_ERR.submitFromLab);
      if (!(s.result && s.result.valid && s.result.p < 0.05 && !s.pending)) {
        throw new Error(STORE_ERR.cannotSubmit);
      }
      clearDebounce();
      requestSeq++; // invalidate any in-flight request — we're leaving the lab
      const at = Date.now();
      const p = s.result.p;
      set((st) => {
        const log: PlayerAction[] = [...st.log, { t: 'SUBMIT', spec: st.spec, p, at }];
        return { log, forks: countForks(log), published: st.spec, screen: 'published' as Screen };
      });
    },

    async abandon() {
      const s = get();
      if (s.screen !== 'lab') throw new Error(STORE_ERR.abandonFromLab);
      clearDebounce();
      requestSeq++; // invalidate any in-flight request — we're leaving the lab
      const at = Date.now();
      set((st) => {
        const log: PlayerAction[] = [...st.log, { t: 'ABANDON', at }];
        // gr6-042 (lm-09): `pending: false` in the SAME commit that leaves
        // the lab. `requestSeq++` above orphans whatever runSpec was in
        // flight — nothing will ever clear the flag it left behind — and a
        // `pending` that stays true past this point is not merely untidy:
        // makeCall's own in-flight conjunct (below) would then reject the
        // very call this screen exists to collect. Submit has no such line
        // because its own guard already refuses to fire while pending.
        return { log, forks: countForks(log), published: null, pending: false, screen: 'call' as Screen };
      });
    },

    async makeCall(v) {
      const c = client;
      if (!c) throw new Error(STORE_ERR.notBooted);
      const s = get();
      // gr6-042: the sibling shape, which this action alone was missing. The
      // `|| s.pending` conjunct is preregCommit's own reentrancy guard, here
      // for the same reason: `screen` does not flip to 'reveal' until the
      // whole async sequence finishes, so a second dispatch while the first
      // is still in flight would otherwise sail past a bare screen check.
      // REACHABLE, not theoretical — Call.tsx's double-tap guard is a ref on
      // a component Published.tsx unmounts on Escape, so "It's real" ->
      // Escape -> "Face the truth" gave a fresh ref, a second CALL entry and
      // a second (very expensive) reveal RPC, all on a screen still reading
      // 'published'.
      if ((s.screen !== 'published' && s.screen !== 'call') || s.pending) {
        throw new Error(STORE_ERR.cannotCall);
      }
      const myReq = ++requestSeq;
      // CALL entries contribute nothing to distinctExplored (it reads
      // VIEW_SPEC only), so computing this from the pre-append log is exactly
      // what the post-append read used to produce.
      const explored = distinctExplored(s.log);
      const published = s.published;
      set({ pending: true, error: null }); // w6-r-002 — see withEngineErrors
      await withEngineErrors(myReq, async () => {
        const payload = await c.reveal(published, explored);
        if (myReq !== requestSeq) return;
        const at = Date.now();
        set((st) => {
          // gr6-079: the CALL append lands in the SAME set() as `reveal` and
          // `screen`, so the action is atomic. Appending it BEFORE the await
          // meant a failed reveal left the verdict recorded on a screen that
          // never advanced, and every retry stacked another CALL entry onto
          // the log.
          const log: PlayerAction[] = [...st.log, { t: 'CALL', verdict: v, at }];
          return {
            log,
            forks: countForks(log),
            call: v,
            reveal: payload,
            pending: false,
            screen: 'reveal' as Screen,
          };
        });
      });
    },

    finishReveal() {
      set({ screen: 'summary' });
    },

    chooseMode(mode) {
      if (get().screen !== 'briefing') throw new Error(STORE_ERR.chooseModeFromBriefing);
      set({ mode, screen: mode === 'prereg' ? 'prereg' : 'lab' });
    },

    async preregCommit(spec) {
      const c = client;
      if (!c) throw new Error(STORE_ERR.notBooted);
      const s = get();
      if (s.screen !== 'prereg' || s.mode !== 'prereg' || s.pending) {
        throw new Error(STORE_ERR.cannotPrereg);
      }
      clearDebounce();
      const myReq = ++requestSeq;
      // w6-r-002: load-bearing HERE above all — Prereg.tsx's `frozen` reads
      // exactly this pair, and a stale error left the form unlocked mid-commit.
      set({ pending: true, error: null });

      await withEngineErrors(myReq, async () => {
        // §3.8's window schedule only ever moves one N_SCHEDULE step per
        // extend() (engine/protocol.ts's handleRequest 'extend' branch) —
        // there is no "jump straight to N=400" op, and adding one is outside
        // this task's ownership (protocol.ts/worker.ts). So the full window
        // is reached with exactly N_SCHEDULE.length - 1 extend() calls, and
        // deliberately NO runSpec dispatched in between (unlike
        // peekAndExtend, which re-runs the CURRENT spec after every extend to
        // show a live update): the whole point of a preregistered commitment
        // is that NOTHING is ever run, let alone shown, before this one call.
        let n: WindowN = s.n;
        for (let i = 1; i < N_SCHEDULE.length; i++) {
          const info = await c.extend();
          if (myReq !== requestSeq) return; // superseded (e.g. a fresh boot) mid-sequence
          n = info.n;
        }

        const result = await c.runSpec(spec);
        if (myReq !== requestSeq) return;

        const payload = await c.reveal(spec, [spec]);
        if (myReq !== requestSeq) return;

        // The engine's own verdictStamp (src/engine/reveal.ts) assumes
        // "published !== null" already implies "was significant" — true for
        // Hacking Mode, where submit() is guarded to only ever fire at p<.05,
        // but NOT true here: a preregistered commit is unconditional. A
        // non-significant commit must read NULL_REPORTED regardless of what
        // the engine's stamp says (it has no way to know); a significant one
        // keeps the engine's own REPLICATED/RETRACTED call verbatim — it
        // already encodes "did this land on the true outcome" (§2.7.4), which
        // does not need re-deriving here.
        const sig = result.valid && result.p < 0.05;
        const corrected: RevealPayload = {
          ...payload,
          stamp: sig ? payload.stamp : 'NULL_REPORTED',
          // The N_SCHEDULE.length - 1 extends above bumped the worker's
          // internal peek counter as a mechanical side effect of reaching
          // full power in one shot — never player "peeking" (there is nothing
          // to peek AT: no result is ever shown before commit). Left as the
          // engine reported it, Reveal's peekSurcharge line would accuse the
          // player of exactly the behavior preregistration exists to prevent.
          peeks: 0,
        };

        const at = Date.now();
        set((st) => {
          // The committed spec's own viewing, logged for completeness (§2.10's
          // "initial default spec is free" rule already covers boot's own
          // entry above this one) — `seen: false` because nothing was ever
          // seen: no result renders anywhere in the prereg screen (Prereg.tsx
          // shows no PValueDial/CoefPlot), so this NEVER counts as a fork,
          // matching the fact that preregistration has no forks by
          // construction (there is nothing to change your mind in response
          // to).
          const log: PlayerAction[] = [...st.log, { t: 'VIEW_SPEC', spec, seen: false, at }];
          return {
            spec,
            n,
            result,
            preregResult: result,
            pending: false,
            log,
            forks: countForks(log),
            published: spec,
            reveal: corrected,
            screen: 'reveal' as Screen,
          };
        });
      });
    },
  }));

  async function commitSettledSpec(settled: Spec): Promise<void> {
    const c = client;
    if (!c) return;
    const s = store.getState();
    // Captured BEFORE this request is marked pending: "was a result displayed
    // for the previous spec" at the instant this change settles (§2.10).
    const seenPrev = !s.pending && s.result !== null;
    const myReq = ++requestSeq;
    const at = Date.now();
    store.setState((st) => {
      const log: PlayerAction[] = [...st.log, { t: 'VIEW_SPEC', spec: settled, seen: seenPrev, at }];
      const forks = countForks(log);
      // T30: durably record the OUTGOING result, but only if `seenPrev` says
      // it had genuinely rendered. Keyed by `st.result.spec` — the spec the
      // CURRENT result actually belongs to — never `st.spec`: `changeSpec`
      // updates the visible control spec synchronously, well before this
      // debounced commit runs, so by the time we get here `st.spec` may
      // already be `settled` (or something later still, per the "three rapid
      // changes" collapse) while `st.result` still holds the PREVIOUS spec's
      // data, tagged with its own `.spec` field (PathResult carries this
      // itself — see engine/types.ts).
      if (seenPrev && st.result) {
        const resultLog: ResultLogEntry[] = [
          ...st.resultLog,
          { key: specKey(st.result.spec), p: st.result.p, valid: st.result.valid },
        ];
        return { pending: true, error: null, log, forks, resultLog }; // w6-r-002
      }
      return { pending: true, error: null, log, forks }; // w6-r-002
    });
    // The fifth and last site of the same shape (gr6-043): this one always
    // had its own try/catch — the helper is that catch, hoisted so the four
    // actions above cannot drift away from it.
    await withEngineErrors(myReq, async () => {
      const result = await c.runSpec(settled);
      if (myReq !== requestSeq) return; // stale — a newer change has since settled
      store.setState({ result, pending: false });
    });
  }

  return store;
}

// --- React binding (thin; all logic above is framework-free) --------------

// Exported (beyond the brief's original useGameStore-only surface) — T14's
// screen-router glue (ScreenRouter/App.tsx boot wiring) and its tests need
// the vanilla store's own getState()/setState()/subscribe() to drive
// boot()/openData()/etc. from outside a component and to register the crash
// path, exactly the way tests/game/store.test.ts already does via
// createGameStore() for a FRESH instance. This is the SAME singleton
// `useGameStore` was already bound to; nothing about useGameStore's own
// behavior changes.
export const gameStore = createGameStore();

/**
 * The INJECTABLE store-hook seam every standalone screen takes as a prop
 * (`useStore?: UseGameStore`, defaulting to `useGameStore` below), so a test
 * can seed an isolated `createGameStore()` instance instead of mutating the
 * real singleton three suites are simultaneously reading.
 *
 * gr6-082: declared twice, character-identical, in Briefing.tsx and
 * Published.tsx — with Prereg.tsx importing it screen-to-screen from
 * Briefing, which made a presentational sibling a dependency of an unrelated
 * one. It belongs next to the store it selects from. The SEAM itself stays
 * exactly as it was: this is a type move, not a wiring change.
 */
export type UseGameStore = <T>(selector: (state: GameStore) => T) => T;

export function useGameStore<T>(selector: (state: GameStore) => T): T {
  return useStore(gameStore, selector);
}
