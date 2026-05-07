/**
 * Create the video element and set the attributes
 */
const video = document.createElement("video");
video.setAttribute("playsinline", "");
video.setAttribute('autoplay', '');
video.setAttribute('muted', '');
video.style.width = '1200px';
video.style.height = '600px';

/* Setting up the constraint */
var facingMode = "user"; // Can be 'user' or 'environment' to access back or front camera (NEAT!)
var constraints = {
  audio: false,
  video: {
   facingMode: facingMode
  }
};

/**
 * Get the user media and set the source object to the video element
 */
navigator.mediaDevices.getUserMedia(constraints).then((stream) => {
    video.srcObject = stream;
    video.play();
});

/**
 * Append the video element to the body
 */
document.body.appendChild(video);

/** */