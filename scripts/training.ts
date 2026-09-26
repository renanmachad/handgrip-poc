import {
  DrawingUtils,
  HandLandmarker,
  type HandLandmarkerResult,
} from "@mediapipe/tasks-vision";
import { startCamera, type Resolution } from "./camera.ts";
import { HandTracker } from "./hand-tracker.ts";
import { FrameGrabber, handCropBox, type CropBox } from "./sample-capture.ts";

const RESOLUTION: Resolution = { width: 640, height: 480 };
/** Delay between captures while a label key/button is held down. */
const BURST_INTERVAL_MS = 250;

type Label = "handgrip" | "no_handgrip";

const KEY_TO_LABEL: Record<string, Label> = { g: "handgrip", n: "no_handgrip" };

function requireElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing #${id} element in the document`);
  return element as T;
}

/** e.g. "s20260926-143005" — sortable, and safe as part of a file name. */
function newSessionId(): string {
  const stamp = new Date().toISOString().slice(0, 19).replace(/[-:]/g, "").replace("T", "-");
  return `s${stamp}`;
}

/**
 * Data-collection page: shows the webcam with the hand overlay and, while a
 * label is held, posts raw frames (plus a hand crop when one is detected) to
 * the server, which writes them under `dataset/`.
 */
class TrainingApp {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly drawing: DrawingUtils;
  private readonly grabber: FrameGrabber;
  private lastVideoTime = -1;
  private cropBox: CropBox | null = null;
  private session = newSessionId();
  private activeLabel: Label | null = null;
  private burstTimer: number | undefined;
  private saving = false;

  constructor(
    private readonly video: HTMLVideoElement,
    private readonly canvas: HTMLCanvasElement,
    private readonly tracker: HandTracker,
  ) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2D canvas context is not available");
    this.ctx = ctx;
    this.drawing = new DrawingUtils(ctx);
    this.grabber = new FrameGrabber(video);
  }

  start(): void {
    this.canvas.width = this.video.videoWidth;
    this.canvas.height = this.video.videoHeight;
    this.bindControls();
    this.showSession();
    void this.refreshCounts();
    setStatus("Ready — hold G (handgrip) or N (no handgrip) to capture");
    this.loop();
  }

  private readonly loop = (): void => {
    if (this.video.currentTime !== this.lastVideoTime) {
      this.lastVideoTime = this.video.currentTime;
      const result = this.tracker.detect(this.video, performance.now());
      const hand = result.landmarks[0];
      this.cropBox = hand
        ? handCropBox(hand, this.video.videoWidth, this.video.videoHeight)
        : null;
      this.draw(result);
    }
    requestAnimationFrame(this.loop);
  };

  private draw(result: HandLandmarkerResult): void {
    const { ctx, canvas } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const landmarks of result.landmarks) {
      this.drawing.drawConnectors(landmarks, HandLandmarker.HAND_CONNECTIONS, {
        color: "#21e6ff",
        lineWidth: 3,
      });
      this.drawing.drawLandmarks(landmarks, { color: "#ff2e84", lineWidth: 1 });
    }
    if (this.cropBox) {
      const { x, y, size } = this.cropBox;
      ctx.strokeStyle = this.activeLabel === "handgrip" ? "#c6ff43"
        : this.activeLabel === "no_handgrip" ? "#ff2e84"
        : "#ffd23f";
      ctx.lineWidth = 3;
      ctx.setLineDash([10, 6]);
      ctx.strokeRect(x, y, size, size);
      ctx.setLineDash([]);
    }
  }

  private bindControls(): void {
    window.addEventListener("keydown", (event) => {
      if (event.repeat || event.target instanceof HTMLInputElement) return;
      const key = event.key.toLowerCase();
      const label = KEY_TO_LABEL[key];
      if (label) this.startBurst(label);
      if (key === "s") this.rotateSession();
    });
    window.addEventListener("keyup", (event) => {
      if (KEY_TO_LABEL[event.key.toLowerCase()] === this.activeLabel) this.stopBurst();
    });
    window.addEventListener("blur", () => this.stopBurst());

    document.querySelectorAll<HTMLButtonElement>("[data-label]").forEach((button) => {
      const label = button.dataset.label as Label;
      button.addEventListener("pointerdown", (event) => {
        button.setPointerCapture(event.pointerId);
        this.startBurst(label);
      });
      button.addEventListener("pointerup", () => this.stopBurst());
      button.addEventListener("pointercancel", () => this.stopBurst());
    });
    requireElement("new-session").addEventListener("click", () => this.rotateSession());
  }

  private startBurst(label: Label): void {
    this.stopBurst();
    this.activeLabel = label;
    document.body.dataset.capturing = label;
    void this.capture(label);
    this.burstTimer = window.setInterval(() => void this.capture(label), BURST_INTERVAL_MS);
  }

  private stopBurst(): void {
    window.clearInterval(this.burstTimer);
    this.burstTimer = undefined;
    this.activeLabel = null;
    delete document.body.dataset.capturing;
  }

  /** Starts a new recording session — do it whenever lighting/background/person changes. */
  private rotateSession(): void {
    this.session = newSessionId();
    this.showSession();
    setStatus(`New session ${this.session}`);
  }

  private async capture(label: Label): Promise<void> {
    // Skip ticks while the previous upload is still in flight.
    if (this.saving) return;
    this.saving = true;
    try {
      const { full, crop } = await this.grabber.snapshot(this.cropBox);
      const form = new FormData();
      form.set("label", label);
      form.set("session", this.session);
      form.set("full", full, "full.jpg");
      if (crop) form.set("crop", crop, "crop.jpg");

      const response = await fetch("/api/samples", { method: "POST", body: form });
      if (!response.ok) throw new Error(`Server responded ${response.status}`);

      showPreview("last-full", full);
      showPreview("last-crop", crop);
      setStatus(`Saved ${label}${crop ? " + crop" : " (no hand detected — full frame only)"}`);
      await this.refreshCounts();
    } catch (error) {
      this.stopBurst();
      setStatus("Failed to save sample — see console");
      console.error(error);
    } finally {
      this.saving = false;
    }
  }

  private async refreshCounts(): Promise<void> {
    const response = await fetch("/api/samples");
    if (!response.ok) return;
    const counts = (await response.json()) as Record<Label, number>;
    requireElement("count-handgrip").textContent = String(counts.handgrip);
    requireElement("count-no_handgrip").textContent = String(counts.no_handgrip);
  }

  private showSession(): void {
    requireElement("session").textContent = this.session;
  }
}

function setStatus(message: string): void {
  requireElement("status").textContent = message;
}

function showPreview(id: string, blob: Blob | null): void {
  const img = requireElement<HTMLImageElement>(id);
  if (img.src) URL.revokeObjectURL(img.src);
  if (blob) {
    img.src = URL.createObjectURL(blob);
    img.hidden = false;
  } else {
    img.removeAttribute("src");
    img.hidden = true;
  }
}

async function bootstrap(): Promise<void> {
  const video = requireElement<HTMLVideoElement>("video");
  const canvas = requireElement<HTMLCanvasElement>("canvas");
  setStatus("Loading model…");
  try {
    const [tracker] = await Promise.all([
      HandTracker.create(),
      startCamera(video, RESOLUTION),
    ]);
    new TrainingApp(video, canvas, tracker).start();
  } catch (error) {
    setStatus("Camera or model unavailable — check permissions.");
    console.error("Failed to start the training capture:", error);
  }
}

bootstrap();
