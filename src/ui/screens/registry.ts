// The screen router's glue (T14): one line per Screen value, so each
// sibling screen task (T15 briefing, T16 published/call, T17 reveal, T18
// summary) replaces exactly one line here with its own real component,
// without touching ScreenRouter.tsx itself.
import type { ComponentType } from 'react';
import type { Screen } from '../../game/store';
import { Lab } from './Lab';
import { BriefingStub, CallStub, PublishedStub, RevealStub, SummaryStub } from './stubs';

export const SCREENS: Record<Screen, ComponentType> = {
  briefing: BriefingStub,
  lab: Lab,
  published: PublishedStub,
  call: CallStub,
  reveal: RevealStub,
  summary: SummaryStub,
};
