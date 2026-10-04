"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import styles from "./QuizRunner.module.css";
import { supabase } from "@/lib/supabaseClient";

const LETTERS = ["A", "B", "C", "D"];
const QUESTION_MS = 18000; // 18 seconds per question
const TICK_MS = 100;
const RADIUS = 33;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

// Stops the camera (stashed on window by ProctoringCheck) and exits fullscreen.
// Safe to call multiple times / when nothing is active.
function releaseProctoring() {
  try {
    if (typeof window !== "undefined" && window.__quizMediaStream) {
      window.__quizMediaStream.getTracks().forEach((t) => t.stop());
      window.__quizMediaStream = null;
    }
    if (typeof document !== "undefined") {
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      } else if (document.webkitFullscreenElement && document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      }
    }
  } catch (err) {
    console.error("Error releasing camera/fullscreen:", err);
  }
}

export default function QuizRunner({ category }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const userId = searchParams.get("userId");

  const questions = category?.questions || [];
  const total = questions.length;

  const [phase, setPhase] = useState("intro"); // intro | playing | result
  const [qIndex, setQIndex] = useState(0);
  const [selected, setSelected] = useState(null); // null | -1 (timeout) | index
  const [locked, setLocked] = useState(false);
  const [timeLeft, setTimeLeft] = useState(QUESTION_MS);
  const [history, setHistory] = useState([]); // [{ questionId, selectedIndex, correct: bool }]
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(""); // NEW: surfaces real DB errors instead of hiding them

  const intervalRef = useRef(null);
  const advanceTimeoutRef = useRef(null);
  const lockedRef = useRef(false);
  const releaseTimerRef = useRef(null);
  const [gate, setGate] = useState("checking"); // checking | ok | blocked
  const historyRef = useRef([]); // source of truth for answers (avoids side effects in state updaters)

  const current = questions[qIndex];

  // Helper to clear timers
  function clearTimers() {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (advanceTimeoutRef.current) clearTimeout(advanceTimeoutRef.current);
  }

  // Calculate score and submit to Supabase — NOW actually checks the error
  async function finishQuiz(finalHistory) {
    setIsSubmitting(true);
    const finalScore = finalHistory.filter((h) => h.correct).length;

    try {
      if (!userId) {
        console.warn("No userId in URL — skipping submission write.");
      } else {
        const { error } = await supabase.from("quiz_submissions").insert([
          {
            user_id: userId,
            category_slug: category.slug,
            score: finalScore,
            total_questions: total,
            answers: finalHistory,
          },
        ]);

        if (error) {
          // THIS is what was being swallowed before — now it's visible.
          console.error("Supabase insert error (quiz_submissions):", error);
          setSubmitError(
            "Your score couldn't be saved (" + error.message + "). Please tell the organizers."
          );
        }
      }
    } catch (err) {
      console.error("Error submitting quiz:", err);
      setSubmitError("Your score couldn't be saved. Please tell the organizers.");
    } finally {
      setIsSubmitting(false);
      setPhase("result");
    }
  }

  function goNext(currentHistory) {
    if (qIndex + 1 >= total) {
      finishQuiz(currentHistory);
    } else {
      setQIndex(qIndex + 1);
    }
  }

  // Lock answer selection without revealing correct/incorrect feedback
  function lockAnswer(optionIndex) {
    if (lockedRef.current) return;
    lockedRef.current = true;
    setLocked(true);
    setSelected(optionIndex);

    if (intervalRef.current) clearInterval(intervalRef.current);

    const isCorrect = optionIndex === current?.answer;
    const newRecord = {
      questionId: current?.id || qIndex,
      selectedIndex: optionIndex,
      correct: isCorrect,
    };

    // Compute the new history OUTSIDE the state updater so the timeout is
    // scheduled exactly once (updaters run twice in React Strict Mode).
    const updatedHistory = [...historyRef.current, newRecord];
    historyRef.current = updatedHistory;
    setHistory(updatedHistory);

    if (advanceTimeoutRef.current) clearTimeout(advanceTimeoutRef.current);
    advanceTimeoutRef.current = setTimeout(() => {
      goNext(updatedHistory);
    }, 1200);
  }

  // Drive the countdown for the active question
  useEffect(() => {
    if (phase !== "playing") return;

    const initTimer = setTimeout(() => {
      setTimeLeft(QUESTION_MS);
      setLocked(false);
      setSelected(null);
      lockedRef.current = false;
    }, 0);

    const startedAt = Date.now();
    intervalRef.current = setInterval(() => {
      const remaining = QUESTION_MS - (Date.now() - startedAt);
      if (remaining <= 0) {
        setTimeLeft(0);
        clearInterval(intervalRef.current);
        lockAnswer(-1); // Auto-submit on timeout
      } else {
        setTimeLeft(remaining);
      }
    }, TICK_MS);

    return () => {
      clearTimeout(initTimer);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, qIndex]);

  // Release camera + fullscreen when the quiz page is really left (back button,
  // closing tab, etc). The release is deferred by one tick so React Strict Mode's
  // simulated unmount/remount in dev doesn't kill the camera + fullscreen on arrival.
  useEffect(() => {
    if (releaseTimerRef.current) {
      clearTimeout(releaseTimerRef.current);
      releaseTimerRef.current = null;
    }
    return () => {
      clearTimers();
      releaseTimerRef.current = setTimeout(releaseProctoring, 0);
    };
  }, []);

  // Guard: the quiz must be entered through registration + proctoring check.
  // Opening the URL directly / refreshing lands here without camera or fullscreen.
  useEffect(() => {
    const t = setTimeout(() => {
      const stream = typeof window !== "undefined" ? window.__quizMediaStream : null;
      const camOk = !!stream && stream.getTracks().some((tr) => tr.readyState === "live");
      const fsOk = !!(document.fullscreenElement || document.webkitFullscreenElement);
      setGate(userId && camOk && fsOk ? "ok" : "blocked");
    }, 0);
    return () => clearTimeout(t);
  }, [userId]);

  function start() {
    historyRef.current = [];
    setHistory([]);
    setQIndex(0);
    setPhase("playing");
  }

  function goHome() {
    releaseProctoring();
    router.push("/");
  }

  const catStyle = { "--cat-color": category?.color || "#3b82f6" };

  if (gate === "checking") {
    return <main className={styles.stage} style={catStyle} />;
  }

  if (gate === "blocked") {
    return (
      <main className={styles.stage} style={catStyle}>
        <div style={{ textAlign: "center", padding: "60px 20px", color: "#fff" }}>
          <h1 style={{ color: "#fbbf24", fontSize: "2rem", marginBottom: "16px", fontWeight: "bold" }}>
            Verification Required
          </h1>
          <p style={{ color: "#9ca3af", marginBottom: "24px", maxWidth: "480px", marginLeft: "auto", marginRight: "auto" }}>
            Camera and full-screen mode must be active to attempt the quiz. Please go back,
            register and complete the system check, then pick your category.
          </p>
          <button
            onClick={goHome}
            style={{
              background: "#fbbf24",
              color: "#0f172a",
              padding: "14px 28px",
              fontSize: "1rem",
              fontWeight: "bold",
              borderRadius: "8px",
              border: "none",
              cursor: "pointer",
            }}
          >
            Go to Home Page
          </button>
        </div>
      </main>
    );
  }

  // FINAL COMPLETED SCREEN
  if (phase === "result") {
    return (
      <main className={styles.stage} style={catStyle}>
        <div style={{ textAlign: "center", padding: "60px 20px", color: "#fff" }}>
          <h1
            style={{
              color: "#fbbf24",
              fontSize: "2.4rem",
              marginBottom: "16px",
              fontWeight: "bold",
            }}
          >
            Thank You for Attempting!
          </h1>
          <p style={{ color: "#9ca3af", marginBottom: "16px", fontSize: "1.1rem" }}>
            Your responses have been recorded successfully.
          </p>

          {submitError && (
            <p
              style={{
                color: "#fca5a5",
                background: "rgba(239,68,68,0.12)",
                border: "1px solid #ef4444",
                borderRadius: "8px",
                padding: "10px 16px",
                marginBottom: "24px",
                fontSize: "0.95rem",
                maxWidth: "480px",
                marginLeft: "auto",
                marginRight: "auto",
              }}
            >
              {submitError}
            </p>
          )}

          <button
            onClick={goHome}
            style={{
              background: "#fbbf24",
              color: "#0f172a",
              padding: "14px 28px",
              fontSize: "1rem",
              fontWeight: "bold",
              borderRadius: "8px",
              border: "none",
              cursor: "pointer",
              boxShadow: "0 4px 14px rgba(251, 191, 36, 0.4)",
            }}
          >
            Return to Home Page
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.stage} style={catStyle}>
      <div className={styles.topBar}>
        <Link href="/" className={styles.exit} onClick={releaseProctoring}>
          ← Exit Quiz
        </Link>
        <span className={styles.categoryTag}>{category?.name}</span>
      </div>

      {phase === "intro" && (
        <div className={styles.introCard}>
          <span className={styles.introTicket}>{category?.ticketNumber}</span>
          <h1 className={styles.introTitle}>{category?.name}</h1>
          <p className={styles.introRules}>
            {total} questions. 18 seconds on the clock for each one. Pick an
            answer before the timer runs out — no second guesses or going back once locked.
          </p>
          <button className={styles.startBtn} onClick={start}>
            Start Test
          </button>
        </div>
      )}

      {phase === "playing" && current && (
        <>
          <div className={styles.progressRow}>
            {questions.map((_, i) => {
              const filled = i < qIndex || (i === qIndex && locked);
              return (
                <div key={i} className={styles.progressBulb}>
                  <div
                    className={styles.progressBulbFill}
                    style={{ width: filled ? "100%" : "0%" }}
                  />
                </div>
              );
            })}
          </div>

          <div className={styles.panel}>
            <div className={styles.timerWrap}>
              <svg width="76" height="76" className={styles.timerSvg}>
                <circle
                  className={styles.timerTrack}
                  cx="38"
                  cy="38"
                  r={RADIUS}
                />
                <circle
                  className={styles.timerFill}
                  cx="38"
                  cy="38"
                  r={RADIUS}
                  strokeDasharray={CIRCUMFERENCE}
                  strokeDashoffset={
                    CIRCUMFERENCE * (1 - timeLeft / QUESTION_MS)
                  }
                  style={
                    timeLeft < 5000 ? { stroke: "var(--coral)" } : undefined
                  }
                />
              </svg>
              <span className={styles.timerNum}>
                {Math.ceil(timeLeft / 1000)}
              </span>
            </div>

            <p className={styles.qCount}>
              Question {qIndex + 1} of {total}
            </p>
            <h2 className={styles.question}>{current.q}</h2>

            <div className={styles.options}>
              {current.options.map((opt, i) => {
                let cls = styles.option;
                if (locked && i === selected) {
                  cls += " " + styles.optionSelected;
                }
                return (
                  <button
                    key={i}
                    className={cls}
                    disabled={locked || isSubmitting}
                    onClick={() => lockAnswer(i)}
                  >
                    <span className={styles.letter}>{LETTERS[i]}</span>
                    <span>{opt}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </main>
  );
}