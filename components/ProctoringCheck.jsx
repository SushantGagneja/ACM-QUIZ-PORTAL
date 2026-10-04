"use client";

import { useState, useRef, useEffect } from "react";
import styles from "./ProctoringCheck.module.css";

export default function ProctoringCheck({ onProceed, warnings, mediaStreamRef }) {
  const [hasCamera, setHasCamera] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [error, setError] = useState("");
  const videoRef = useRef(null);

  // Sync current camera state if stream is already active
  useEffect(() => {
    if (mediaStreamRef.current && videoRef.current) {
      videoRef.current.srcObject = mediaStreamRef.current;
      setHasCamera(true);
    }
  }, [mediaStreamRef]);

  // Request Camera Access
  const enableCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });
      mediaStreamRef.current = stream;

      // NEW: also stash globally so the /quiz/[category] route (a separate
      // page/component tree) can find and stop this same stream later.
      if (typeof window !== "undefined") {
        window.__quizMediaStream = stream;
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setHasCamera(true);
      setError("");
    } catch (err) {
      setError("Webcam access is required to take this quiz. Please allow camera permissions in your browser.");
    }
  };

  // Request Fullscreen Mode
  const enableFullScreen = async () => {
    const docEl = document.documentElement;
    try {
      if (docEl.requestFullscreen) {
        await docEl.requestFullscreen();
      } else if (docEl.webkitRequestFullscreen) {
        await docEl.webkitRequestFullscreen();
      }
      setIsFullScreen(
        !!(document.fullscreenElement || document.webkitFullscreenElement)
      );
    } catch (err) {
      setError("Couldn't enter full screen. Please allow it and try again.");
    }
  };

  return (
    <div className={styles.card}>
      <h2 className={styles.title}>System Re-Verification</h2>
      <p className={styles.subtitle}>Full screen and camera access are required to proceed</p>

      {warnings > 0 && (
        <div
          style={{
            backgroundColor: "rgba(239, 68, 68, 0.2)",
            border: "1px solid #ef4444",
            color: "#fca5a5",
            padding: "10px",
            borderRadius: "8px",
            marginBottom: "16px",
            fontWeight: "bold",
          }}
        >
          ⚠️ Total Warnings: {warnings} / 3
        </div>
      )}

      <div className={styles.rulesList}>
        <div className={styles.ruleItem}>
          <span className={hasCamera ? styles.badgeDone : styles.badgePending}>
            {hasCamera ? "ENABLED" : "REQUIRED"}
          </span>
          <span>Webcam Stream Active</span>
        </div>

        <div className={styles.ruleItem}>
          <span className={isFullScreen ? styles.badgeDone : styles.badgePending}>
            {isFullScreen ? "ENABLED" : "REQUIRED"}
          </span>
          <span>Full Screen Mode Enforced</span>
        </div>
      </div>

      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={styles.videoPreview}
      />

      {error && <p className={styles.errorMsg}>{error}</p>}

      <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "20px" }}>
        {!hasCamera && (
          <button onClick={enableCamera} className={styles.actionBtn}>
            Enable Camera
          </button>
        )}

        {hasCamera && !isFullScreen && (
          <button onClick={enableFullScreen} className={styles.actionBtn}>
            Re-Enter Full Screen Mode
          </button>
        )}

        {hasCamera && isFullScreen && (
          <button onClick={onProceed} className={styles.actionBtn}>
            Return to Category Selection
          </button>
        )}
      </div>
    </div>
  );
}