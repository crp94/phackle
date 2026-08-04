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

  const store = createStore<GameStore>()((set, get) => ({
    ...initialState(),

    async boot(c, iso, opts) {
      client = c;
      clearDebounce();
      requestSeq++; // invalidate anything left over from a prior boot
      set({ ...initialState(), mode: opts.mode, practice: opts.practice });
      client.onCrash(() => set({ error: 'engine crashed' }));
      try {
        const seed = opts.practice ? practiceSeed() : undefined;
        const info = await client.init(iso, opts.scenarioCount, seed);
        // `booted: true` lands in this SAME set() call, deliberately — see
        // the field's own doc comment. It marks the exact instant the day
        // is fixed, not some later moment (the prefetch below still has to
        // run, but the UI's boot gate does not need to wait out a whole
        // extra runSpec round trip once the scenario/date are already
        // correct).
        set({ scenarioIndex: info.scenarioIndex, n: info.n, puzzleNumber: puzzleNumber(iso), iso, booted: true });

        const myReq = ++requestSeq;
        set({ pending: true });
        const result = await client.runSpec(DEFAULT_SPEC);
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
      } catch (err) {
        set({ pending: false, error: err instanceof Error ? err.message : String(err) });
      }
    },

    openData() {
      if (get().screen !== 'briefing') throw new Error('can only open the data from the briefing');
      set({ screen: 'lab' });
    },

    changeSpec(next) {
      if (get().screen !== 'lab') throw new Error('can only change the spec from the lab');
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
      if (!client) throw new Error('not booted');
      const s = get();
      if (s.screen !== 'lab') throw new Error('can only collect more data from the lab');
      if (s.pending || !s.result) throw new Error('no result visible to extend');
      if (s.n === MAX_N) throw new Error('max N');

      clearDebounce();
      const myReq = ++requestSeq;
      set({ pending: true });
      const info = await client.extend();
      if (myReq !== requestSeq) return;

      const at = Date.now();
      set((st) => {
        const log: PlayerAction[] = [...st.log, { t: 'PEEK_AND_EXTEND', newN: info.n, at }];
        return { n: info.n, log, forks: countForks(log) };
      });

      const result = await client.runSpec(get().spec);
      if (myReq !== requestSeq) return;
      set({ result, pending: false });
    },

    async submit() {
      const s = get();
      if (s.screen !== 'lab') throw new Error('can only submit from the lab');
      if (!(s.result && s.result.valid && s.result.p < 0.05 && !s.pending)) {
        throw new Error('cannot submit: no settled, valid, significant result');
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
      if (s.screen !== 'lab') throw new Error('can only abandon from the lab');
      clearDebounce();
      requestSeq++; // invalidate any in-flight request — we're leaving the lab
      const at = Date.now();
      set((st) => {
        const log: PlayerAction[] = [...st.log, { t: 'ABANDON', at }];
        return { log, forks: countForks(log), published: null, screen: 'call' as Screen };
      });
    },

    async makeCall(v) {
      if (!client) throw new Error('not booted');
      const s = get();
      if (s.screen !== 'published' && s.screen !== 'call') {
        throw new Error('cannot call before publishing or abandoning');
      }
      const at = Date.now();
      set((st) => {
        const log: PlayerAction[] = [...st.log, { t: 'CALL', verdict: v, at }];
        return { log, forks: countForks(log), call: v };
      });
      const explored = distinctExplored(get().log);
      const payload = await client.reveal(get().published, explored);
      set({ reveal: payload, screen: 'reveal' });
    },

    finishReveal() {
      set({ screen: 'summary' });
    },

    chooseMode(mode) {
      if (get().screen !== 'briefing') throw new Error('can only choose a mode from the briefing');
      set({ mode, screen: mode === 'prereg' ? 'prereg' : 'lab' });
    },

    async preregCommit(spec) {
      if (!client) throw new Error('not booted');
      const s = get();
      if (s.screen !== 'prereg' || s.mode !== 'prereg' || s.pending) {
        throw new Error('can only commit a preregistration once, from the prereg screen, in prereg mode');
      }
      clearDebounce();
      const myReq = ++requestSeq;
      set({ pending: true });

      // §3.8's window schedule only ever moves one N_SCHEDULE step per
      // extend() (engine/protocol.ts's handleRequest 'extend' branch) — there
      // is no "jump straight to N=400" op, and adding one is outside this
      // task's ownership (protocol.ts/worker.ts). So the full window is
      // reached with exactly N_SCHEDULE.length - 1 extend() calls, and
      // deliberately NO runSpec dispatched in between (unlike peekAndExtend,
      // which re-runs the CURRENT spec after every extend to show a live
      // update): the whole point of a preregistered commitment is that
      // NOTHING is ever run, let alone shown, before this one call.
      let n: WindowN = s.n;
      for (let i = 1; i < N_SCHEDULE.length; i++) {
        const info = await client.extend();
        if (myReq !== requestSeq) return; // superseded (e.g. a fresh boot) mid-sequence
        n = info.n;
      }

      const result = await client.runSpec(spec);
      if (myReq !== requestSeq) return;

      const payload = await client.reveal(spec, [spec]);
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
        // internal peek counter as a mechanical side effect of reaching full
        // power in one shot — never player "peeking" (there is nothing to
        // peek AT: no result is ever shown before commit). Left as the
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
    },
  }));

  async function commitSettledSpec(settled: Spec): Promise<void> {
    if (!client) return;
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
        return { pending: true, log, forks, resultLog };
      }
      return { pending: true, log, forks };
    });
    try {
      const result = await client.runSpec(settled);
      if (myReq !== requestSeq) return; // stale — a newer change has since settled
      store.setState({ result, pending: false });
    } catch (err) {
      if (myReq !== requestSeq) return;
      store.setState({ pending: false, error: err instanceof Error ? err.message : String(err) });
    }
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

export function useGameStore<T>(selector: (state: GameStore) => T): T {
  return useStore(gameStore, selector);
}
