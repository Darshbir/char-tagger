"use client";

import { useEffect, useRef } from "react";
import type { PipelineProgress } from "@/lib/types";

type Phase = PipelineProgress["phase"];

/* ── Phase metadata ── */
const PHASE_META: Record<string, { icon: React.ReactNode; label: string }> = {
  loading: {
    icon: <DownloadSvg />,
    label: "Loading AI model (WASM)…",
  },
  detecting: {
    icon: <ScanSvg />,
    label: "Detecting faces…",
  },
  embedding: {
    icon: <EmbedSvg />,
    label: "Creating embeddings…",
  },
  clustering: {
    icon: <SparkSvg />,
    label: "Clustering people…",
  },
  done: {
    icon: <CheckSvg />,
    label: "Done!",
  },
  error: {
    icon: <WarnSvg />,
    label: "Something went wrong",
  },
  idle: {
    icon: <UploadSvg />,
    label: "Ready",
  },
};

/* ── Inline SVG icons ── */
function DownloadSvg() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ color: "rgba(255,255,255,0.9)", filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.25))" }}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}
function ScanSvg() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ color: "rgba(255,255,255,0.9)", filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.25))" }}>
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
      <line x1="11" y1="8" x2="11" y2="14" />
      <line x1="8" y1="11" x2="14" y2="11" />
    </svg>
  );
}
function EmbedSvg() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ color: "rgba(255,255,255,0.9)", filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.25))" }}>
      <path d="M2 12h20" />
      <path d="M12 2a10 10 0 0 1 0 20" />
      <path d="M12 2C8 2 4 6.5 4 12s4 10 8 10" />
    </svg>
  );
}
function SparkSvg() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ color: "rgba(255,255,255,0.9)", filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.25))" }}>
      <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" />
    </svg>
  );
}
function CheckSvg() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "rgba(255,255,255,0.9)", filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.25))" }}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
function WarnSvg() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ color: "rgba(255,200,200,0.9)" }}>
      <polygon points="10.29 3.86 1.82 18 22.18 18" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}
function UploadSvg() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ color: "rgba(255,255,255,0.9)", filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.25))" }}>
      <polyline points="16 16 12 12 8 16" />
      <line x1="12" y1="12" x2="12" y2="21" />
      <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
    </svg>
  );
}

/* ── Main component ── */
interface LiquidCanvasProps {
  phase: Phase;
}

export function LiquidCanvas({ phase }: LiquidCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // TypeScript-safe aliases for use inside requestAnimationFrame callback
    const c = canvas as HTMLCanvasElement;
    const x = ctx as CanvasRenderingContext2D;

    const blobs = [
      { x: 0.3, y: 0.6, r: 0.38, speed: 0.9, phase: 0 },
      { x: 0.7, y: 0.4, r: 0.32, speed: 1.1, phase: 2 },
      { x: 0.5, y: 0.7, r: 0.28, speed: 0.8, phase: 4 },
      { x: 0.5, y: 0.3, r: 0.22, speed: 1.3, phase: 1 },
    ];

    const lightCols: [number, number, number][] = [
      [200, 115, 42],
      [232, 160, 80],
      [212, 149, 106],
      [200, 160, 80],
    ];
    const darkCols: [number, number, number][] = [
      [224, 144, 74],
      [238, 176, 96],
      [208, 144, 96],
      [180, 120, 60],
    ];

    function getColors() {
      return document.documentElement.getAttribute("data-theme") === "dark"
        ? darkCols
        : lightCols;
    }

    function draw(ts: number) {
      const t = ts * 0.001;
      const W = (c.width = c.offsetWidth * (window.devicePixelRatio ?? 1));
      const H = (c.height = c.offsetHeight * (window.devicePixelRatio ?? 1));
      c.style.width = `${c.offsetWidth}px`;
      c.style.height = `${c.offsetHeight}px`;

      x.clearRect(0, 0, W, H);
      const cols = getColors();

      for (let i = 0; i < blobs.length; i++) {
        const b = blobs[i];
        const bx = (b.x + Math.sin(t * b.speed + b.phase) * 0.15) * W;
        const by = (b.y + Math.cos(t * b.speed * 0.8 + b.phase) * 0.12) * H;
        const br = b.r * Math.min(W, H) * (0.9 + 0.1 * Math.sin(t * b.speed * 1.3));
        const [r, g, bl] = cols[i % cols.length];
        const grad = x.createRadialGradient(bx, by, 0, bx, by, br);
        grad.addColorStop(0, `rgba(${r},${g},${bl},0.55)`);
        grad.addColorStop(0.5, `rgba(${r},${g},${bl},0.2)`);
        grad.addColorStop(1, `rgba(${r},${g},${bl},0)`);
        x.fillStyle = grad;
        x.beginPath();
        x.arc(bx, by, br, 0, Math.PI * 2);
        x.fill();
      }

      // Shimmer
      const shim = x.createLinearGradient(0, 0, W, H);
      shim.addColorStop(((Math.sin(t * 0.4) + 1) / 2) * 0.6, "rgba(255,220,160,0.04)");
      shim.addColorStop(
        ((Math.cos(t * 0.32) + 1) / 2) * 0.8 + 0.1,
        "rgba(255,180,80,0.06)"
      );
      shim.addColorStop(1, "rgba(0,0,0,0)");
      x.fillStyle = shim;
      x.fillRect(0, 0, W, H);

      rafRef.current = requestAnimationFrame(draw);
    }

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const meta = PHASE_META[phase] ?? PHASE_META.loading;

  return (
    <div className="tt-liquid-wrap">
      <canvas ref={canvasRef} className="tt-liquid-canvas" />
      <div className="tt-liq-label">
        {meta.icon}
        <div className="tt-liq-phase">{meta.label}</div>
      </div>
    </div>
  );
}
