"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cameraErrorMessage, cameraSupportMessage } from "@/lib/mobile/camera";

type Props = {
  disabled?: boolean;
  onCapture: (file: File) => void | Promise<void>;
};

export function CameraCapture({ disabled = false, onCapture }: Props) {
  const [open, setOpen] = useState(false);
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [streaming, setStreaming] = useState(false);
  const [captured, setCaptured] = useState<File | null>(null);
  const [capturedPreview, setCapturedPreview] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [cameraUnavailable, setCameraUnavailable] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fallbackRef = useRef<HTMLInputElement>(null);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setStreaming(false);
  }, []);

  const close = useCallback(() => {
    stopCamera();
    setOpen(false);
    setCaptured(null);
    setCapturedPreview("");
    setError("");
  }, [stopCamera]);

  const startCamera = useCallback(async (mode: "environment" | "user") => {
    stopCamera();
    setError("");
    setCameraUnavailable(false);
    const supportMessage = cameraSupportMessage(window.isSecureContext, !!navigator.mediaDevices?.getUserMedia);
    if (supportMessage) {
      setCameraUnavailable(true);
      setError(supportMessage);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: mode }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setStreaming(true);
    } catch (e) {
      setCameraUnavailable(true);
      setError(cameraErrorMessage(e));
    }
  }, [stopCamera]);

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  useEffect(() => () => {
    if (capturedPreview) URL.revokeObjectURL(capturedPreview);
  }, [capturedPreview]);

  useEffect(() => {
    if (open && !captured && !cameraUnavailable && !streaming) {
      const timer = window.setTimeout(() => void startCamera(facing), 0);
      return () => window.clearTimeout(timer);
    }
  }, [open, captured, cameraUnavailable, streaming, facing, startCamera]);

  function takePhoto() {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) {
      setError("Wait until the camera preview is ready, then try again.");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) {
      setError("This browser cannot prepare the photo. Choose a photo from your device instead.");
      return;
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) {
        setError("Could not capture the image. Please try again.");
        return;
      }
      const file = new File([blob], "camera-capture-" + new Date().toISOString().replace(/[:.]/g, "-") + ".jpg", {
        type: "image/jpeg",
        lastModified: Date.now(),
      });
      setCaptured(file);
      setCapturedPreview(URL.createObjectURL(file));
      stopCamera();
      setError("");
    }, "image/jpeg", 0.94);
  }

  async function confirmPhoto() {
    if (!captured) return;
    setBusy(true);
    setError("");
    try {
      await onCapture(captured);
      close();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add the photo to the upload queue.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" className="pf-button" disabled={disabled} onClick={() => { setOpen(true); setError(""); setCameraUnavailable(false); }}>
        Capture photo
      </button>
      {open && <div className="pf-camera-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
        <section className="pf-camera-dialog" role="dialog" aria-modal="true" aria-labelledby="camera-capture-title" onKeyDown={(e) => { if (e.key === "Escape") close(); }}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 id="camera-capture-title" className="text-lg font-bold">Capture student photo</h3>
              <p className="pf-muted mt-1 text-sm">Camera access starts only after you choose Capture photo. Nothing uploads until you confirm.</p>
            </div>
            <button type="button" autoFocus className="pf-button-secondary" onClick={close} aria-label="Close camera">Close</button>
          </div>
          <div className="mt-4 overflow-hidden rounded-xl bg-black">
            {captured ? <img className="pf-camera-preview" src={capturedPreview} alt="Captured photo preview; confirm or retake" /> :
              <div className="relative">
                <video ref={videoRef} className="pf-camera-preview" autoPlay muted playsInline aria-label="Live camera preview" />
                {streaming && <div className="pf-camera-guide" aria-hidden="true"><div className="pf-camera-head-guide" /><div className="pf-camera-shoulders-guide" /></div>}
                {!streaming && <div className="flex min-h-56 items-center justify-center p-5 text-center text-sm text-white">{error || "Starting camera…"}</div>}
              </div>}
          </div>
          <p className="pf-muted mt-2 text-xs">Keep the face centered, use even lighting, and leave space around the head and shoulders. The guide is visual only and does not edit the image.</p>
          {error && <p role="alert" className="mt-3 rounded-lg border border-red-500/30 bg-red-950/30 p-3 text-sm text-red-200">{error}</p>}
          <div className="mt-4 flex flex-wrap gap-2">
            {!captured && <>
              <button type="button" className="pf-button-secondary" disabled={busy} onClick={() => { const next = facing === "environment" ? "user" : "environment"; setFacing(next); setCameraUnavailable(false); setStreaming(false); }}>Switch / retry camera ({facing === "environment" ? "front" : "rear"} preferred)</button>
              <button type="button" className="pf-button" disabled={!streaming} onClick={takePhoto}>Take photo</button>
              {cameraUnavailable && <button type="button" className="pf-button" onClick={() => fallbackRef.current?.click()}>Choose from device</button>}
            </>}
            {captured && <>
              <button type="button" className="pf-button-secondary" disabled={busy} onClick={() => { setCaptured(null); setCapturedPreview(""); setError(""); setCameraUnavailable(false); }}>Retake</button>
              <button type="button" className="pf-button" disabled={busy} onClick={() => void confirmPhoto()}>{busy ? "Adding to upload queue…" : "Confirm photo"}</button>
            </>}
          </div>
          <input ref={fallbackRef} className="sr-only" type="file" accept="image/*" capture="environment" aria-label="Choose or take a photo using device camera" onChange={(e) => { const file = e.currentTarget.files?.[0]; if (file) { setCaptured(file); setCapturedPreview(URL.createObjectURL(file)); setError(""); } e.currentTarget.value = ""; }} />
        </section>
      </div>}
    </>
  );
}
