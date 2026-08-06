# P-hackle

**A daily game about the garden of forking paths.**

Every day, P-hackle deals you a synthetic dataset and a ridiculous headline to
prove ("Does owning a cat improve cryptocurrency returns?"). Your toolbox is
the real one — outcome switching, subgrouping, covariate shopping, outlier
surgery, one-tailed tests, optional stopping. You will reach p < 0.05 — the
game guarantees it — and then it will show you exactly what you did.

The game cannot be lost. That is the point.

- Sibling of [Climatle](https://github.com/crp94/climatle)
- Full specification: [`docs/implementation_plan.md`](docs/implementation_plan.md)
- Languages: English · Italiano · Español

## Development

Node **22.22.2 or newer, below 23** (`.nvmrc` pins the major; `package.json`'s
`engines` pins the floor and `.npmrc`'s `engine-strict` enforces it, so the
wrong runtime fails at install with a legible message instead of at test time
with 270 unrelated-looking assertion failures).

```sh
nvm use                 # reads .nvmrc
npm ci                  # exact lockfile install
npm run dev             # Vite dev server
npm test                # vitest, whole unit suite, ~37s
npm run typecheck       # tsc --noEmit (src, tests, e2e, scripts)
npm run lint            # eslint
npm run build           # production bundle into dist/
npm run bundle          # gzip table + initial-load budget (needs a build first)
npx playwright install chromium firefox webkit   # ONCE, before the first e2e run
npm run e2e             # Playwright; builds and previews the app itself
npm run cal             # calibration: verifies the five §3.9 bands, ~35s
npm run cal -- --write  # …and REGENERATES src/data/p_hit_by_k.json
```

`npm run e2e` needs no dev server — `playwright.config.ts` builds and previews
`dist/` itself, every run, because the defects it exists to catch only appear
after bundling. The full spec set runs on Chromium; `e2e/determinism.spec.ts`
additionally runs on Firefox and WebKit, which is the only way to test the
cross-engine claim that `Math.exp`/`Math.log` agree.

`npm run cal` **verifies**: it recomputes the p_hit table and exits non-zero if
the committed `src/data/p_hit_by_k.json` no longer matches. Only `-- --write`
rewrites that file, and the rewrite belongs in the same commit as the change
that caused it.

Three workflows gate the repository:

| Workflow | Trigger | What it gates |
|---|---|---|
| `test.yml` | every push / PR | typecheck, lint, the unit suite, the production build, the bundle budget — plus the §3.9 calibration bands when the push touches `src/engine/**`, `src/data/**`, `src/game/tuning.ts` or the simulation script |
| `e2e.yml` | every push / PR | Playwright against the real build: the booked-defect suite, the flows, i18n, and cross-realm determinism on all three browser engines |
| `calibration.yml` | Mondays 06:00 UTC + manual | the same five bands again, on a schedule, to catch drift caused by something outside those paths — a dependency bump or a Node minor |

## Prior art

- Aschwanden & King (FiveThirtyEight, 2015), *Hack Your Way to Scientific Glory*
- Simonsohn, Simmons & Nelson — specification curve analysis
- Gelman & Loken — the garden of forking paths
- Simmons, Nelson & Simonsohn (2011), *False-Positive Psychology*

## License

MIT © Carlos Rodríguez-Pardo
