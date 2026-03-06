"use client";

import { useCallback, useEffect } from "react";
import type { DriveExportManifest, DriveQuotaSummary } from "@/lib/driveExport";
import { formatBytes } from "@/lib/driveExport";

type DriveExportModalProps = {
  isOpen: boolean;
  manifest: DriveExportManifest | null;
  nameDrafts: Record<number, string>;
  onNameChange: (clusterId: number, value: string) => void;
  onClose: () => void;
  onConnectDrive: () => void | Promise<void>;
  onExport: () => void | Promise<void>;
  authStatus: "loading" | "authenticated" | "unauthenticated";
  authBusy: boolean;
  quota: DriveQuotaSummary | null;
  quotaLoading: boolean;
  quotaError: string | null;
  exportBusy: boolean;
  exportStatusMessage: string | null;
  exportError: string | null;
  exportSuccessMessage: string | null;
};

function quotaMessage(quota: DriveQuotaSummary | null, requiredBytes: number) {
  if (!quota) return null;
  if (quota.isUnlimited) {
    return {
      tone: "ok",
      text: "Drive quota looks open-ended for this account. Export should fit.",
    } as const;
  }
  if (quota.availableBytes == null) {
    return null;
  }
  return quota.availableBytes >= requiredBytes
    ? {
        tone: "ok",
        text: `Enough space detected: ${formatBytes(quota.availableBytes)} free.`,
      }
    : {
        tone: "warn",
        text: `Not enough free space: ${formatBytes(quota.availableBytes)} free vs ${formatBytes(requiredBytes)} needed.`,
      };
}

