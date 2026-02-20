"use client";

import { useCallback, useState } from "react";
import { ImagePreviewModal } from "./ImagePreviewModal";

export interface UploadZoneProps {
  /** When provided, use controlled mode (files + onFilesChange). */
  files?: File[];
  onFilesChange?: (files: File[]) => void;
  /** When true, show Process section is handled by parent; hide the "Processing in Phase 2" note. */
  showProcessHint?: boolean;
  /** Optional slot for action buttons (e.g. Process) below the file list */
  actions?: React.ReactNode;
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
      const array = Array.from(fileList);
      const images = array.filter((f) => f.type.startsWith("image/"));
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
    (index: number) => {
      setFiles((prev) => prev.filter((_, i) => i !== index));
    },
    [setFiles]
  );

  return (
    <div className="w-full max-w-xl space-y-4">
      <label
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-8 py-12 transition-colors ${
          isDragging
            ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30"
            : "border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500"
        }`}
      >
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={onInputChange}
          className="hidden"
        />
        <span className="mb-1 text-lg font-medium">Upload photos</span>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          Drag and drop or click to select images
        </span>
      </label>

      {files.length > 0 && (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <p className="mb-2 text-sm font-medium">
            {files.length} image{files.length !== 1 ? "s" : ""} selected
          </p>
          <ul className="flex flex-wrap gap-2">
            {files.map((file, i) => (
              <li
                key={`${file.name}-${i}`}
                className="flex items-center gap-2 rounded bg-gray-100 dark:bg-gray-800 px-2 py-1 text-sm"
              >
                <button
                  type="button"
                  onClick={() => setPreviewIndex(i)}
                  className="truncate max-w-[180px] text-left hover:underline focus:underline"
                  title={`View ${file.name}`}
                >
                  {file.name}
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(i);
                  }}
                  className="text-red-600 hover:text-red-700 dark:text-red-400"
                  aria-label={`Remove ${file.name}`}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
          {showProcessHint && (
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Click Process below to detect and group faces.
            </p>
          )}
          {actions != null && <div className="mt-3">{actions}</div>}
        </div>
      )}

      <ImagePreviewModal
        files={files}
        initialIndex={previewIndex ?? 0}
        isOpen={previewIndex !== null}
        onClose={() => setPreviewIndex(null)}
      />
    </div>
  );
}
