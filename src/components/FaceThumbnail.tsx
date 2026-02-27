"use client";

import { memo, useEffect, useRef, useState } from "react";
import type { Bbox } from "@/lib/types";

interface FaceThumbnailProps {
  file: File;
  bbox: Bbox;
  size?: number;
  alt?: string;
  className?: string;
}

/** Renders a cropped face from an image file using canvas (bbox in image coordinates). */
export const FaceThumbnail = memo(function FaceThumbnail({ file, bbox, size = 64, alt = "", className = "" }: FaceThumbnailProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    if (!objectUrl || !canvasRef.current) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const dpr = window.devicePixelRatio ?? 1;
      const w = Math.round(size * dpr);
      const h = Math.round(size * dpr);
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const { x, y, width, height } = bbox;
      ctx.drawImage(img, x, y, width, height, 0, 0, w, h);
      setLoaded(true);
    };
    img.onerror = () => setLoaded(false);
    img.src = objectUrl;
  }, [objectUrl, bbox, size]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      draggable={false}
      onDragStart={(e) => e.preventDefault()}
      aria-label={alt || undefined}
      className={`rounded object-cover bg-gray-200 dark:bg-gray-700 ${className}`}
      style={{ width: size, height: size, display: "block", pointerEvents: "none" }}
    />
  );
});
