"use client";

import { useCallback, useRef, useState } from "react";
import { ImagePreviewModal } from "./ImagePreviewModal";

export interface UploadZoneProps {
  files?: File[];
  onFilesChange?: (files: File[]) => void;
  showProcessHint?: boolean;
  actions?: React.ReactNode;
}

function FolderSVG() {
  return (
    <svg
      width="36"
      height="36"
      viewBox="0 0 24 24"
      fill="none"
      stroke="rgba(255,255,255,0.95)"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
      <line x1="12" y1="11" x2="12" y2="17" />
      <line x1="9" y1="14" x2="15" y2="14" />
    </svg>
  );
}

export function UploadZone({
  files: controlledFiles,
  onFilesChange,
  showProcessHint = true,
  actions,
}: UploadZoneProps) {
  const [internalFiles, setInternalFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isControlled = controlledFiles != null && onFilesChange != null;
  const files = isControlled ? controlledFiles : internalFiles;

  const setFiles = useCallback(
    (updater: File[] | ((prev: File[]) => File[])) => {
      const next = typeof updater === "function" ? updater(files) : updater;
      if (isControlled) onFilesChange!(next);
      else setInternalFiles(next);
    },
    [files, isControlled, onFilesChange]
  );

  const handleFiles = useCallback(
    (fileList: FileList | null) => {
      if (!fileList?.length) return;
      const images = Array.from(fileList).filter((f) => f.type.startsWith("image/"));
      setFiles((prev) => [...prev, ...images]);
    },
    [setFiles]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const onInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      handleFiles(e.target.files);
      e.target.value = "";
    },
    [handleFiles]
  );

  const removeFile = useCallback(
    (index: number) => setFiles((prev) => prev.filter((_, i) => i !== index)),
    [setFiles]
  );

  return (
    <div
      className={`tt-upload-card ${isDragging ? "tt-upload-card--drag" : ""}`}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onClick={(e) => {
        // Open file picker when clicking anywhere on the card except interactive children
        const target = e.target as HTMLElement;
        if (target.closest('button, a, .tt-file-pill, span[role="button"]')) return;
        fileInputRef.current?.click();
      }}
      style={{ cursor: "pointer" }}
    >
      {/* Icon */}
      <div className="tt-up-icon">
        <FolderSVG />
      </div>

      {/* Title + subtitle */}
      <div className="tt-up-title">Drop your trip folder</div>
      <div className="tt-up-sub">
        Drag &amp; drop a folder of photos, or click below to browse.
        <br />
        Everything stays 100% in your browser.
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={onInputChange}
        style={{ display: "none" }}
      />

      {/* Trigger button (also clickable via whole-card click above) */}
      <span
        className="tt-btn-go"
        style={{ cursor: "pointer" }}
        role="button"
        tabIndex={-1}
        onClick={(e) => {
          e.stopPropagation();
          fileInputRef.current?.click();
        }}
      >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
          Choose folder or photos
        </span>

      {/* File list */}
      {files.length > 0 && (
        <div className="tt-file-list">
          <div className="tt-file-count">
            {files.length} image{files.length !== 1 ? "s" : ""} selected
          </div>
          <div className="tt-file-pills">
            {files.map((file, i) => (
              <div key={`${file.name}-${i}`} className="tt-file-pill">
                <button
                  type="button"
                  className="tt-file-pill-name"
                  onClick={(e) => { e.stopPropagation(); setPreviewIndex(i); }}
                  title={`Preview ${file.name}`}
                >
                  {file.name}
                </button>
                <button
                  type="button"
                  className="tt-file-pill-rm"
                  onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                  aria-label={`Remove ${file.name}`}
                >
                  &times;
                </button>
              </div>
            ))}
          </div>
          {showProcessHint && files.length > 0 && (
            <p style={{ marginTop: "0.4rem", fontSize: "0.65rem", color: "var(--text3)", fontFamily: "'DM Mono', monospace" }}>
              &#x2193; Click &quot;Tag my trip&quot; below to start
            </p>
          )}
        </div>
      )}

      {/* Action slot (Process button lives here) */}
      {actions != null && (
        <div style={{ marginTop: "0.85rem", position: "relative", zIndex: 1 }}>
          {actions}
        </div>
      )}

      {/* Privacy note */}
      <div className="tt-pcode">
        <span className="tt-cm">{'// Your photos never leave this browser tab \u2014 ever'}</span>
        <br />
        <span style={{ color: "var(--green)" }}>&#x2713; </span>No account required to start
      </div>

      <ImagePreviewModal
        files={files}
        initialIndex={previewIndex ?? 0}
        isOpen={previewIndex !== null}
        onClose={() => setPreviewIndex(null)}
      />
    </div>
  );
}
