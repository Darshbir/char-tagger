"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { UploadZone } from "@/components/UploadZone";
import { Layout } from "@/components/Layout";
import { ClusterResults } from "@/components/ClusterResults";
import { LiquidCanvas } from "@/components/LiquidCanvas";
import { useFacePipeline } from "@/hooks/useFacePipeline";
import {
  getClusterOptions,
  setClusterOptions,
  getDetectorOption,
  setDetectorOption,
  type ClusterMethod,
} from "@/lib/clustering";
import type { FaceDetectorType } from "@/lib/constants";

/* â”€â”€ Fun facts â”€â”€ */
const FACTS = [
  { icon: "ðŸ“·", text: "The first photograph ever taken required an 8-hour exposure back in 1826." },
  { icon: "ðŸ§ ", text: "Your eyes can distinguish around 10 million different colors â€” way more than any camera sensor." },
  { icon: "âš¡", text: "Light travels at 299,792,458 m/s. Your camera captures it in a fraction of a millisecond." },
  { icon: "ðŸ”’", text: "Every face embedding computed right now is a 512-dimensional vector â€” and it never leaves your device." },
  { icon: "ðŸŒ", text: "Photography comes from Greek: Ï†á¿¶Ï‚ (light) + Î³ÏÎ¬Ï†Ï‰ (write). Literally 'writing with light'." },
  { icon: "ðŸ¤–", text: "ArcFace, the model running in your browser, was trained on millions of faces and achieves 99%+ accuracy on LFW benchmark." },
  { icon: "ðŸ•ï¸", text: "An average trip with friends generates 400â€“800 photos. TripTag sorts them all in under 30 seconds." },
  { icon: "ðŸŒ", text: "WebAssembly runs at near-native speed. The entire ML pipeline runs inside this single browser tab." },
  { icon: "ðŸŽžï¸", text: "Polaroid cameras were invented in 1948. Today your phone shoots 48 megapixels â€” in a device thinner than a Polaroid." },
  { icon: "ðŸ§¬", text: "Cosine similarity between two face embeddings tells us how 'alike' two people are. Values above 0.6 typically indicate the same person." },
  { icon: "ðŸ”ï¸", text: "DBSCAN clustering was invented in 1996. It's fast, handles noise, and doesn't require you to guess how many people are in your photos." },
  { icon: "ðŸ”", text: "RetinaFace can detect faces rotated up to 90Â° and as small as 16Ã—16 pixels in a 640Ã—640 image." },
];

/* â”€â”€ Step definitions â”€â”€ */
const STEPS = [
  { icon: "â¬‡ï¸", label: "Load AI Model", sublabel: "Fetching ONNX weights & compiling WASMâ€¦" },
  { icon: "ðŸ”", label: "Detect Faces", sublabel: "Running RetinaFace on every photoâ€¦" },
  { icon: "ðŸ§¬", label: "Create Embeddings", sublabel: "ArcFace 512-d vectors for each faceâ€¦" },
  { icon: "ðŸª„", label: "Cluster People", sublabel: "DBSCAN grouping similar embeddingsâ€¦" },
];

function phaseToStepIndex(phase: string) {
  switch (phase) {
    case "loading": return 0;
    case "detecting": return 1;
    case "embedding": return 2;
    case "clustering": return 3;
    default: return -1;
  }
}

function formatEta(ms: number) {
  if (ms <= 0 || !isFinite(ms)) return null;
  const s = Math.round(ms / 1000);
  if (s < 60) return `~${s}s left`;
  return `~${Math.round(s / 60)}m left`;
}

/* â”€â”€ Confetti â”€â”€ */
function fireConfetti() {
  const colors = ["#E8904A", "#EEB060", "#C8702A", "#D09060", "#F0C880", "#4A7C5A", "#C8732A", "#EAB856"];
  for (let i = 0; i < 36; i++) {
    const el = document.createElement("div");
    el.className = "tt-confetti";
    const tx = (Math.random() - 0.5) * 320;
    const ty = -(Math.random() * 260 + 80);
    const rot = (Math.random() - 0.5) * 720;
    el.style.cssText = `
      left: calc(50% + ${(Math.random() - 0.5) * 200}px);
      top: ${Math.random() * 60 + 30}%;
      width: ${Math.random() * 6 + 5}px;
      height: ${Math.random() * 6 + 5}px;
      background: ${colors[Math.floor(Math.random() * colors.length)]};
      border-radius: ${Math.random() > 0.5 ? "50%" : "2px"};
      --tx: ${tx}px;
      --ty: ${ty}px;
      --rot: ${rot}deg;
      animation-delay: ${i * 22}ms;
      animation-duration: ${0.9 + Math.random() * 0.4}s;
    `;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1600 + i * 22);
  }
}

