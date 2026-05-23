import { HandLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";


// canvas context
const canvas = document.getElementById("canvas") as HTMLCanvasElement;
const ctx = canvas.getContext("2d");
const info = document.getElementById("info") as HTMLDivElement;
const video = document.getElementById("video") as HTMLVideoElement;
let lastVideoTime = -1;

const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm");


const handLandmarker = await HandLandmarker.createFromOptions(vision, {
  baseOptions: {
    modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
    delegate: "GPU"
  },
  runningMode: "VIDEO",
  // can be one/1
  numHands: 2
})

const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } })

video.srcObject = stream;
await video.play();

function init() {

  if (video.videoWidth == 0 || video.videoHeight == 0) {
    console.log("No video width or heigth")
    requestAnimationFrame(init)
    return;
  }

  if (video.currentTime !== lastVideoTime) {
    const detections = handLandmarker.detectForVideo(video, performance.now());
    lastVideoTime = video.currentTime;

    const hands = {
      leftHand: false,
      rightHand: false,
    }

    for (const handCategories of detections.handedness) {
      const top = handCategories[0];
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

    info.textContent = msg;
  }

  requestAnimationFrame(() => {
    init()
  })
}

init()
