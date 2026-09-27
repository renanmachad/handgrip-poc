# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- Install: `bun install`
- Run dev server: `bun start` (= `bun run index.ts`) — serves on http://localhost:3000
- Typecheck: `bunx tsc --noEmit`

No test runner or linter is configured. Verifying behavior means running the app in a browser with a webcam; `getUserMedia` requires `localhost` or HTTPS.

## Architecture

Real-time hand-grip rep counter that runs entirely in the browser; nothing leaves the machine (the local server only serves pages and stores training samples on disk). Bun-native: no bundler config, no framework.

- `index.ts` — `Bun.serve` entrypoint. Routes map paths to HTML imports (`import x from "./views/x.html"`); Bun bundles each page's `<script type="module" src="/scripts/....ts">` at serve time. Add pages by adding an HTML import and a `routes` entry. `/api/samples` is the only server logic (see `server/`).
- `views/*.html` — each page is self-contained: markup and all CSS inline. `index.html` also has an inline non-module `<script>` "gamification layer" (clock, power meter, combo/XP, FX toggle). It is not wired to the TS modules: it watches the DOM elements the TS writes to (`#grip-val`, `#reps`, …) through `MutationObserver`. Renaming or restructuring those element IDs breaks both sides.
- `/training` (`views/training.html` + `scripts/training.ts`) — data-collection page for a handgrip-vs-no-handgrip image classifier. Holding `G`/`N` (or the buttons) posts raw, unmirrored frames, plus a square hand crop from the MediaPipe landmarks (`scripts/sample-capture.ts`), to `POST /api/samples`. `server/dataset.ts` writes `dataset/{full,crop}/<label>/<session>_<ts>_<id>.jpg` and appends to `dataset/manifest.csv` (git-ignored). Every sample carries a session ID so train/test can be split by session: consecutive frames are near-duplicates.
- `ml/` — Python study notebook (`handgrip_classifier.ipynb`, deps in `ml/requirements.txt`, venv at repo-root `.venv`). The user writes the model code themselves: the `# TODO` cells are intentionally empty, so don't fill them in unless asked. Reads `dataset/manifest.csv` (paths are relative to the repo root). Exports go to `ml/models/` (git-ignored).
- `server/` — server-only code (uses Bun/Node APIs). Never import it from `scripts/`.
- `scripts/` — client code, one responsibility per module. The game page is wired together in `script.ts`:
  - `script.ts` — `bootstrap()` loads the model and the camera in parallel, then `App` runs a `requestAnimationFrame` loop: detect → draw overlay → `calculateGrip` → `RepCounter.process` → update the view.
  - `camera.ts` — `getUserMedia` at 640×480.
  - `hand-tracker.ts` — `HandTracker` wraps MediaPipe `HandLandmarker` (VIDEO mode, GPU delegate). The WASM runtime and the `.task` model come from CDNs (jsdelivr / Google Storage) at runtime. The WASM URL pins `@0.10.14`, while `package.json` has `^0.10.35`, so keep the two compatible when upgrading.
  - `grip.ts` — grip signal: mean fingertip (8, 12, 16, 20) → palm (9) distance, normalized by wrist → palm length.
  - `rep-counter.ts` — EMA smoothing plus a rolling window; dynamic thresholds (fractions of the recent range) drive an `OPEN ⇄ CLOSED` state machine, and each open → close → open cycle counts one rep. Tunables are in `DEFAULT_OPTIONS`.
  - `view.ts` — `View` owns all DOM and canvas writes (MediaPipe `DrawingUtils` overlay, status, reps, grip). Other modules say *what* to show, never touch the DOM.

`tsconfig.json` is the Bun default (strict, `noEmit`, bundler resolution, DOM + ESNext, `verbatimModuleSyntax`, so type-only imports need `import type` / `type` specifiers). The same config covers server (`index.ts`) and browser (`scripts/`) code. Don't put Bun/Node-only APIs in anything under `scripts/`.

## Conventions

- Commits: a project skill at `.claude/skills/commit` groups changes into logical commits with short, action-oriented messages ("Add X", "Fix Y"), without conventional-commit prefixes.
