export function cameraErrorMessage(error: unknown): string {
  const name = error instanceof Error
    ? error.name
    : typeof error === "object" && error !== null && "name" in error && typeof error.name === "string"
      ? error.name
      : "";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return "Camera permission was denied. Allow camera access in your browser settings, or use Choose from device instead.";
  }
  if (name === "NotFoundError" || name === "OverconstrainedError") {
    return "No compatible camera was found. Try switching cameras or choose a photo from your device.";
  }
  if (name === "NotReadableError") {
    return "The camera is busy in another app. Close that app and retry, or choose a photo from your device.";
  }
  return "Camera could not start in this browser or context. Use Choose from device as a fallback.";
}

export function cameraSupportMessage(secureContext: boolean, hasGetUserMedia: boolean): string | null {
  if (!secureContext) return "Camera access requires HTTPS (or localhost). Choose a photo from your device instead.";
  if (!hasGetUserMedia) return "This browser does not support camera capture. Choose a photo from your device instead.";
  return null;
}
