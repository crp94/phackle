This repo implements P-hackle per docs/implementation_plan.md.
Non-negotiables: (1) full determinism — same date ⇒ identical puzzle on all
clients; (2) the statistical engine is validated by the test suite in §8
before any UI work builds on it; (3) all game-balance constants live in
src/game/tuning.ts; (4) no backend, no accounts, no personal data in v1.
When in doubt, the plan wins over improvisation; flag conflicts instead of
silently deviating.

Delta from the plan (agreed with Carlos): the game ships localized in
English (default), Italian, and Spanish from v1 — not English-only.
All user-facing copy lives in src/content/ behind a locale layer; no
hard-coded strings in components.
