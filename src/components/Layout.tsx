"use client";

import { useEffect, useState } from "react";

export function Layout({ children }: { children: React.ReactNode }) {
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
        <div className="tt-logo">
          Trip<em>Tag</em>
        </div>
        <div className="tt-status-pill">
          <div className="tt-status-dot" />
          <span>const status = &quot;🔒 fully_local&quot;</span>
        </div>
        <button
          className="tt-theme-btn"
          onClick={toggleTheme}
          aria-label="Toggle theme"
          suppressHydrationWarning
        >
          {mounted ? (isDark ? "☀️" : "🌙") : "🌙"}
        </button>
      </nav>
      {children}
    </div>
  );
}