export default function Home() {
  const [files, setFiles] = useState<File[]>([]);
  const [clusterMethod, setClusterMethod] = useState<ClusterMethod>("dbscan");
  const [kmeansK, setKmeansK] = useState(5);
  const [detector, setDetector] = useState<FaceDetectorType>("retinaface");
  const [factIdx, setFactIdx] = useState(0);
  const [factFade, setFactFade] = useState(false);
  const [showLanding, setShowLanding] = useState(true);
  const confettiFiredRef = useRef(false);
  const stepStartTimeRef = useRef<number>(Date.now());
  const prevPhaseRef = useRef<string>("idle");

  useEffect(() => {
    const opts = getClusterOptions();
    setClusterMethod(opts.method);
    setKmeansK(opts.k ?? 5);
    setDetector(getDetectorOption());
  }, []);

  const {
    progress,
    tagged,
    clusters,
    imageIdsWithNoFaces,
    error,
    runPipeline,
    reset,
    setClusterName,
    mergeClusters,
    splitCluster,
    assignDetectionsToCluster,
  } = useFacePipeline();

  const filesById = useMemo(() => {
    const m = new Map<string, File>();
    files.forEach((file, i) => m.set(String(i), file));
    return m;
  }, [files]);

  const handleProcess = useCallback(() => {
    confettiFiredRef.current = false;
    const payload = files.map((file, i) => ({ id: String(i), file }));
    runPipeline(payload, { detector });
  }, [files, detector, runPipeline]);

  const handleReset = useCallback(() => {
    confettiFiredRef.current = false;
    reset();
    setShowLanding(true);
  }, [reset]);

  /* Track step start times for ETA */
  useEffect(() => {
    if (progress.phase !== prevPhaseRef.current) {
      stepStartTimeRef.current = Date.now();
      prevPhaseRef.current = progress.phase;
    }
  }, [progress.phase]);

  /* Rotate fun facts during processing */
  useEffect(() => {
    const isProcessing =
      progress.phase === "loading" ||
      progress.phase === "detecting" ||
      progress.phase === "embedding" ||
      progress.phase === "clustering";
    if (!isProcessing) return;
    const id = setInterval(() => {
      setFactFade(true);
      setTimeout(() => {
        setFactIdx((i) => (i + 1) % FACTS.length);
        setFactFade(false);
      }, 420);
    }, 4500);
    return () => clearInterval(id);
  }, [progress.phase]);

  /* Confetti on results */
  useEffect(() => {
    if (progress.phase === "done" && !confettiFiredRef.current) {
      confettiFiredRef.current = true;
      setTimeout(fireConfetti, 200);
    }
  }, [progress.phase]);

  /* Enter key shortcut */
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Enter") return;
      const active = document.activeElement;
      if (
        active &&
        (active.tagName === "INPUT" ||
          active.tagName === "TEXTAREA" ||
          active.tagName === "SELECT" ||
          active.getAttribute("contenteditable") === "true")
      )
        return;
      if (files.length > 0 && progress.phase === "idle") {
        e.preventDefault();
        handleProcess();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [files.length, progress.phase, handleProcess]);

  const isProcessing =
    progress.phase === "loading" ||
    progress.phase === "detecting" ||
    progress.phase === "embedding" ||
    progress.phase === "clustering";
  const showResults = progress.phase === "done";
  const showUpload = !showLanding && !isProcessing && !showResults;

  const activeStep = phaseToStepIndex(progress.phase);
  const pct =
    progress.total && progress.total > 0
      ? Math.min(100, Math.round(((progress.current ?? 0) / progress.total) * 100))
      : null;

  /* ETA calculation */
  const eta = useMemo(() => {
    if (!progress.total || progress.total === 0 || !progress.current || progress.current === 0) return null;
    const elapsed = Date.now() - stepStartTimeRef.current;
    const rate = progress.current / elapsed;
    const remaining = (progress.total - progress.current) / rate;
    return formatEta(remaining);
  }, [progress.current, progress.total]);

  /* Result stats */
  const namedClusters = clusters.filter((c) => c.clusterId !== 0);
  const uncatCluster = clusters.find((c) => c.clusterId === 0);
  const totalFaces = tagged.length;
  const uncatCount = (uncatCluster?.detectionIds.length ?? 0) + imageIdsWithNoFaces.length;

  const fact = FACTS[factIdx];

  return (
    <Layout>
      {/* ══════════════════════════════════════════
          SCREEN 0 — LANDING
      ══════════════════════════════════════════ */}
      <div className={`tt-screen ${!showLanding ? "tt-screen--hidden" : ""}`}>
        <div className="tt-landing-wrap">
          <div className="tt-eyebrow">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" aria-hidden>
              <circle cx="5" cy="5" r="5" />
            </svg>
            Privacy-first · On-device AI · Zero uploads
          </div>
          <h1 className="tt-headline">
            Sort your trip<br />
            photos by person,<br />
            <em>privately</em>.
          </h1>
          <p className="tt-subtext">
            AI-powered face clustering that lives entirely in your browser tab.
            No uploads. No accounts. No creepy storage.
          </p>
          <div className="tt-badges">
            <div className="tt-badge">🚫 0 server calls</div>
            <div className="tt-badge">📱 100% on-device</div>
            <div className="tt-badge">🗂️ ∞ photos local</div>
            <div className="tt-badge">👤 No account needed</div>
          </div>
          <div className="tt-stats">
            <div>
              <div className="tt-stat-n">0</div>
              <div className="tt-stat-l">Server Calls</div>
            </div>
            <div>
              <div className="tt-stat-n">∞</div>
              <div className="tt-stat-l">Photos Local</div>
            </div>
            <div>
              <div className="tt-stat-n tt-stat-n--accent">100%</div>
              <div className="tt-stat-l">Your Device</div>
            </div>
          </div>
          <button
            type="button"
            className="tt-btn-go tt-btn-go--lg"
            onClick={() => setShowLanding(false)}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            Tag my trip photos
          </button>
        </div>
      </div>

      {/* ══════════════════════════════════════════
          SCREEN 1 — UPLOAD
      ══════════════════════════════════════════ */}
      <div className={`tt-screen ${!showUpload ? "tt-screen--hidden" : ""}`}>
        <div className="tt-upload-solo">
          <button
            type="button"
            className="tt-back-btn"
            onClick={() => setShowLanding(true)}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Back
          </button>
          {error && (
            <div className="tt-error-banner" style={{ width: "100%", maxWidth: 460, marginBottom: "0.75rem" }}>
              {error}
            </div>
          )}
          <UploadZone
            files={files}
            onFilesChange={setFiles}
            showProcessHint={files.length > 0}
            actions={
              <button
                type="button"
                className="tt-btn-go"
                onClick={handleProcess}
                disabled={files.length === 0}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                {files.length === 0 ? "Choose photos first" : `Tag my trip (${files.length} photo${files.length !== 1 ? "s" : ""})`}
              </button>
            }
          />

          {/* Advanced settings */}
          <details className="tt-adv-details">
            <summary className="tt-adv-summary">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <circle cx="12" cy="12" r="3" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14" />
              </svg>
              Advanced settings
            </summary>
            <div className="tt-adv-body">
              <div className="tt-adv-row">
                <span className="tt-adv-label">Detector</span>
                <select
                  className="tt-adv-select"
                  value={detector}
                  onChange={(e) => {
                    const d = e.target.value as FaceDetectorType;
                    setDetector(d);
                    setDetectorOption(d);
                  }}
                >
                  <option value="retinaface">RetinaFace (ONNX, recommended)</option>
                  <option value="face-api">Face-api.js (Tiny, faster)</option>
                </select>
              </div>
              <div className="tt-adv-row">
                <span className="tt-adv-label">Clustering</span>
                <select
                  className="tt-adv-select"
                  value={clusterMethod}
                  onChange={(e) => {
                    const m = e.target.value as ClusterMethod;
                    setClusterMethod(m);
                    setClusterOptions({ method: m });
                  }}
                >
                  <option value="dbscan">DBSCAN (auto-detect count)</option>
                  <option value="kmeans">K-means (fixed k)</option>
                </select>
              </div>
              {clusterMethod === "kmeans" && (
                <div className="tt-adv-row">
                  <span className="tt-adv-label">People (k)</span>
                  <input
                    type="number"
                    className="tt-adv-input"
                    min={1}
                    max={100}
                    value={kmeansK}
                    onChange={(e) => {
                      const v = Math.max(1, Math.min(100, parseInt(e.target.value, 10) || 1));
                      setKmeansK(v);
                      setClusterOptions({ k: v });
                    }}
                  />
                </div>
              )}
            </div>
          </details>
        </div>
      </div>

      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
          SCREEN 2 â€” PROCESSING
      â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      <div className={`tt-screen ${!isProcessing ? "tt-screen--hidden" : ""}`}>
        <div className="tt-proc-wrap">
          <div className="tt-proc-header">
            <div className="tt-proc-title">
              Processing your <em>memories</em>
            </div>
            <div className="tt-proc-sub">
              All computation is happening right here in your tab â€” zero bytes uploaded.
            </div>
          </div>

          <LiquidCanvas phase={progress.phase} />

          {/* Steps */}
          <div className="tt-steps">
            {STEPS.map((step, i) => {
              const state =
                activeStep === i ? "active" : activeStep > i ? "done" : "idle";
              const isActiveStep = state === "active";
              const barPct = state === "done" ? 100 : isActiveStep && pct !== null ? pct : 0;
              return (
                <div
                  key={i}
                  className={`tt-step ${state === "active" ? "tt-step--active" : ""} ${state === "done" ? "tt-step--done" : ""}`}
                >
                  <div className="tt-step-header">
                    <div className="tt-step-ico">{step.icon}</div>
                    <div className="tt-step-info">
                      <div className="tt-step-label">{step.label}</div>
                      <div className="tt-step-detail">
                        {state === "active" ? (progress.message ?? step.sublabel) : state === "done" ? "Completed" : step.sublabel}
                      </div>
                    </div>
                    <div className="tt-step-status">
                      {state === "done" ? "âœ“ done" : state === "active" ? "runningâ€¦" : "waiting"}
                    </div>
                  </div>
                  <div className="tt-pbar-track">
                    <div className="tt-pbar-fill" style={{ width: `${barPct}%` }} />
                  </div>
                  {isActiveStep && (
                    <div className="tt-prog-meta">
                      <span>{pct !== null ? `${pct}%` : "initialisingâ€¦"}</span>
                      {eta && <span>{eta}</span>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Fun fact */}
          <div className="tt-fact-box">
            <div style={{ fontSize: "1.25rem", flexShrink: 0, marginTop: "0.05rem" }}>{fact.icon}</div>
            <div>
              <div className="tt-fact-label">Did you know?</div>
              <div className={`tt-fact-text ${factFade ? "tt-fact-text--fade" : ""}`}>
                {fact.text}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
          SCREEN 3 â€” RESULTS
      â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      <div className={`tt-screen tt-screen--results ${!showResults ? "tt-screen--hidden" : ""}`}>
        <div className="tt-results-wrap">
          <div className="tt-res-header">
            <div>
              <div className="tt-res-title">
                <em>{namedClusters.length}</em> {namedClusters.length === 1 ? "person" : "people"} identified
              </div>
            </div>
            <div className="tt-res-meta">
              {files.length} photo{files.length !== 1 ? "s" : ""} Â· {totalFaces} face{totalFaces !== 1 ? "s" : ""}
            </div>
          </div>

          {/* Summary bar */}
          <div className="tt-summary-bar">
            <div className="tt-sum-item">
              <div className="tt-sum-n">{namedClusters.length}</div>
              <div className="tt-sum-l">People found</div>
            </div>
            <div className="tt-sum-div" />
            <div className="tt-sum-item">
              <div className="tt-sum-n">{totalFaces}</div>
              <div className="tt-sum-l">Total faces</div>
            </div>
            <div className="tt-sum-div" />
            <div className="tt-sum-item">
              <div className="tt-sum-n">{files.length}</div>
              <div className="tt-sum-l">Photos</div>
            </div>
            <div className="tt-sum-div" />
            <div className="tt-sum-item">
              <div className="tt-sum-n">0</div>
              <div className="tt-sum-l">Server calls</div>
            </div>
            <button
              type="button"
              className="tt-btn-new-scan"
              onClick={handleReset}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <polyline points="1 4 1 10 7 10" />
                <path d="M3.51 15a9 9 0 1 0 .49-4.65" />
              </svg>
              New scan
            </button>
          </div>

          {clusters.length === 0 ? (
            <div style={{ padding: "2rem 0.5rem", color: "var(--text3)", fontFamily: "'DM Mono', monospace", fontSize: "0.82rem" }}>
              No faces detected. Try photos with clear, well-lit faces.
            </div>
          ) : (
            <ClusterResults
              clusters={clusters}
              tagged={tagged}
              filesById={filesById}
              imageIdsWithNoFaces={imageIdsWithNoFaces}
              onRename={setClusterName}
              onMerge={mergeClusters}
              onSplit={splitCluster}
              onAssignToCluster={assignDetectionsToCluster}
            />
          )}
        </div>
      </div>
    </Layout>
  );
}
