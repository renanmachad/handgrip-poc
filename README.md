# Handgrip — a study in computer vision

Real-time hand-grip repetition counter that runs entirely in the browser.
Twenty-one hand keypoints are inferred per frame on the GPU via
[MediaPipe Tasks](https://developers.google.com/mediapipe), and a small
state machine watches the fingers fold toward the palm to count reps.

Nothing leaves the device — no server, no uplink, no logs.

![Handgrip preview](./views/preview.png)

---

## Stack

- **Runtime:** [Bun](https://bun.com) (no bundler, no framework)
- **Language:** TypeScript
- **Vision:** `@mediapipe/tasks-vision` — `hand_landmarker` (float16, GPU delegate)
- **UI:** Hand-written HTML + CSS, served via Bun's HTML import pipeline

## How it works

1. `getUserMedia` opens the webcam at 640×480.
2. Each frame is passed to MediaPipe's `HandLandmarker`, producing 21 normalized
   keypoints per detected hand.
3. A **grip signal** is computed as the average distance from each fingertip
   (indices 8, 12, 16, 20) to the palm (index 9), normalized by hand size
   (wrist → palm).
4. The signal is smoothed with an EMA (α = 0.2) and stored in a 60-frame
   rolling buffer.
5. Dynamic thresholds (35% / 75% of the rolling range) drive a two-state
   machine (`OPEN ⇄ CLOSED`). Each full open → close → open cycle increments
   the rep count.

All of this lives in [`scripts/script.ts`](./scripts/script.ts).

## Project structure

```
handgrip-poc/
├── index.ts            # Bun.serve entrypoint
├── views/
│   └── index.html      # page shell + styles
└── scripts/
    └── script.ts       # camera + MediaPipe + rep counter
```

## Running locally

Requirements: [Bun](https://bun.sh) v1.3+ and a webcam.

```bash
# install
bun install

# start dev server on http://localhost:3000
bun start
```

> `getUserMedia` requires `localhost` or HTTPS — opening the HTML file
> directly will not work.

## Collecting training data

`http://localhost:3000/training` captures labeled webcam frames for a
"handgrip / no handgrip" image classifier. Hold **G** (handgrip) or **N**
(no handgrip) to capture about 4 frames/s, and press **S** to start a new session.
Samples are written locally to:

```
dataset/
├── full/<label>/<session>_<ts>_<id>.jpg   # raw frame, unmirrored
├── crop/<label>/<session>_<ts>_<id>.jpg   # square crop around the hand (when detected)
└── manifest.csv                           # full_path, crop_path, label, session, has_hand, captured_at
```

Split train/test **by session**, not by frame: consecutive frames are near-duplicates.

## Type-checking

```bash
bunx tsc --noEmit
```

There is no test runner or linter configured.

## Roadmap

- [ ] Persist counts locally (IndexedDB / localStorage)
- [ ] Export sessions (CSV / JSON)
- [ ] Reset / pause counting when no hand is on screen
- [x] Redesign the UI

## Credits

Built by [Renan Machado](https://github.com/renanmachad) — 2026.
Hand tracking model © Google, via MediaPipe.
