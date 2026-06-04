import { startCamera, type Resolution } from "./camera.ts";
import { calculateGrip } from "./grip.ts";
import { describeHands, HandTracker, readHandedness } from "./hand-tracker.ts";
import { RepCounter } from "./rep-counter.ts";
import { View } from "./view.ts";

const RESOLUTION: Resolution = { width: 640, height: 480 };

/**
 * Drives the per-frame pipeline: detect hands → draw overlay → update the grip
 * counter → refresh the UI. Collaborators are injected, so each piece can be
 * developed and reasoned about in isolation.
 */
class App {
  private lastVideoTime = -1;

  constructor(
    private readonly video: HTMLVideoElement,
    private readonly tracker: HandTracker,
    private readonly counter: RepCounter,
    private readonly view: View,
  ) {}

  start(): void {
    this.view.syncCanvasSize();
    this.loop();
  }

  private readonly loop = (): void => {
    if (this.hasNewFrame()) {
      this.lastVideoTime = this.video.currentTime;
      this.processFrame();
    }
    requestAnimationFrame(this.loop);
  };

  private hasNewFrame(): boolean {
    const isReady = this.video.videoWidth > 0 && this.video.videoHeight > 0;
    return isReady && this.video.currentTime !== this.lastVideoTime;
  }

  private processFrame(): void {
    const result = this.tracker.detect(this.video, performance.now());
    this.view.drawHands(result);

    const hand = result.landmarks[0];
    if (!hand) {
      this.view.showStatus("No hand detected");
      return;
    }

    const grip = calculateGrip(hand);
    this.counter.process(grip);

    this.view.showStatus(describeHands(readHandedness(result)));
    this.view.showGrip(grip);
    this.view.showReps(this.counter.count);
  }
}

async function bootstrap(): Promise<void> {
  const video = document.getElementById("video") as HTMLVideoElement | null;
  if (!video) throw new Error("Missing #video element in the document");

  const view = View.fromDocument(video);
  view.showStatus("Loading model…");

  try {
    const [tracker] = await Promise.all([
      HandTracker.create(),
      startCamera(video, RESOLUTION),
    ]);
    new App(video, tracker, new RepCounter(), view).start();
  } catch (error) {
    view.showStatus("Camera or model unavailable — check permissions.");
    console.error("Failed to start the handgrip tracker:", error);
  }
}

bootstrap();
