"use client";

import { useEffect, useState } from "react";

interface FullImageThumbnailProps {
  file: File;
  size?: number;
  alt?: string;
  className?: string;
}

/** Renders the full image (no crop) as a square thumbnail. Used for images with no detected faces. */
export function FullImageThumbnail({
  file,
  size = 56,
  alt = "",
  className = "",
}: FullImageThumbnailProps) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  if (!objectUrl) return <div className={`rounded bg-gray-200 dark:bg-gray-700 ${className}`} style={{ width: size, height: size }} />;

  return (
    <img
      src={objectUrl}
      alt={alt}
      className={`rounded object-cover bg-gray-200 dark:bg-gray-700 ${className}`}
      width={size}
      height={size}
      style={{ width: size, height: size }}
    />
  );
}
