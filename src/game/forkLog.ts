// Master spec §2.10 — fork logging, exact rule. Pure functions only: no
// engine/store side effects, no wall clock — testable in complete isolation.
import type { PlayerAction, Spec } from '../engine/types';

export type ForkKind = 'subgroup' | 'exclusion' | 'tails' | 'spec' | 'peek';

/**
 * Classifies a settled spec change by which knob(s) differ, using the §2.9
 * emoji-legend priority when several knobs change in the same settled
 * (debounce-collapsed) update: subgroup (🎯) > exclusion (🔪) > tails (🌗) >
 * spec (🍴 — outcome/covariates/transform). Assumes prev !== next in some
 * field; if called with structurally-equal specs it falls through to 'spec'.
 */
export function classifyChange(prev: Spec, next: Spec): ForkKind {
  if (prev.subgroup !== next.subgroup) return 'subgroup';
  if (prev.exclusion !== next.exclusion) return 'exclusion';
  if (prev.tails !== next.tails) return 'tails';
  return 'spec';
}

/**
 * §2.10, exact rule: "A fork is counted when the player changes the
 * specification after having seen a result for the previous one." Each
 * VIEW_SPEC entry's own `seen` flag records exactly that fact — whether a
 * result had rendered for the spec it replaces — so a VIEW_SPEC entry counts
 * iff `seen === true`, EXCEPT the very first VIEW_SPEC entry in the whole
 * log, which is always free ("the initial default spec is free"), regardless
 * of its own `seen` value. PEEK_AND_EXTEND always counts. All other action
 * types (SUBMIT/ABANDON/CALL) never contribute.
 */
export function countForks(log: PlayerAction[]): number {
  let forks = 0;
  let sawFirstView = false;
  for (const action of log) {
    if (action.t === 'VIEW_SPEC') {
      if (sawFirstView) {
        if (action.seen) forks++;
      } else {
        sawFirstView = true;
      }
    } else if (action.t === 'PEEK_AND_EXTEND') {
      forks++;
    }
  }
  return forks;
}

// Canonical, construction-order-independent string key for a Spec (a tuple
// encoding, not raw JSON.stringify(spec), so field-insertion order can never
// cause two structurally-equal specs to hash differently). T8 (spec-curve
// enumeration) owns the "real" specKey and hasn't merged into build/v1 yet;
// this local helper is a stand-in that T8's shared implementation may replace.
function specKey(spec: Spec): string {
  return JSON.stringify([
    spec.outcome,
    spec.subgroup,
    spec.covariates.income,
    spec.covariates.risk,
    spec.exclusion,
    spec.transform,
    spec.tails,
  ]);
}

/**
 * Distinct specs viewed, in order of first view (§2.10: "k = distinct specs
 * viewed" — the reveal's "you explored k paths" figure). Dedupes by
 * specKey; ignores every non-VIEW_SPEC log entry.
 */
export function distinctExplored(log: PlayerAction[]): Spec[] {
  const seen = new Set<string>();
  const out: Spec[] = [];
  for (const action of log) {
    if (action.t !== 'VIEW_SPEC') continue;
    const key = specKey(action.spec);
    if (!seen.has(key)) {
      seen.add(key);
      out.push(action.spec);
    }
  }
  return out;
}
