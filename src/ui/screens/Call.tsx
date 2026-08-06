// THE CALL — master spec §2.6, §7.3 "Call". The skill moment, and the last
// beat of Act I: the game asks, conspiratorially, what the player thinks they
// actually found, and only then goes and looks.
//
// Container-agnostic on purpose. This renders the dialog and nothing around
// it, so it works BOTH as the 'call' screen (the abandon path, where it is
// the whole page) and as the Published screen's overlay child (§7.3's "modal
// over dimmed cover"). The dim, the backdrop and the focus trap belong to
// whichever container mounts it; the questions belong here.
//
// The one invariant this file exists to protect: `makeCall` is the FIRST
// thing in the app that ever asks the worker for the truth (store.makeCall ->
// client.reveal). Nothing here prefetches, warms, or peeks -- see
// tests/ui/call.test.tsx's spoiler-safety suite.
import { useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useLocale } from '../../i18n/LocaleProvider';
import { useGameStore } from '../../game/store';
import './Call.css';

type Verdict = 'real' | 'noise';

/**
 * gr6-015 — the prompt's id is a CONSTANT, not `useId()`, because a second
 * element now has to point at it from outside this component: Published's
 * overlay names itself with `aria-labelledby={CALL_PROMPT_ID}` so the dialog
 * is announced by its own question ("Is this finding real?") instead of by
 * the ellipsis eyebrow it used to borrow ("Before you see the reveal…").
 *
 * Safe as a literal because this component is rendered AT MOST ONCE in the
 * document: it is either the standalone 'call' screen (the abandon path) or
 * Published's overlay child, never both — the `screen !== 'published' &&
 * screen !== 'call'` guard below is what makes that true, and the store's
 * `screen` is a single value. A `useId()` cannot be reached from Published
 * without hoisting state the seam does not have.
 */
export const CALL_PROMPT_ID = 'ph-call-prompt';

export function Call() {
  const { content, t } = useLocale();
  const screen = useGameStore((s) => s.screen);
  const makeCall = useGameStore((s) => s.makeCall);
  const promptId = CALL_PROMPT_ID;

  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  // A ref, not the state below: two clicks inside one React batch would both
  // see `busy === false` if the guard were state, and fire two reveal RPCs.
  const inFlight = useRef(false);
  const [busy, setBusy] = useState(false);

  // The call is only offered once the day is over one way or the other
  // (§2.6: "Players who abandoned also make the call"). The store enforces
  // the same rule; this keeps the component from rendering a dialog whose
  // buttons would throw.
  if (!content) return null;
  if (screen !== 'published' && screen !== 'call') return null;

  function choose(verdict: Verdict) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    void makeCall(verdict).catch(() => {
      // Leaving the buttons dead after a failed RPC would strand the player
      // on a screen with no way forward; the error surface itself is the
      // shell's job (errors.workerCrash), not this dialog's.
      inFlight.current = false;
      setBusy(false);
    });
  }

  function onKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0;
    if (step === 0) return;
    event.preventDefault();
    const current = buttons.current.findIndex((node) => node === document.activeElement);
    const next = (current + step + buttons.current.length) % buttons.current.length;
    buttons.current[next]?.focus();
  }

  const options: { verdict: Verdict; title: string; sub: string }[] = [
    { verdict: 'real', title: t('call.real'), sub: t('call.realSub') },
    { verdict: 'noise', title: t('call.noise'), sub: t('call.noiseSub') },
  ];

  // gr6-015 — NO `role="dialog"` here, in either container, and that is a
  // correction rather than a simplification. As the standalone 'call' SCREEN
  // this element is the whole page: a dialog is by definition a window over
  // something else, and there is nothing behind it and nothing to dismiss it
  // back to. As Published's overlay CHILD it produced a dialog INSIDE a
  // dialog — `.ph-call-overlay` already carries role="dialog" + aria-modal +
  // the focus trap — so assistive technology announced two nested dialogs for
  // one question. The name moved up with the role: the overlay is now
  // labelled by this prompt's own id (CALL_PROMPT_ID above), which is the
  // question itself rather than the ellipsis eyebrow it used to borrow.
  // `aria-labelledby` stays here as well, where it now names a plain
  // <section> — a named region, which is exactly what this is on the
  // abandon path.
  return (
    <section className="ph-call" aria-labelledby={promptId}>
      <p className="ph-call__eyebrow">{t('call.title')}</p>
      {/* T22: <h1>. The prompt is this screen's title in both of the two
          containers it is rendered in. As the standalone 'call' screen (the
          abandon path) it is the only heading on the page. As Published's
          overlay child it is the only heading in the accessibility tree at
          all, because Published marks its whole cover — including the journal
          cover's own h1 — aria-hidden + inert while the overlay is up. Purely
          semantic: .ph-call__prompt owns every type declaration. */}
      <h1 className="ph-call__prompt" id={promptId}>
        {t('call.prompt')}
      </h1>
      {/* R6.5's radiogroup pattern is for the forks, which are a persistent
          selection; these two commit immediately, so they are buttons -- Enter
          and Space work natively, and the arrow keys move between them. */}
      <div className="ph-call__options" role="group" aria-labelledby={promptId} onKeyDown={onKeyDown}>
        {options.map((option, i) => (
          <button
            key={option.verdict}
            ref={(node) => {
              buttons.current[i] = node;
            }}
            type="button"
            className="ph-call__option"
            disabled={busy}
            onClick={() => choose(option.verdict)}
          >
            <span className="ph-call__option-title">{option.title}</span>
            <span className="ph-call__option-sub">{option.sub}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
