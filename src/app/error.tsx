"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface render errors to the console for debugging
    console.error("[TripTag] Unhandled render error:", error);
  }, [error]);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg, #FAF8F4)",
        padding: "2rem",
        fontFamily: "'DM Sans', system-ui, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: 460,
          width: "100%",
          background: "var(--surface, #fff)",
          border: "1px solid var(--border2, rgba(150,120,80,0.24))",
          borderRadius: 16,
          padding: "2.5rem 2rem",
          textAlign: "center",
          boxShadow: "0 4px 24px var(--shadow2, rgba(100,70,30,0.16))",
        }}
      >
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: "50%",
            background: "rgba(200,115,42,0.10)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 1.25rem",
          }}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--accent, #C8732A)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" strokeWidth="2.5" />
          </svg>
        </div>

        <h1
          style={{
            fontSize: "1.25rem",
            fontWeight: 600,
            color: "var(--text, #201A10)",
            marginBottom: "0.5rem",
            fontFamily: "'Playfair Display', Georgia, serif",
          }}
        >
          Something went wrong
        </h1>

        <p
          style={{
            fontSize: "0.875rem",
            color: "var(--text2, #6B5A40)",
            marginBottom: error.digest ? "0.5rem" : "1.75rem",
            lineHeight: 1.6,
          }}
        >
          TripTag encountered an unexpected error. Your photos were never
          uploaded — they always stay on your device.
        </p>

        {error.digest && (
          <p
            style={{
              fontSize: "0.72rem",
              color: "var(--text3, #9E8B72)",
              fontFamily: "'DM Mono', monospace",
              marginBottom: "1.75rem",
            }}
          >
            Error ID: {error.digest}
          </p>
        )}

        <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={reset}
            style={{
              background: "var(--accent, #C8732A)",
              color: "#fff",
              border: "none",
              borderRadius: 10,
              padding: "0.6rem 1.4rem",
              fontSize: "0.875rem",
              fontWeight: 500,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Try again
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              background: "var(--bg2, #F4F0EA)",
              color: "var(--text, #201A10)",
              border: "1px solid var(--border2, rgba(150,120,80,0.24))",
              borderRadius: 10,
              padding: "0.6rem 1.4rem",
              fontSize: "0.875rem",
              fontWeight: 500,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Reload page
          </button>
        </div>
      </div>
    </div>
  );
}
