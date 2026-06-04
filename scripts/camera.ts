export interface Resolution {
  width: number;
  height: number;
}

/**
 * Requests the webcam and streams it into the given <video>, resolving once
 * playback has started.
 *
 * Throws if the user denies access or no camera is available, leaving error
 * handling to the caller. Note: `getUserMedia` only works on `localhost` or
 * over HTTPS.
 */
export async function startCamera(
  video: HTMLVideoElement,
  resolution: Resolution,
): Promise<void> {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { width: resolution.width, height: resolution.height },
  });
  video.srcObject = stream;
  await video.play();
}
