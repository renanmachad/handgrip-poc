import {
  FilesetResolver,
  HandLandmarker,
  type HandLandmarkerResult,
} from "@mediapipe/tasks-vision";

const WASM_RUNTIME_URL =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

export interface DetectedHands {
  left: boolean;
  right: boolean;
}

/**
 * Thin wrapper around MediaPipe's HandLandmarker that hides WASM/model loading
 * behind a single async factory and exposes a minimal per-frame `detect` call.
 */
export class HandTracker {
  private constructor(private readonly landmarker: HandLandmarker) {}

  /** Loads the MediaPipe WASM runtime and the hand-landmark model. */
  static async create(maxHands = 1): Promise<HandTracker> {
    const vision = await FilesetResolver.forVisionTasks(WASM_RUNTIME_URL);
    const landmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
      runningMode: "VIDEO",
      numHands: maxHands,
    });
    return new HandTracker(landmarker);
  }

  detect(video: HTMLVideoElement, timestampMs: number): HandLandmarkerResult {
    return this.landmarker.detectForVideo(video, timestampMs);
  }
}

/** Reduces MediaPipe's handedness output to simple left/right flags. */
export function readHandedness(result: HandLandmarkerResult): DetectedHands {
  const hands: DetectedHands = { left: false, right: false };
  for (const categories of result.handedness) {
    const best = categories[0];
    if (!best) continue;
    if (best.displayName === "Right") hands.right = true;
    if (best.displayName === "Left") hands.left = true;
  }
  return hands;
}

/** Builds a human-readable status line from the detected hands. */
export function describeHands(hands: DetectedHands): string {
  if (hands.left && hands.right) return "Both hands detected";
  if (hands.right) return "Right hand detected";
  if (hands.left) return "Left hand detected";
  return "No hand detected";
}
