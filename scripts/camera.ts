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
  // Release the device when leaving the page, so another tab/page can open it.
  window.addEventListener("pagehide", () => {
    for (const track of stream.getTracks()) track.stop();
  });
  await video.play();
}

/** Maps a startup failure (camera or model) to a message the user can act on. */
export function describeStartupError(error: unknown): string {
  if (error instanceof DOMException) {
    switch (error.name) {
      case "NotAllowedError":
        return "Camera permission denied — allow it in the browser/OS settings and reload.";
      case "NotReadableError":
        return "Camera is busy — close other tabs or apps using it (Zoom, Meet, OBS…) and reload.";
      case "NotFoundError":
        return "No camera found — connect a webcam and reload.";
      case "OverconstrainedError":
        return "Camera does not support the requested resolution.";
    }
  }
  return "Camera or model unavailable — see the console for details.";
}
