"use client";

import { useEffect, useRef } from "react";

interface Orb {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  alpha: number;
  hue: number;
  phase: number;
  phaseSpeed: number;
}

interface ParticleBackgroundProps {
  visible?: boolean;
  /** Number of orbs. Default 52. */
  count?: number;
}

export function ParticleBackground({ visible = true, count = 52 }: ParticleBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: 0, y: 0 });
  const orbsRef = useRef<Orb[]>([]);
  const rafRef = useRef<number>(0);
  const mountedRef = useRef(false);

  useEffect(() => {
    if (!visible) return;
    if (mountedRef.current) return; // guard strict-mode double-invoke
    mountedRef.current = true;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    // Spawn orbs distributed across the canvas
    orbsRef.current = Array.from({ length: count }, (_, i) => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      vx: (Math.random() - 0.5) * 0.22,
      vy: (Math.random() - 0.5) * 0.16,
      r: Math.random() * 110 + 45,
      // Alternate very faint & slightly visible for depth
      alpha: i % 3 === 0 ? Math.random() * 0.08 + 0.05 : Math.random() * 0.05 + 0.02,
      // Warm amber-orange spectrum 18-55 degrees
      hue: Math.random() * 37 + 18,
      phase: Math.random() * Math.PI * 2,
      phaseSpeed: 0.003 + Math.random() * 0.004,
    }));

    const onMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener("mousemove", onMouseMove);

    let t = 0;
    const W = () => canvas.width;
    const H = () => canvas.height;

    const frame = () => {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, W(), H());
      t += 1;
      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;
      const cx = W() / 2;
      const cy = H() / 2;
      const parallaxX = (mx - cx) / cx; // -1..1
      const parallaxY = (my - cy) / cy;

      for (const orb of orbsRef.current) {
        orb.phase += orb.phaseSpeed;
        // Sinusoidal drift adds organic movement
        orb.x += orb.vx + Math.cos(orb.phase) * 0.09;
        orb.y += orb.vy + Math.sin(orb.phase * 0.73) * 0.07;
        // Gentle mouse parallax — larger orbs move slightly more
        orb.x += parallaxX * (orb.r / 160) * 0.12;
        orb.y += parallaxY * (orb.r / 160) * 0.09;

        // Seamless torus wrap
        if (orb.x < -orb.r) orb.x = W() + orb.r;
        else if (orb.x > W() + orb.r) orb.x = -orb.r;
        if (orb.y < -orb.r) orb.y = H() + orb.r;
        else if (orb.y > H() + orb.r) orb.y = -orb.r;

        // Soft radial gradient – glow blob
        const g = ctx.createRadialGradient(orb.x, orb.y, 0, orb.x, orb.y, orb.r);
        g.addColorStop(0, `hsla(${orb.hue}, 85%, 67%, ${orb.alpha})`);
        g.addColorStop(0.5, `hsla(${orb.hue + 8}, 72%, 58%, ${orb.alpha * 0.5})`);
        g.addColorStop(1, `hsla(${orb.hue}, 66%, 52%, 0)`);
        ctx.beginPath();
        ctx.arc(orb.x, orb.y, orb.r, 0, Math.PI * 2);
        ctx.fillStyle = g;
        ctx.fill();
      }

      rafRef.current = requestAnimationFrame(frame);
    };

    frame();

    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMouseMove);
      cancelAnimationFrame(rafRef.current);
      mountedRef.current = false;
    };
  }, [visible, count]);

  if (!visible) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      style={{
        position: "fixed",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 0,
        opacity: 1,
      }}
    />
  );
}
