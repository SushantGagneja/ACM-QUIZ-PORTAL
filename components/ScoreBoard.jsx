"use client";

import { useRouter } from "next/navigation";
import styles from "./ScoreBoard.module.css";

export default function ScoreBoard({ score, total, onExit }) {
  const router = useRouter();

  const handleExitPortal = () => {
    // 1. Release active camera streams and turn off webcam
    if (window.mediaStreamRef && window.mediaStreamRef.current) {
      window.mediaStreamRef.current.getTracks().forEach((track) => track.stop());
    }

    // 2. Exit full-screen mode if active
    if (document.fullscreenElement || document.webkitFullscreenElement) {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      }
    }

    // 3. Execute completion callback or redirect using Next.js router
    if (onExit) {
      onExit();
    } else {
      router.push("/");
    }
  };

  return (
    <div className={styles.card}>
      <div className={styles.iconWrapper}>🎉</div>
      <h2 className={styles.title}>Thank You for Submitting!</h2>
      <p className={styles.subtitle}>
        Your answers have been processed.
      </p>

      <div className={styles.scoreBox}>
        <span className={styles.scoreLabel}>Final Score</span>
        <span className={styles.scoreValue}>
          {score} / {total}
        </span>
      </div>

      <button onClick={handleExitPortal} className={styles.exitBtn}>
        Exit Portal
      </button>
    </div>
  );
}