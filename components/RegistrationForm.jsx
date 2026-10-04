"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import styles from "./RegistrationForm.module.css";

export default function RegistrationForm({ onStartQuiz }) {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    rollNumber: "",
    branch: "",
    mobileNumber: "",
  });

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const cleanEmail = formData.email.trim().toLowerCase();
    const cleanMobile = formData.mobileNumber.trim();
    const cleanName = formData.name.trim();

    if (!cleanEmail.endsWith("@thapar.edu")) {
      setError("Please use your official Thapar email ending with @thapar.edu");
      return;
    }

    setLoading(true);

    try {
      // 1. Check if user credentials already exist in Supabase
      const { data: existingUser, error: checkError } = await supabase
        .from("users")
        .select("id, email, mobile_number, name")
        .or(`email.eq.${cleanEmail},mobile_number.eq.${cleanMobile},name.eq.${cleanName}`)
        .maybeSingle();

      if (checkError) throw checkError;

      if (existingUser) {
        // 2. Check if this existing user has already recorded a quiz submission
        const { data: submission, error: subError } = await supabase
          .from("quiz_submissions")
          .select("id")
          .eq("user_id", existingUser.id)
          .maybeSingle();

        if (subError) throw subError;

        if (submission) {
          setError("⚠️ Already Attempted! A submission with these details already exists.");
          setLoading(false);
          return;
        }

        // If registered previously but hasn't submitted yet, continue with existing user
        onStartQuiz(existingUser);
        return;
      }

      // 3. Upsert / Register new user if no match found
      const { data: newUser, error: dbError } = await supabase
        .from("users")
        .upsert(
          [
            {
              name: cleanName,
              email: cleanEmail,
              roll_number: formData.rollNumber.trim(),
              branch: formData.branch.trim(),
              mobile_number: cleanMobile,
            },
          ],
          { onConflict: "email" }
        )
        .select()
        .single();

      if (dbError) throw dbError;

      onStartQuiz(newUser);
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.card}>
      <h2 className={styles.title}>Student Registration</h2>
      <p className={styles.subtitle}>Enter your details to enter the quiz round</p>

      {error && <div className={styles.errorBox}>{error}</div>}

      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.fieldGroup}>
          <label className={styles.label}>Full Name</label>
          <input
            type="text"
            name="name"
            required
            value={formData.name}
            onChange={handleChange}
            placeholder="John Doe"
            className={styles.input}
          />
        </div>

        <div className={styles.fieldGroup}>
          <label className={styles.label}>Thapar Email ID</label>
          <input
            type="email"
            name="email"
            required
            value={formData.email}
            onChange={handleChange}
            placeholder="student@thapar.edu"
            className={styles.input}
          />
        </div>

        <div className={styles.row}>
          <div className={styles.fieldGroup}>
            <label className={styles.label}>Roll Number</label>
            <input
              type="text"
              name="rollNumber"
              required
              value={formData.rollNumber}
              onChange={handleChange}
              placeholder="102xxxxxx"
              className={styles.input}
            />
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>Branch</label>
            <input
              type="text"
              name="branch"
              required
              value={formData.branch}
              onChange={handleChange}
              placeholder="COE, ENC, etc."
              className={styles.input}
            />
          </div>
        </div>

        <div className={styles.fieldGroup}>
          <label className={styles.label}>Mobile Number</label>
          <input
            type="tel"
            name="mobileNumber"
            required
            pattern="[0-9]{10}"
            value={formData.mobileNumber}
            onChange={handleChange}
            placeholder="9876543210"
            className={styles.input}
          />
        </div>

        <button type="submit" disabled={loading} className={styles.submitBtn}>
          {loading ? "Verifying..." : "Start Quiz"}
        </button>
      </form>
    </div>
  );
}