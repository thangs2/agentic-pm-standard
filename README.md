# APS — HTML wiki

**Generated** from [`../md/`](../md/00.index.md). Do not edit HTML by hand — run:

```bash
cd ../scripts && bun install && bun run build
```

Entry: [`index.html`](./index.html) — the landing page (what APS is, how one ask moves, an 8-step ~54-minute path) · [`00.start/00.index.html`](./00.start/00.index.html)

**Search:** `Ctrl`/`⌘` `K` anywhere, or the header button. The index (`_assets/aps-search-index.js`) is generated at build time and lazy-loaded on first open, so search also works when the folder is opened straight from disk (`file://`) — no server needed.

**Theme:** Light / Dark / Auto (top bar). Styles: [`_assets/aps-antigravity.css`](./_assets/aps-antigravity.css) — inspired by [Antigravity Docs](https://antigravity.google/docs/enterprise).

**Static site:** This folder is self-contained — open `index.html` directly, or publish it with GitHub Pages. `.nojekyll` is generated so `_assets/` is served verbatim.
