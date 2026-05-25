import { HandLandmarker, FilesetResolver, DrawingUtils, type HandLandmarkerResult, type Detection, FaceDetector, type NormalizedLandmark } from "@mediapipe/tasks-vision";

// indixes for access finger tips on landmarkers results
const FINGERTIPS = {
  THUMB: 4,
  INDEX: 8,
  MIDDLE: 12,
  RING: 16,
  PINKY: 20,
} as const;

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
    console.log(`display name: ${top.displayName}`);

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

  // first hand 
  if (numberOfHands > 0) {
    const hand = detections.landmarks[0];
    if (!hand) return;

    const grip = calculateHandGrip(hand)
    info.textContent = `Grip: ${grip.toFixed(3)}`
  }

  // second hand
  if (numberOfHands >= 1) {
    const hand = detections.landmarks[1];
    if (!hand) return;

    const grip = calculateHandGrip(hand);

    info.textContent = `Grip: ${grip.toFixed(3)}`
  }
}





/**
* Calculate average difference of wrist of hand and tips of fingers
*/
function calculateHandGrip(hand: NormalizedLandmark[]): number {
  const wrist = hand[0]

  const middlemcp = hand[MID.MIDDLE];

  if (!wrist) return 0;
  if (!middlemcp) return 0;

  const handSize = Math.hypot(
    wrist.x - middlemcp.x,
    wrist.y - middlemcp.y
  );

  const tips = [8, 12, 16, 20].map(i => hand[i]);

  const avgDist = tips.map(tip => {
    if (!tip) return 0;
    return Math.hypot(wrist.x - tip.x, wrist.y - tip.y)
  })
    .reduce((a, b) => a + b, 0) / tips.length

  return avgDist / handSize
}

init()

