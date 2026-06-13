import {
  DrawingUtils,
  HandLandmarker,
  type HandLandmarkerResult,
} from "@mediapipe/tasks-vision";

// Neon arcade overlay — matches the GRIP QUEST HUD palette.
const CONNECTOR_STYLE = { color: "#21e6ff", lineWidth: 5 };
const LANDMARK_STYLE = { color: "#ff2e84", lineWidth: 2 };

interface ViewElements {
  video: HTMLVideoElement;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  status: HTMLElement;
  reps: HTMLElement;
  repsHud: HTMLElement;
  grip: HTMLElement;
}

function requireElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing #${id} element in the document`);
  return element as T;
}

/**
 * Owns every DOM and canvas write. The rest of the app describes *what* to
 * show (rep count, grip value, status); the View decides *how* to render it.
 */
export class View {
  private readonly drawing: DrawingUtils;

  private constructor(private readonly el: ViewElements) {
    this.drawing = new DrawingUtils(el.ctx);
  }

  /** Wires the View to the elements already present in the document. */
  static fromDocument(video: HTMLVideoElement): View {
    const canvas = requireElement<HTMLCanvasElement>("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2D canvas context is not available");

    return new View({
      video,
      canvas,
      ctx,
      status: requireElement("info"),
      reps: requireElement("reps"),
      repsHud: requireElement("reps-hud"),
      grip: requireElement("grip-val"),
    });
  }

  /** Matches the canvas backing store to the video's intrinsic size. */
  syncCanvasSize(): void {
    this.el.canvas.width = this.el.video.videoWidth;
    this.el.canvas.height = this.el.video.videoHeight;
  }

  /** Clears the overlay and redraws connectors and landmarks for every hand. */
  drawHands(result: HandLandmarkerResult): void {
    const { ctx, canvas } = this.el;
    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const landmarks of result.landmarks) {
      this.drawing.drawConnectors(
        landmarks,
        HandLandmarker.HAND_CONNECTIONS,
        CONNECTOR_STYLE,
      );
      this.drawing.drawLandmarks(landmarks, LANDMARK_STYLE);
    }
    ctx.restore();
  }

  showReps(count: number): void {
    const text = String(count).padStart(2, "0");
    // Accent the leading digit to match the page's typographic treatment.
    this.el.reps.innerHTML = `<span class="accent">${text.slice(0, 1)}</span>${text.slice(1)}`;
    this.el.repsHud.textContent = text;
  }

  showGrip(grip: number): void {
    this.el.grip.textContent = grip.toFixed(2);
  }

  showStatus(message: string): void {
    this.el.status.textContent = message;
  }
}
