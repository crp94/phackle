// Master spec §2.2 (game flow state machine) + §2.10 (fork logging). Zustand
// VANILLA store: all logic lives here and is testable with a fake
// EngineClient + fake timers, no React involved. `useGameStore` at the
// bottom is a thin binding onto a singleton instance for app code.
import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand/react';
import type { EngineClient, RevealPayload } from '../engine/protocol';
import type { PathResult, PlayerAction, Spec, WindowN } from '../engine/types';
import { countForks, distinctExplored } from './forkLog';
import { practiceSeed, puzzleNumber } from './daily';
import { DEBOUNCE_MS, N_SCHEDULE } from './tuning';

export type Screen = 'briefing' | 'lab' | 'published' | 'call' | 'reveal' | 'summary';

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

export interface GameStore {
  screen: Screen;
  mode: 'hack' | 'prereg';
  practice: boolean;
  puzzleNumber: number;
  scenarioIndex: number;
  spec: Spec;
  result: PathResult | null;
  pending: boolean;
  n: WindowN;
  log: PlayerAction[];
  forks: number;
  published: Spec | null;
  call: 'real' | 'noise' | null;
  reveal: RevealPayload | null;
  error: string | null;

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
}

function initialState(): Omit<
  GameStore,
  'boot' | 'openData' | 'changeSpec' | 'peekAndExtend' | 'submit' | 'abandon' | 'makeCall' | 'finishReveal'
> {
  return {
    screen: 'briefing',
    mode: 'hack',
    practice: false,
    puzzleNumber: 0,
    scenarioIndex: 0,
    spec: DEFAULT_SPEC,
    result: null,
    pending: false,
    n: N_SCHEDULE[0],
    log: [],
    forks: 0,
    published: null,
    call: null,
    reveal: null,
    error: null,
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
        set({ scenarioIndex: info.scenarioIndex, n: info.n, puzzleNumber: puzzleNumber(iso) });

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
      return { pending: true, log, forks: countForks(log) };
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

const gameStore = createGameStore();

export function useGameStore<T>(selector: (state: GameStore) => T): T {
  return useStore(gameStore, selector);
}