export function DriveExportModal({
  isOpen,
  manifest,
  nameDrafts,
  onNameChange,
  onClose,
  onConnectDrive,
  onExport,
  authStatus,
  authBusy,
  quota,
  quotaLoading,
  quotaError,
  exportBusy,
  exportStatusMessage,
  exportError,
  exportSuccessMessage,
}: DriveExportModalProps) {
  const handleEscape = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === "Escape" && !exportBusy) {
        onClose();
      }
    },
    [exportBusy, onClose]
  );

  useEffect(() => {
    if (!isOpen) return;
    document.addEventListener("keydown", handleEscape);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [handleEscape, isOpen]);

  if (!isOpen || !manifest) return null;

  const requiredBytes = manifest.totalBytes;
  const quotaStatus = quotaMessage(quota, requiredBytes);
  const canAttemptExport = authStatus === "authenticated" && !exportBusy && (!quota || quota.isUnlimited || quota.availableBytes == null || quota.availableBytes >= requiredBytes);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Drive export review">
      <button type="button" className="absolute inset-0 bg-black/70 backdrop-blur-sm" aria-label="Close export review" onClick={() => { if (!exportBusy) onClose(); }} />

      <div className="relative z-10 flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#120f0d] text-[#f7efe4] shadow-2xl">
        <div className="border-b border-white/10 px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-[0.28em] text-[#d7b590]">Drive export review</div>
              <h2 className="mt-2 text-2xl font-semibold">Save one master set, then shortcut into character folders</h2>
              <p className="mt-2 max-w-2xl text-sm text-[#d8c7b1]">
                We will upload every photo once into <strong>All</strong>, then create Google Drive shortcuts inside each character folder so storage is not duplicated.
              </p>
            </div>
            <button type="button" onClick={() => { if (!exportBusy) onClose(); }} className="rounded-lg border border-white/10 px-3 py-2 text-sm text-[#e8d8c0] transition hover:border-white/20 hover:bg-white/5">
              Close
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-[#6f5438]/50 bg-[#1a1512] p-4">
              <div className="text-xs uppercase tracking-[0.24em] text-[#c89f71]">Storage estimate</div>
              <div className="mt-2 text-3xl font-semibold">{formatBytes(requiredBytes)}</div>
              <p className="mt-2 text-sm text-[#d8c7b1]">
                Based on {manifest.allImageIds.length} original photo{manifest.allImageIds.length === 1 ? "" : "s"}. Shortcut metadata is tiny and not included here.
              </p>
              {quotaLoading ? (
                <div className="mt-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-[#e8d8c0]">Checking available Drive space…</div>
              ) : quotaStatus ? (
                <div className={`mt-3 rounded-xl px-3 py-2 text-sm ${quotaStatus.tone === "ok" ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-200" : "border border-amber-500/30 bg-amber-500/10 text-amber-100"}`}>
                  {quotaStatus.text}
                </div>
              ) : quotaError ? (
                <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">{quotaError}</div>
              ) : authStatus !== "authenticated" ? (
                <div className="mt-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-[#d8c7b1]">Connect Google Drive to check free space before export.</div>
              ) : null}
              {quota && (
                <dl className="mt-4 space-y-2 text-sm text-[#e8d8c0]">
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-[#c9b39a]">Used</dt>
                    <dd>{formatBytes(quota.usageBytes)}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-[#c9b39a]">Available</dt>
                    <dd>{quota.isUnlimited ? "Unlimited / unavailable" : formatBytes(quota.availableBytes)}</dd>
                  </div>
                </dl>
              )}
            </div>

            <div className="rounded-2xl border border-[#6f5438]/50 bg-[#1a1512] p-4">
              <div className="text-xs uppercase tracking-[0.24em] text-[#c89f71]">Folder layout</div>
              <ul className="mt-3 space-y-2 text-sm text-[#e8d8c0]">
                <li>• One root export folder</li>
                <li>• <strong>All</strong> contains the original uploads</li>
                <li>• Each character folder contains shortcuts only</li>
                <li>• Duplicate folder names auto-suffix after sanitization</li>
              </ul>
              <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-[#d8c7b1]">
                <div className="font-medium text-[#f7efe4]">Characters exporting</div>
                <div className="mt-1">{manifest.characters.length} folder{manifest.characters.length === 1 ? "" : "s"} · {manifest.characters.reduce((sum, entry) => sum + entry.fileCount, 0)} shortcut{manifest.characters.reduce((sum, entry) => sum + entry.fileCount, 0) === 1 ? "" : "s"}</div>
              </div>
            </div>
          </div>

          {manifest.needsReview.length > 0 && (
            <div className="mt-5 rounded-2xl border border-[#6f5438]/50 bg-[#1a1512] p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-xs uppercase tracking-[0.24em] text-[#c89f71]">Name review required</div>
                  <h3 className="mt-1 text-lg font-semibold">Review these character names before export</h3>
                </div>
                <div className="rounded-full border border-amber-400/25 bg-amber-400/10 px-3 py-1 text-xs text-amber-100">
                  {manifest.needsReview.length} pending
                </div>
              </div>
              <div className="mt-4 space-y-3">
                {manifest.needsReview.map((item) => (
                  <label key={item.clusterId} className="block rounded-xl border border-white/10 bg-black/20 p-3">
                    <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                      <span className="font-medium text-[#f7efe4]">Cluster {item.clusterId}</span>
                      <span className="text-[#c9b39a]">{item.fileCount} photo{item.fileCount === 1 ? "" : "s"}</span>
                    </div>
                    <input
                      type="text"
                      value={nameDrafts[item.clusterId] ?? item.currentName}
                      onChange={(event) => onNameChange(item.clusterId, event.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-[#221b17] px-3 py-2 text-sm text-[#f7efe4] outline-none transition focus:border-[#c89f71]"
                      placeholder="Name this character"
                    />
                    <div className="mt-2 text-xs text-[#c9b39a]">Folder preview: {item.suggestedFolderName}</div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {manifest.characters.length > 0 && (
            <div className="mt-5 rounded-2xl border border-[#6f5438]/50 bg-[#1a1512] p-4">
              <div className="text-xs uppercase tracking-[0.24em] text-[#c89f71]">Export folders</div>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {manifest.characters.map((entry) => (
                  <div key={entry.clusterId} className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-[#e8d8c0]">
                    <div className="font-medium text-[#f7efe4]">{entry.folderName}</div>
                    <div className="mt-1 text-[#c9b39a]">{entry.fileCount} shortcut{entry.fileCount === 1 ? "" : "s"}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {exportError && (
            <div className="mt-5 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">{exportError}</div>
          )}
          {exportStatusMessage && !exportError && (
            <div className="mt-5 rounded-xl border border-sky-500/30 bg-sky-500/10 px-4 py-3 text-sm text-sky-100">{exportStatusMessage}</div>
          )}
          {exportSuccessMessage && (
            <div className="mt-5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{exportSuccessMessage}</div>
          )}
        </div>

        <div className="border-t border-white/10 px-6 py-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="text-sm text-[#c9b39a]">
              {authStatus === "authenticated"
                ? "Ready to upload originals to All and create shortcuts per character."
                : "Connect Drive first to finish export."}
            </div>
            <div className="flex flex-wrap justify-end gap-3">
              {authStatus !== "authenticated" && (
                <button type="button" onClick={() => void onConnectDrive()} disabled={authBusy || exportBusy} className="rounded-xl border border-[#c89f71]/50 px-4 py-2 text-sm font-medium text-[#f7efe4] transition hover:bg-[#c89f71]/10 disabled:cursor-not-allowed disabled:opacity-60">
                  {authBusy ? "Connecting…" : "Connect Drive"}
                </button>
              )}
              <button type="button" onClick={() => void onExport()} disabled={!canAttemptExport} className="rounded-xl bg-[#c88952] px-4 py-2 text-sm font-semibold text-[#120f0d] transition hover:bg-[#d99a65] disabled:cursor-not-allowed disabled:opacity-60">
                {exportBusy ? "Exporting…" : "Export to Drive"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
