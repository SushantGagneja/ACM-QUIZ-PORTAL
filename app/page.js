"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import styles from "./page.module.css";
import { categories } from "@/data/questions";
import Image from "next/image";
import RegistrationForm from "@/components/RegistrationForm";
import ProctoringCheck from "@/components/ProctoringCheck";

export default function Home() {
  const [currentUser, setCurrentUser] = useState(null);
  const [isProctored, setIsProctored] = useState(false);
  const [isDisqualified, setIsDisqualified] = useState(false);

  // Warning System State
  const [warnings, setWarnings] = useState(0);
  const [activeWarningMsg, setActiveWarningMsg] = useState("");
  const mediaStreamRef = useRef(null);

  // Helper to issue warnings & trigger fallback to Step 2
  const issueWarning = useCallback((reason) => {
    setWarnings((prev) => {
      const newCount = prev + 1;
      if (newCount >= 3) {
        setIsDisqualified(true);
        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        }
        if (typeof window !== "undefined" && window.__quizMediaStream) {
          window.__quizMediaStream.getTracks().forEach((track) => track.stop());
          window.__quizMediaStream = null;
        }
        if (document.fullscreenElement && document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        }
      } else {
        // Show popup message and force user back to Step 2
        setActiveWarningMsg(`⚠️ WARNING (${newCount}/3): ${reason}`);
        setIsProctored(false);
      }
      return newCount;
    });
  }, []);

  // Monitor Fullscreen Exits & Tab Switching globally while in Step 3
  useEffect(() => {
    if (!currentUser || !isProctored || isDisqualified) return;

    const handleFullScreenChange = () => {
      if (!document.fullscreenElement && !document.webkitFullscreenElement) {
        issueWarning(
          "You exited full-screen mode! Full screen is required to attempt the quiz."
        );
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        issueWarning("Tab/window switching detected!");
      }
    };

    document.addEventListener("fullscreenchange", handleFullScreenChange);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullScreenChange);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [currentUser, isProctored, isDisqualified, issueWarning]);

  // Disqualification Screen
  if (isDisqualified) {
    return (
      <main className={styles.page}>
        <div style={{ textAlign: "center", padding: "60px 20px", color: "#ef4444" }}>
          <h1 style={{ fontSize: "2.5rem", fontWeight: "bold", marginBottom: "16px" }}>
            DISQUALIFIED
          </h1>
          <p style={{ color: "#9ca3af", fontSize: "1.1rem", maxWidth: "500px", margin: "0 auto" }}>
            You received 3/3 proctoring warnings for exiting full screen, switching tabs, or losing webcam access.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      {/* Warning Popup Modal */}
      {activeWarningMsg && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0,0,0,0.85)",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          zIndex: 9999
        }}>
          <div style={{
            background: "#1E293B",
            border: "2px solid #EF4444",
            padding: "24px 32px",
            borderRadius: "12px",
            textAlign: "center",
            maxWidth: "400px"
          }}>
            <h3 style={{ color: "#EF4444", fontSize: "1.3rem", marginBottom: "12px" }}>
              Proctoring Violation
            </h3>
            <p style={{ color: "#F3F4F6", marginBottom: "20px" }}>{activeWarningMsg}</p>
            <button
              onClick={() => setActiveWarningMsg("")}
              style={{
                background: "#EF4444",
                color: "#FFF",
                padding: "10px 20px",
                border: "none",
                borderRadius: "6px",
                fontWeight: "bold",
                cursor: "pointer"
              }}
            >
              Re-Verify System
            </button>
          </div>
        </div>
      )}

      <div className="mb-4">
        <Image
          src="/acm_logo.png"
          alt="Quiz Portal Logo"
          width={240}
          height={80}
          style={{ marginBottom: "32px" }}
          className="mx-auto h-auto object-contain"
          priority
        />
      </div>

      {/* STEP 1: Registration Form */}
      {!currentUser && (
        <RegistrationForm onStartQuiz={(user) => setCurrentUser(user)} />
      )}

      {/* STEP 2: Proctoring Check */}
      {currentUser && !isProctored && (
        <ProctoringCheck
          warnings={warnings}
          mediaStreamRef={mediaStreamRef}
          onProceed={() => setIsProctored(true)}
          onDisqualify={() => setIsDisqualified(true)}
        />
      )}

      {/* STEP 3: Category Selection */}
      {currentUser && isProctored && (
        <>
          <div className={styles.bulbRow} aria-hidden="true">
            {Array.from({ length: 9 }).map((_, i) => (
              <span key={i} className={styles.bulb} />
            ))}
          </div>

          <h1 className={styles.title}>
            QUIZ <span className={styles.titleAccent}>ROUND</span>
          </h1>
          <p className={styles.sub}>
            Pick a category, beat the clock, and complete your submission.
          </p>

          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <h2>Choose your Category</h2>
              <span>{categories.length} to choose from</span>
            </div>
            <div className={styles.grid}>
              {categories.map((cat) => (
                <Link
                  key={cat.slug}
                  href={`/quiz/${cat.slug}?userId=${currentUser.id}`}
                  className={styles.ticket}
                  style={{ "--ticket-color": cat.color }}
                >
                  <div className={styles.ticketTop}>
                    <span className={styles.ticketNumber}>{cat.ticketNumber}</span>
                    <span className={styles.ticketQCount}>
                      {cat.questions.length} questions
                    </span>
                  </div>
                  <div className={styles.ticketName}>{cat.name}</div>
                  <div className={styles.ticketTagline}>{cat.tagline}</div>
                </Link>
              ))}
            </div>
          </section>
        </>
      )}
    </main>
  );
}