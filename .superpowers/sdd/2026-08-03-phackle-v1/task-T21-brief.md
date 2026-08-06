### Task T21: PWA, meta, OG image, favicon

**Files:** Create `public/og.png`, `public/favicon.svg`, `assets/og-source.svg`; Modify `vite.config.ts` (vite-plugin-pwa), `index.html` (meta/OG tags, default-locale title/description per §7.6)
**Depends:** T5. **Master spec:** §7.6, §5.1 PWA.
**Steps:**
- [ ] Favicon: 🍴 glyph on `--paper` rounded square SVG. OG source SVG 1200×630: RETRACTED stamp over blurred journal cover mock + tagline "You will find p < 0.05. That's the problem." → `npx @resvg/resvg-js-cli assets/og-source.svg public/og.png` (or sharp one-liner script). Meta: title "P-hackle — the daily p-hacking game", description, `og:image`, `twitter:card=summary_large_image`.
- [ ] PWA: vite-plugin-pwa `registerType:'autoUpdate'`, manifest (name P-hackle, theme `#FBF8F1`, icons 192/512 from favicon source), precache app shell; verify `npm run build` emits manifest + sw.
- [ ] Test: build succeeds, `dist/` contains og.png/manifest/sw; add vitest asserting index.html has og tags (read file).
- [ ] **Commit** `feat: PWA manifest, OG card, favicon`.

---

