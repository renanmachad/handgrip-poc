# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- Install: `bun install`
- Run dev server: `bun run index.ts` (or `bun start`) — serves on http://localhost:3000
- Typecheck: `bunx tsc --noEmit`

No test runner or linter is configured.

## Architecture

Bun-native fullstack app (no bundler config, no framework). Bun's HTML import pipeline does the bundling.

- `index.ts` — Bun.serve entrypoint. Imports `./views/index.html` directly; Bun resolves the HTML's `<script type="module" src="/scripts/script.ts">` and serves the transpiled TS to the browser automatically. To add routes, extend the `routes` object in `Bun.serve`.
- `views/index.html` — page shell; script tags reference TS files by path, which Bun rewrites at serve time.
- `scripts/script.ts` — client-side code (runs in browser, uses DOM + `navigator.mediaDevices`). The current POC accesses the webcam via `getUserMedia` and appends a `<video>` element. Note: `getUserMedia` requires `localhost` or HTTPS.

`tsconfig.json` is the Bun default: strict, `noEmit`, bundler resolution, DOM + ESNext libs, `verbatimModuleSyntax`. The same tsconfig covers both server (`index.ts`) and browser (`scripts/`) code — keep that in mind when adding Node/Bun-only APIs to files that may be imported from the client.
