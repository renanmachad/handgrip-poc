import { HandLandmarker, FilesetResolver, DrawingUtils, type HandLandmarkerResult, type Detection, FaceDetector, type NormalizedLandmark } from "@mediapipe/tasks-vision";



enum GripState {
  OPEN = "OPEN",
  CLOSED = "CLOSED"
};

class RepCounter {
  // estado interno
  private buffer: number[] = [];

  private smoothedGrip = 0;

  // EMA factor
  private readonly alpha = 0.2;

  private state = GripState.OPEN;

  private count = 0;

  private debug = {
    min: 0,
    max: 0,
    range: 0,
    closeThreshold: 0,
    openThreshold: 0,
    smoothedGrip: 0,
    state: GripState.OPEN
  };

  private static MAX_WINDOW_SIZE = 60;

  private static MIN_SAMPLES = 20;

  private static MIN_RANGE = 0.12;


  process(rawGrip: number): void {

    // ================
    // 1. Smooth signal
    // ================
    const grip = this.alpha * rawGrip + (1 - this.alpha) * this.smoothedGrip;
    this.smoothedGrip = grip;

    // ================
    // 2. Store history
    // ================

    this.buffer.push(grip);

    if (this.buffer.length > RepCounter.MAX_WINDOW_SIZE) {
      this.buffer.shift();
    }

    if (this.buffer.length < RepCounter.MIN_SAMPLES) {
      return;
    }

    // ===============
    // 3. Dynamic range
    // ===============
    const min = Math.min(...this.buffer);
    const max = Math.max(...this.buffer);

    const range = max - min;

    // ignore noise
    if (range < RepCounter.MIN_RANGE) {
      return;
    }

    const closeThreshold = min + range * 0.35;
    const openThreshold = min + range * 0.75;

    // ================
    // 5. State machine
    // ================

    switch (this.state) {
      case GripState.OPEN:
        if (grip < closeThreshold) {
          this.state = GripState.CLOSED;
        }
        break;

      case GripState.CLOSED:
        if (grip > openThreshold) {
          this.state = GripState.OPEN;
          this.count++;
        }
        break;
    }

    // =============
    // 6. debug info
    // =============

    this.debug = {
      min,
      max,
      range,
      closeThreshold,
      openThreshold,
      smoothedGrip: grip,
      state: this.state
    }

  }


  getCount(): number {
    return this.count;
  }

  getDebugInfo() {
    return this.debug;
  } // útil pra debugar
}

// indixes for access finger tips on landmarkers results
const FINGERTIPS = [
  8,
  12,
  16,
  20,
];

const MID = {
  MIDDLE: 9
} as const;

const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } })

const canvas = document.getElementById("canvas") as HTMLCanvasElement;

const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;

const drawingUtils = new DrawingUtils(ctx);

const info = document.getElementById("info") as HTMLDivElement;

const video = document.getElementById("video") as HTMLVideoElement;
video.srcObject = stream;
await video.play();

canvas.width = video.videoWidth;
canvas.height = video.videoHeight;
let lastVideoTime = -1;

const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm");
const handLandmarker = await HandLandmarker.createFromOptions(vision, {
  baseOptions: {
    modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
    delegate: "GPU"
  },
  runningMode: "VIDEO",
  // TODO: Can be configured by user input
  numHands: 1
});
const repCounter = new RepCounter();
// moved to outside the loop to avoid recreate the variable
const hands = {
  leftHand: false,
  rightHand: false,
}

/**
* Draw conectors using `DrawingUtils` from media pipe
*/
function drawLandMarks(landmark: any[]) {
  drawingUtils.drawConnectors(landmark, HandLandmarker.HAND_CONNECTIONS, {
    color: "#00FF00",
    lineWidth: 5,
  })
  drawingUtils.drawLandmarks(landmark, { color: "#FF0000", lineWidth: 2 })
}

/**
* Draw lines for dected hands
*/
function drawHands(detections: HandLandmarkerResult): void {
  ctx.save();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.beginPath();
  ctx.rect(0, 0, canvas.width, canvas.height);
  ctx.clip();

  if (detections.landmarks) {
    for (const landmark of detections.landmarks) {
      drawLandMarks(landmark)
    }
  }
}


/**
* Filter landmark detection to know hand side
*/
function identifyHands(detections: HandLandmarkerResult) {
  let top;
  for (const handCategories of detections.handedness) {
    if (!handCategories[0]) {
      hands.leftHand = false;
      hands.rightHand = false;
      continue;
    }
    if (handCategories[0]) {
      top = handCategories[0];
    }

    if (!handCategories[1]) {
      hands.leftHand = false;
      hands.rightHand = false;
      continue;
    }

    if (handCategories[1]) {
      top = handCategories[1];
    }

    if (!top) continue;


    if (top.displayName == "Right") hands.rightHand = true;

    if (top.displayName == "Left") hands.leftHand = true;

  }

  let msg = "Nenhuma mão detectada";

  if (hands.leftHand && hands.rightHand) {
    msg = "Ambas mãos detectadas";
  } else if (hands.rightHand) {
    msg = "mão direita detectada";
  } else if (hands.leftHand) {
    msg = "mão esquerda detectada";
  }
  if (!hands.leftHand || hands.rightHand) {
    info.textContent = msg;
  }

  info.textContent = msg;
}


function init() {

  if (video.videoWidth == 0 || video.videoHeight == 0) {
    console.log("No video width or heigth")
    requestAnimationFrame(init)
    return;
  }

  if (video.currentTime !== lastVideoTime) {
    const detections = handLandmarker.detectForVideo(video, performance.now());
    lastVideoTime = video.currentTime;

    drawHands(detections);
    identifyHands(detections);
    identifyHandGripMovement(detections);
  }

  requestAnimationFrame(() => {
    init()
  })
}


function identifyHandGripMovement(detections: HandLandmarkerResult): void {
  const numberOfHands = detections.landmarks.length;

  if (numberOfHands === 0) {
    info.textContent = "Nenhuma mão";
    return;
  }

  const hand = detections.landmarks[0];

  if (!hand) return;

  const grip = calculateHandGrip(hand);

  repCounter.process(grip);

  const debug = repCounter.getDebugInfo();

  info.innerHTML = `
    Grip: ${grip.toFixed(3)} <br>
    Smooth: ${debug.smoothedGrip} <br>
    Range: ${debug.range} <br>
    State: ${debug.state} <br>
    Reps: ${repCounter.getCount()}
  `;

}

/**
* Calculate average difference of wrist of hand and tips of fingers
*/
function calculateHandGrip(hand: NormalizedLandmark[]): number {
  const wrist = hand[0]

  const palm = hand[MID.MIDDLE];

  if (!wrist || !palm) return 0;

  const handSize = Math.hypot(
    wrist.x - palm.x,
    wrist.y - palm.y
  )

  let total = 0;

  for (const tipIndex of FINGERTIPS) {
    const tip = hand[tipIndex]

    if (!tip) continue;

    const dist = Math.hypot(
      palm.x - tip.x,
      palm.y - tip.y
    )

    total += dist;
  }

  const avg = total / FINGERTIPS.length;

  return avg / handSize;
}

init()


