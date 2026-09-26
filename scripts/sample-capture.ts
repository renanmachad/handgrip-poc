import type { NormalizedLandmark } from "@mediapipe/tasks-vision";

export interface CropBox {
  x: number;
  y: number;
  size: number;
}

/**
 * Extra margin around the landmark bounding box, as a fraction of its longest
 * side. Generous on purpose: the handgrip device sticks out past the fingers.
 */
const CROP_PADDING = 0.35;
const JPEG_QUALITY = 0.92;

/**
 * Square pixel box around the hand, padded and clamped to the frame. A square
 * keeps the aspect ratio stable when the crop is later resized for training.
 */
export function handCropBox(
  hand: NormalizedLandmark[],
  frameWidth: number,
  frameHeight: number,
): CropBox | null {
  if (hand.length === 0) return null;

  const xs = hand.map((point) => point.x * frameWidth);
  const ys = hand.map((point) => point.y * frameHeight);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const side = Math.max(maxX - minX, maxY - minY) * (1 + 2 * CROP_PADDING);
  const size = Math.min(side, frameWidth, frameHeight);
  if (size < 1) return null;

  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const x = Math.min(Math.max(centerX - size / 2, 0), frameWidth - size);
  const y = Math.min(Math.max(centerY - size / 2, 0), frameHeight - size);
  return { x, y, size };
}

export interface Snapshot {
  full: Blob;
  crop: Blob | null;
}

/**
 * Grabs raw video frames (no overlay, not mirrored) and encodes them as JPEG.
 * Uses its own off-screen canvas so the on-screen overlay is never captured.
 */
export class FrameGrabber {
  private readonly canvas = document.createElement("canvas");
  private readonly ctx: CanvasRenderingContext2D;

  constructor(private readonly video: HTMLVideoElement) {
    const ctx = this.canvas.getContext("2d");
    if (!ctx) throw new Error("2D canvas context is not available");
    this.ctx = ctx;
  }

  async snapshot(cropBox: CropBox | null): Promise<Snapshot> {
    const { videoWidth: width, videoHeight: height } = this.video;
    const full = await this.encode(0, 0, width, height, width, height);
    const crop = cropBox
      ? await this.encode(
          cropBox.x,
          cropBox.y,
          cropBox.size,
          cropBox.size,
          Math.round(cropBox.size),
          Math.round(cropBox.size),
        )
      : null;
    return { full, crop };
  }

  private encode(
    sx: number,
    sy: number,
    sw: number,
    sh: number,
    outWidth: number,
    outHeight: number,
  ): Promise<Blob> {
    this.canvas.width = outWidth;
    this.canvas.height = outHeight;
    this.ctx.drawImage(this.video, sx, sy, sw, sh, 0, 0, outWidth, outHeight);
    return new Promise((resolve, reject) => {
      this.canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("JPEG encoding failed"))),
        "image/jpeg",
        JPEG_QUALITY,
      );
    });
  }
}
