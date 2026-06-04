import type { NormalizedLandmark } from "@mediapipe/tasks-vision";

/**
 * MediaPipe hand-landmark indices.
 * @see https://developers.google.com/mediapipe/solutions/vision/hand_landmarker
 */
const Landmark = {
  WRIST: 0,
  /** Base of the middle finger — used as a stable proxy for the palm centre. */
  PALM: 9,
} as const;

/** Fingertip landmark indices: index, middle, ring, pinky. */
const FINGERTIPS = [8, 12, 16, 20] as const;

function distance(a: NormalizedLandmark, b: NormalizedLandmark): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Computes the grip signal: the mean fingertip→palm distance, normalized by
 * hand size (wrist→palm).
 *
 * Normalizing makes the value scale-invariant, so it stays comparable whether
 * the hand is near or far from the camera. A closing fist drives the signal
 * down; an open hand drives it up.
 *
 * Returns 0 when the landmarks required for a stable reading are missing.
 */
export function calculateGrip(hand: NormalizedLandmark[]): number {
  const wrist = hand[Landmark.WRIST];
  const palm = hand[Landmark.PALM];
  if (!wrist || !palm) return 0;

  const handSize = distance(wrist, palm);
  if (handSize === 0) return 0;

  let totalReach = 0;
  let fingersFound = 0;
  for (const tipIndex of FINGERTIPS) {
    const tip = hand[tipIndex];
    if (!tip) continue;
    totalReach += distance(palm, tip);
    fingersFound++;
  }
  if (fingersFound === 0) return 0;

  const averageReach = totalReach / fingersFound;
  return averageReach / handSize;
}
