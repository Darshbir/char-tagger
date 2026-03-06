"use client";

import type { DriveExportResultSummary } from "@/lib/driveExport";

type DriveExportResultsProps = {
  summary: DriveExportResultSummary;
  onBack: () => void;
  onNewScan: () => void;
  onCopyLink: (id: string, url: string, label: string) => void | Promise<void>;
  copiedLinkId: string | null;
  copyToast: string | null;
};

function CopyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

export function DriveExportResults({
  summary,
  onBack,
  onNewScan,
  onCopyLink,
  copiedLinkId,
  copyToast,
}: DriveExportResultsProps) {
  return (
    <div className="tt-results-wrap">
      <div className="tt-res-header">
        <div>
          <div className="tt-res-title">
            <em>{summary.characters.length}</em> shareable folder{summary.characters.length === 1 ? "" : "s"} ready
          </div>
        </div>
        <div className="tt-res-meta">
          {summary.uploadedCount} original upload{summary.uploadedCount === 1 ? "" : "s"} · {summary.shortcutCount} shortcut{summary.shortcutCount === 1 ? "" : "s"}
        </div>
      </div>

      <div className="tt-summary-bar">
        <div className="tt-sum-item">
          <div className="tt-sum-n">{summary.characters.length}</div>
          <div className="tt-sum-l">Folders shared</div>
        </div>
        <div className="tt-sum-div" />
        <div className="tt-sum-item">
          <div className="tt-sum-n">{summary.uploadedCount}</div>
          <div className="tt-sum-l">Master uploads</div>
        </div>
        <div className="tt-sum-div" />
        <div className="tt-sum-item">
          <div className="tt-sum-n">{summary.shortcutCount}</div>
          <div className="tt-sum-l">Shortcuts made</div>
        </div>
        <button type="button" className="tt-btn-new-scan" onClick={onBack}>
          Back to results
        </button>
        <button type="button" className="tt-btn-new-scan" onClick={onNewScan}>
          New scan
        </button>
      </div>

      <div className="mx-auto mt-6 w-full max-w-6xl px-2 pb-10">
        <div className="rounded-[28px] border border-[var(--border2)] bg-[color:color-mix(in_srgb,var(--surface)_88%,transparent)] p-6 shadow-[0_18px_52px_var(--shadow2)]">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="font-[DM_Mono] text-[0.72rem] uppercase tracking-[0.22em] text-[var(--text3)]">Mega folder</div>
              <h2 className="mt-2 font-['Playfair_Display'] text-[1.8rem] text-[var(--text)]">All photos folder</h2>
              <p className="mt-1 max-w-2xl text-[0.95rem] text-[var(--text2)]">
                This folder contains the full uploaded set. Every character folder points back here using Drive shortcuts.
              </p>
            </div>
            <button
              type="button"
              className={`tt-copy-link-btn ${copiedLinkId === summary.allFolder.id ? "tt-copy-link-btn--copied" : ""}`}
              onClick={() => void onCopyLink(summary.allFolder.id, summary.allFolder.url, "All folder")}
            >
              <CopyIcon />
              Copy All folder link
            </button>
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {summary.characters.map((character) => (
            <div
              key={character.id}
              className="rounded-[26px] border border-[var(--border2)] bg-[color:color-mix(in_srgb,var(--surface)_88%,transparent)] p-5 shadow-[0_12px_38px_var(--shadow)]"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="font-['Playfair_Display'] text-[1.3rem] text-[var(--text)]">{character.name}</div>
                  <div className="mt-1 text-[0.84rem] text-[var(--text2)]">{character.fileCount} photo{character.fileCount === 1 ? "" : "s"}</div>
                </div>
                <button
                  type="button"
                  className={`tt-copy-link-btn ${copiedLinkId === character.id ? "tt-copy-link-btn--copied" : ""}`}
                  onClick={() => void onCopyLink(character.id, character.url, character.name)}
                >
                  <CopyIcon />
                  Copy link
                </button>
              </div>
              <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--surface2)] px-3 py-2 font-[DM_Mono] text-[0.73rem] text-[var(--text3)]">
                Anyone with the link can view
              </div>
            </div>
          ))}
        </div>
      </div>

      {copyToast && (
        <div className="pointer-events-none fixed bottom-6 right-6 z-[60] rounded-full border border-emerald-500/25 bg-emerald-500/12 px-4 py-2 text-sm font-medium text-emerald-100 shadow-[0_16px_30px_rgba(16,185,129,0.18)] backdrop-blur-sm">
          {copyToast}
        </div>
      )}
    </div>
  );
}
