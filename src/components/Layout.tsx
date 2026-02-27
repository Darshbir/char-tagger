"use client";

import { useEffect, useState } from "react";

export function Layout({ children, onLogoClick }: { children: React.ReactNode; onLogoClick?: () => void }) {
  const [isDark, setIsDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem("tt-theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const dark = stored ? stored === "dark" : prefersDark;
    setIsDark(dark);
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
  }, []);

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.setAttribute("data-theme", next ? "dark" : "light");
    localStorage.setItem("tt-theme", next ? "dark" : "light");
  };

  return (
    <div style={{ minHeight: "100dvh", position: "relative" }}>
      <nav className="tt-nav">
        <button
          type="button"
          className="tt-logo tt-logo-btn"
          onClick={onLogoClick}
          aria-label="Go to home"
        >
          Trip<em>Tag</em>
        </button>
        <div className="tt-status-pill">
          <div className="tt-status-dot" />
          {/* lock icon */}
          <svg width="9" height="10" viewBox="0 0 12 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ opacity: 0.7, flexShrink: 0 }}>
            <rect x="1" y="6" width="10" height="7" rx="2" />
            <path d="M4 6V4a2 2 0 0 1 4 0v2" />
          </svg>
          <span>fully_local</span>
        </div>
        <button
          className="tt-theme-btn"
          onClick={toggleTheme}
          aria-label="Toggle theme"
          suppressHydrationWarning
        >
          {mounted ? (
            isDark ? (
              /* sun */
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" />
                <line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" />
                <line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            ) : (
              /* moon */
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          )}
        </button>
      </nav>
      {children}
    </div>
  );
}

