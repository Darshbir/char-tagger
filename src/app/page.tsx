"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { UploadZone } from "@/components/UploadZone";
import { Layout } from "@/components/Layout";
import { ClusterResults } from "@/components/ClusterResults";
import { DriveConnectionCard } from "@/components/DriveConnectionCard";
import { DriveExportModal } from "@/components/DriveExportModal";
import { DriveExportResults } from "@/components/DriveExportResults";
import { LiquidCanvas } from "@/components/LiquidCanvas";
import { ParticleBackground } from "@/components/ParticleBackground";
import { useFacePipeline } from "@/hooks/useFacePipeline";
import { useGoogleAuth } from "@/hooks/useGoogleAuth";
import {
  buildDriveExportManifest,
  ensureAnyoneReaderPermission,
  ensureDriveFolder,
  ensureDriveShortcut,
  ensureUploadedFile,
  formatBytes,
  getDriveItemLink,
  type DriveExportResultSummary,
  type DriveExportSessionResponse,
  type DriveQuotaSummary,
  withDriveRetry,
} from "@/lib/driveExport";
import {
  getClusterOptions,
  setClusterOptions,
  getDetectorOption,
  setDetectorOption,
  type ClusterMethod,
} from "@/lib/clustering";
import type { FaceDetectorType } from "@/lib/constants";

/* ── Tiny SVG icon components (used in FACTS, STEPS, landing) ── */
function IcoCamera() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>; }
function IcoEye() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>; }
function IcoBolt() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>; }
function IcoCpu() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="4" y="4" width="16" height="16" rx="2" /><rect x="9" y="9" width="6" height="6" /><line x1="9" y1="1" x2="9" y2="4" /><line x1="15" y1="1" x2="15" y2="4" /><line x1="9" y1="20" x2="9" y2="23" /><line x1="15" y1="20" x2="15" y2="23" /><line x1="20" y1="9" x2="23" y2="9" /><line x1="20" y1="14" x2="23" y2="14" /><line x1="1" y1="9" x2="4" y2="9" /><line x1="1" y1="14" x2="4" y2="14" /></svg>; }
function IcoGlobe() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>; }
function IcoMap() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" /><line x1="8" y1="2" x2="8" y2="18" /><line x1="16" y1="6" x2="16" y2="22" /></svg>; }
function IcoWifi() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 12.55a11 11 0 0 1 14.08 0" /><path d="M1.42 9a16 16 0 0 1 21.16 0" /><path d="M8.53 16.11a6 6 0 0 1 6.95 0" /><line x1="12" y1="20" x2="12.01" y2="20" strokeWidth="2.5" strokeLinecap="round" /></svg>; }
function IcoFilm() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="2" y="2" width="20" height="20" rx="2" /><line x1="7" y1="2" x2="7" y2="22" /><line x1="17" y1="2" x2="17" y2="22" /><line x1="2" y1="12" x2="22" y2="12" /><line x1="2" y1="7" x2="7" y2="7" /><line x1="2" y1="17" x2="7" y2="17" /><line x1="17" y1="17" x2="22" y2="17" /><line x1="17" y1="7" x2="22" y2="7" /></svg>; }
function IcoLayers() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" /></svg>; }
function IcoMountain() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><polygon points="3 17 9 5 15 11 19 17 3 17" /><circle cx="19" cy="6" r="2" /></svg>; }
function IcoSearch() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>; }
function IcoDownload() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>; }
function IcoScanFace() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M3 7V5a2 2 0 0 1 2-2h2" /><path d="M17 3h2a2 2 0 0 1 2 2v2" /><path d="M21 17v2a2 2 0 0 1-2 2h-2" /><path d="M7 21H5a2 2 0 0 1-2-2v-2" /><path d="M8 14s1.5 2 4 2 4-2 4-2" /><line x1="9" y1="9" x2="9.01" y2="9" strokeWidth="2.5" /><line x1="15" y1="9" x2="15.01" y2="9" strokeWidth="2.5" /></svg>; }
function IcoSparkles() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 3L9.5 9.5 3 12l6.5 2.5L12 21l2.5-6.5L21 12l-6.5-2.5z" /><path d="M5 3v4M3 5h4M19 17v4M17 19h4" /></svg>; }
function IcoLock() { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>; }
function IcoBan() { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="12" cy="12" r="10" /><line x1="4.93" y1="4.93" x2="19.07" y2="19.07" /></svg>; }
function IcoPhone() { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="5" y="2" width="14" height="20" rx="2" /><line x1="12" y1="18" x2="12.01" y2="18" strokeWidth="2.5" strokeLinecap="round" /></svg>; }
function IcoFolder() { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg>; }
function IcoUser() { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>; }
function IcoShield() { return <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>; }
function IcoEyeOff() { return <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" /><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" /><line x1="1" y1="1" x2="23" y2="23" /></svg>; }
function IcoCheckDone() { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><polyline points="20 6 9 17 4 12" /></svg>; }
function IcoFaceSilhouette({ fill }: { fill?: string }) { return <svg width="72" height="72" viewBox="0 0 60 60" fill="none" aria-hidden><circle cx="30" cy="22" r="14" fill={fill ?? "var(--border2)"} /><path d="M5 56c0-13.807 11.193-25 25-25s25 11.193 25 25" fill={fill ?? "var(--border2)"} /></svg>; }

/* ── Fun facts ── */
const FACTS = [
  { Icon: IcoCamera, text: "The first photograph ever taken required an 8-hour exposure back in 1826." },
  { Icon: IcoEye, text: "Your eyes can distinguish around 10 million different colors, far more than any camera sensor." },
  { Icon: IcoBolt, text: "Light travels at 299,792,458 m/s. Your camera captures it in a fraction of a millisecond." },
  { Icon: IcoLock, text: "Every face embedding computed right now is a 512-dimensional vector. It never leaves your device." },
  { Icon: IcoGlobe, text: "Photography comes from Greek: φῶς (light) + γράφω (write). Literally 'writing with light'." },
  { Icon: IcoCpu, text: "ArcFace, the model running in your browser, was trained on millions of faces and achieves 99%+ accuracy on LFW benchmark." },
  { Icon: IcoMap, text: "An average trip with friends generates 400–800 photos. TripTag sorts them all in under 30 seconds." },
  { Icon: IcoWifi, text: "WebAssembly runs at near-native speed. The entire ML pipeline runs inside this single browser tab." },
  { Icon: IcoFilm, text: "Polaroid cameras were invented in 1948. Today your phone shoots 48 megapixels, in a device thinner than a Polaroid." },
  { Icon: IcoLayers, text: "Cosine similarity between two face embeddings tells us how 'alike' two people are. Values above 0.6 typically indicate the same person." },
  { Icon: IcoMountain, text: "DBSCAN clustering was invented in 1996. It's fast, handles noise, and doesn't require you to guess how many people are in your photos." },
  { Icon: IcoSearch, text: "RetinaFace can detect faces rotated up to 90° and as small as 16×16 pixels in a 640×640 image." },
];

/* ── Step definitions ── */
const STEPS = [
  { Icon: IcoDownload, label: "Load AI Model", sublabel: "Fetching ONNX weights & compiling WASM…" },
  { Icon: IcoScanFace, label: "Detect Faces", sublabel: "Running RetinaFace on every photo…" },
  { Icon: IcoLayers, label: "Create Embeddings", sublabel: "ArcFace 512-d vectors for each face…" },
  { Icon: IcoSparkles, label: "Cluster People", sublabel: "DBSCAN grouping similar embeddings…" },
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

/* ── Confetti ── */
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

/* ── How-It-Works side particle strip ── */
function HowParticles() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = 64;
    let H = canvas.parentElement?.offsetHeight ?? 400;
    canvas.width = W;
    canvas.height = H;

    const ro = new ResizeObserver(() => {
      H = canvas.parentElement?.offsetHeight ?? 400;
      canvas.height = H;
    });
    if (canvas.parentElement) ro.observe(canvas.parentElement);

    interface Pt { x: number; y: number; vy: number; r: number; alpha: number; hue: number; }
    const pts: Pt[] = Array.from({ length: 28 }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      vy: -(0.28 + Math.random() * 0.42),
      r: Math.random() * 3.5 + 1.2,
      alpha: Math.random() * 0.55 + 0.18,
      hue: Math.random() * 34 + 20,
    }));

    let raf = 0;
    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      for (const p of pts) {
        p.y += p.vy;
        if (p.y < -p.r * 2) { p.y = H + p.r; p.x = Math.random() * W; }
        const fade = Math.min(1, p.y / 60) * Math.min(1, (H - p.y) / 60);
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 2.4);
        grad.addColorStop(0, `hsla(${p.hue}, 80%, 65%, ${p.alpha * fade})`);
        grad.addColorStop(1, `hsla(${p.hue}, 80%, 65%, 0)`);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 2.4, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);

  return <canvas ref={canvasRef} className="tt-how-particles-canvas" aria-hidden />;
}

export default function Home() {
  const [files, setFiles] = useState<File[]>([]);
  const [clusterMethod, setClusterMethod] = useState<ClusterMethod>("dbscan");
  const [kmeansK, setKmeansK] = useState(5);
  const [detector, setDetector] = useState<FaceDetectorType>("retinaface");
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [quota, setQuota] = useState<DriveQuotaSummary | null>(null);
  const [quotaLoading, setQuotaLoading] = useState(false);
  const [quotaError, setQuotaError] = useState<string | null>(null);
  const [exportBusy, setExportBusy] = useState(false);
  const [exportStatusMessage, setExportStatusMessage] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportSuccessMessage, setExportSuccessMessage] = useState<string | null>(null);
  const [exportSummary, setExportSummary] = useState<DriveExportResultSummary | null>(null);
  const [resultsView, setResultsView] = useState<"clusters" | "export">("clusters");
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);
  const [copyToast, setCopyToast] = useState<string | null>(null);
  const [nameDrafts, setNameDrafts] = useState<Record<number, string>>({});
  const [factIdx, setFactIdx] = useState(0);
  const [factFade, setFactFade] = useState(false);
  const [showLanding, setShowLanding] = useState(true);
  // JS-controlled hover state for polaroid cards prevent CSS :hover jitter from scale expanding into cursor area
  const [hoveredPolaroid, setHoveredPolaroid] = useState<string | null>(null);
  const polaroidLeaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const confettiFiredRef = useRef(false);
  const stepStartTimeRef = useRef<number>(Date.now());
  const prevPhaseRef = useRef<string>("idle");
  const landingScreenRef = useRef<HTMLDivElement>(null);

  /* Ensure upload screen is focusable so Enter key works immediately */
  const uploadScreenRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!showLanding && uploadScreenRef.current) {
      uploadScreenRef.current.focus();
    }
  }, [showLanding]);

  useEffect(() => {
    if (!copiedLinkId && !copyToast) return;
    const timeoutId = window.setTimeout(() => {
      setCopiedLinkId(null);
      setCopyToast(null);
    }, 2200);

    return () => window.clearTimeout(timeoutId);
  }, [copiedLinkId, copyToast]);

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
    reviewedClusterIds,
    imageAssignments,
    error,
    mlAvailable,
    runPipeline,
    reset,
    startManualMode,
    setClusterName,
    markClustersReviewed,
    mergeClusters,
    splitCluster,
    assignDetectionsToCluster,
    assignImageToCluster,
    clearImageAssignment,
  } = useFacePipeline();
  const {
    status: authStatus,
    user: authUser,
    error: authError,
    isBusy: authBusy,
    signIn,
    signOut,
  } = useGoogleAuth();
  const driveConnected = authStatus === "authenticated";

  const filesById = useMemo(() => {
    const m = new Map<string, File>();
    files.forEach((file, i) => m.set(String(i), file));
    return m;
  }, [files]);

  const exportPreviewClusters = useMemo(
    () =>
      clusters.map((cluster) => ({
        ...cluster,
        name: nameDrafts[cluster.clusterId] ?? cluster.name,
      })),
    [clusters, nameDrafts]
  );

  const exportManifest = useMemo(
    () =>
      buildDriveExportManifest({
        clusters: exportPreviewClusters,
        tagged,
        filesById,
        reviewedClusterIds,
        imageAssignments,
      }),
    [exportPreviewClusters, tagged, filesById, reviewedClusterIds, imageAssignments]
  );

  const fetchDriveExportSession = useCallback(async () => {
    const response = await fetch("/api/drive/export/session", {
      method: "GET",
      cache: "no-store",
      credentials: "include",
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(payload?.error || "Unable to prepare Google Drive export.");
    }

    return (await response.json()) as DriveExportSessionResponse;
  }, []);

  useEffect(() => {
    if (!isExportModalOpen) return;
    setNameDrafts((prev) => {
      const next = { ...prev };
      for (const item of exportManifest.needsReview) {
        if (next[item.clusterId] == null) {
          next[item.clusterId] = item.currentName;
        }
      }
      return next;
    });
  }, [exportManifest.needsReview, isExportModalOpen]);

  useEffect(() => {
    if (!isExportModalOpen || !driveConnected) return;
    let ignore = false;
    setQuotaLoading(true);
    setQuotaError(null);

    void fetchDriveExportSession()
      .then((session) => {
        if (ignore) return;
        setQuota(session.quota);
      })
      .catch((caughtError) => {
        if (ignore) return;
        const message = caughtError instanceof Error ? caughtError.message : "Unable to check Drive storage right now.";
        setQuota(null);
        setQuotaError(message);
      })
      .finally(() => {
        if (!ignore) setQuotaLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [driveConnected, fetchDriveExportSession, isExportModalOpen]);

  const handleOpenExportModal = useCallback(() => {
    setExportError(null);
    setExportSuccessMessage(null);
    setExportStatusMessage(null);
    setQuotaError(null);
    if (!driveConnected) {
      setQuota(null);
    }
    setIsExportModalOpen(true);
  }, [driveConnected]);

  const handleExportNameChange = useCallback((clusterId: number, value: string) => {
    setNameDrafts((prev) => ({
      ...prev,
      [clusterId]: value,
    }));
  }, []);

  const handleConnectDriveForExport = useCallback(async () => {
    const connected = await signIn();
    if (!connected) return;
    setQuotaError(null);
  }, [signIn]);

  const handleCopyExportLink = useCallback(async (id: string, url: string, label: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedLinkId(id);
      setCopyToast(`${label} link copied`);
    } catch {
      setCopiedLinkId(id);
      setCopyToast(`Could not auto-copy ${label.toLowerCase()} link`);
    }
  }, []);

  const handleExportToDrive = useCallback(async () => {
    if (exportManifest.characters.length === 0) {
      setExportError("Nothing is ready to export yet. Name at least one character with photos first.");
      return;
    }

    setExportBusy(true);
    setExportError(null);
    setExportSuccessMessage(null);
    setExportStatusMessage("Preparing export…");

    try {
      const unchangedReviewedIds: number[] = [];
      for (const item of exportManifest.needsReview) {
        const nextName = (nameDrafts[item.clusterId] ?? item.currentName).trim();
        const currentCluster = clusters.find((cluster) => cluster.clusterId === item.clusterId);
        const currentName = currentCluster?.name ?? item.currentName;
        if (nextName && nextName !== currentName) {
          setClusterName(item.clusterId, nextName);
        } else {
          unchangedReviewedIds.push(item.clusterId);
        }
      }
      if (unchangedReviewedIds.length > 0) {
        markClustersReviewed(unchangedReviewedIds);
      }

      const session = await fetchDriveExportSession();
      setQuota(session.quota);

      if (!session.quota.isUnlimited && session.quota.availableBytes != null && session.quota.availableBytes < exportManifest.totalBytes) {
        throw new Error(`Google Drive only has ${formatBytes(session.quota.availableBytes)} free, but this export needs about ${formatBytes(exportManifest.totalBytes)}.`);
      }

      setExportStatusMessage("Creating or reusing Drive folders…");
      const rootFolder = await withDriveRetry("Root folder setup", () =>
        ensureDriveFolder(session.accessToken, {
          name: exportManifest.rootFolderName,
          appProperties: {
            ttExportKey: exportManifest.exportKey,
            ttFolderRole: "root",
          },
        })
      );
      const allFolder = await withDriveRetry("All folder setup", () =>
        ensureDriveFolder(session.accessToken, {
          name: "All",
          parentId: rootFolder.id,
          appProperties: {
            ttExportKey: exportManifest.exportKey,
            ttFolderRole: "all",
          },
        })
      );

      const folderByClusterId = new Map<number, { id: string; name: string; webViewLink: string }>();
      for (const character of exportManifest.characters) {
        const folder = await withDriveRetry(`Folder setup for ${character.folderName}`, () =>
          ensureDriveFolder(session.accessToken, {
            name: character.folderName,
            parentId: rootFolder.id,
            appProperties: {
              ttExportKey: exportManifest.exportKey,
              ttFolderRole: `cluster-${character.clusterId}`,
            },
          })
        );
        folderByClusterId.set(character.clusterId, folder);
      }

      setExportStatusMessage("Updating share settings…");
      await withDriveRetry("Root folder sharing", () => ensureAnyoneReaderPermission(session.accessToken, rootFolder.id));
      await withDriveRetry("All folder sharing", () => ensureAnyoneReaderPermission(session.accessToken, allFolder.id));
      for (const character of exportManifest.characters) {
        const folder = folderByClusterId.get(character.clusterId);
        if (!folder) continue;
        await withDriveRetry(`Sharing ${character.folderName}`, () => ensureAnyoneReaderPermission(session.accessToken, folder.id));
      }

      setExportStatusMessage(`Uploading ${exportManifest.allImageIds.length} original photo${exportManifest.allImageIds.length === 1 ? "" : "s"} to All…`);
      const uploadedFileIdByImageId = new Map<string, string>();
      let uploadedCount = 0;
      for (const imageId of exportManifest.allImageIds) {
        const file = filesById.get(imageId);
        if (!file) continue;
        const uploaded = await withDriveRetry(`Upload ${file.name}`, () =>
          ensureUploadedFile(session.accessToken, {
            file,
            parentId: allFolder.id,
            appProperties: {
              ttExportKey: exportManifest.exportKey,
              ttSourceImageId: imageId,
            },
          })
        );
        uploadedFileIdByImageId.set(imageId, uploaded.id);
        uploadedCount += 1;
        setExportStatusMessage(`Uploaded ${uploadedCount} of ${exportManifest.allImageIds.length} originals…`);
      }

      const totalShortcuts = exportManifest.characters.reduce((sum, character) => sum + character.imageIds.length, 0);
      let createdShortcuts = 0;
      for (const character of exportManifest.characters) {
        const folder = folderByClusterId.get(character.clusterId);
        if (!folder) continue;
        for (const imageId of character.imageIds) {
          const targetId = uploadedFileIdByImageId.get(imageId);
          const file = filesById.get(imageId);
          if (!targetId || !file) continue;
          await withDriveRetry(`Shortcut ${file.name} for ${character.folderName}`, () =>
            ensureDriveShortcut(session.accessToken, {
              name: file.name,
              targetId,
              parentId: folder.id,
              appProperties: {
                ttExportKey: exportManifest.exportKey,
                ttShortcutClusterId: String(character.clusterId),
                ttShortcutImageId: imageId,
              },
            })
          );
          createdShortcuts += 1;
          setExportStatusMessage(`Created ${createdShortcuts} of ${totalShortcuts} shortcuts…`);
        }
      }

      setExportStatusMessage("Loading shareable links…");
      const rootLink = await withDriveRetry("Root folder link", () => getDriveItemLink(session.accessToken, rootFolder.id));
      const allLink = await withDriveRetry("All folder link", () => getDriveItemLink(session.accessToken, allFolder.id));
      const characterLinks = [] as DriveExportResultSummary["characters"];
      for (const character of exportManifest.characters) {
        const folder = folderByClusterId.get(character.clusterId);
        if (!folder) continue;
        const link = await withDriveRetry(`Link for ${character.folderName}`, () => getDriveItemLink(session.accessToken, folder.id));
        characterLinks.push({
          id: link.id,
          name: character.folderName,
          url: link.webViewLink,
          clusterId: character.clusterId,
          fileCount: character.fileCount,
        });
      }

      setExportStatusMessage(null);
      setExportSuccessMessage(`Export finished. Uploaded ${uploadedCount} original photo${uploadedCount === 1 ? "" : "s"} into “All” and created ${createdShortcuts} shortcut${createdShortcuts === 1 ? "" : "s"} inside ${exportManifest.characters.length} character folder${exportManifest.characters.length === 1 ? "" : "s"}.`);
      setExportSummary({
        rootFolder: {
          id: rootLink.id,
          name: rootLink.name,
          url: rootLink.webViewLink,
        },
        allFolder: {
          id: allLink.id,
          name: allLink.name,
          url: allLink.webViewLink,
        },
        characters: characterLinks,
        totalBytes: exportManifest.totalBytes,
        uploadedCount,
        shortcutCount: createdShortcuts,
      });
      setResultsView("export");
      setIsExportModalOpen(false);
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : "Drive export failed.";
      setExportStatusMessage(null);
      setExportError(message);
    } finally {
      setExportBusy(false);
    }
  }, [clusters, exportManifest, fetchDriveExportSession, filesById, markClustersReviewed, nameDrafts, setClusterName]);

  const handleProcess = useCallback(() => {
    confettiFiredRef.current = false;
    setExportSummary(null);
    setResultsView("clusters");
    setCopiedLinkId(null);
    setCopyToast(null);
    const payload = files.map((file, i) => ({ id: String(i), file }));
    runPipeline(payload, { detector });
  }, [files, detector, runPipeline]);

  const handleReset = useCallback(() => {
    confettiFiredRef.current = false;
    reset();
    setFiles([]);
    setShowLanding(false);
    setIsExportModalOpen(false);
    setQuota(null);
    setQuotaError(null);
    setExportBusy(false);
    setExportStatusMessage(null);
    setExportError(null);
    setExportSuccessMessage(null);
    setExportSummary(null);
    setResultsView("clusters");
    setCopiedLinkId(null);
    setCopyToast(null);
    setNameDrafts({});
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
    }, 8000);
    return () => clearInterval(id);
  }, [progress.phase]);

  /* Confetti on results */
  useEffect(() => {
    if (progress.phase === "done" && !confettiFiredRef.current) {
      confettiFiredRef.current = true;
      setTimeout(fireConfetti, 200);
    }
  }, [progress.phase]);

  /* Scroll-reveal IntersectionObserver for landing sections */
  useEffect(() => {
    const el = landingScreenRef.current;
    if (!el || !showLanding) return;
    const revEls = el.querySelectorAll(".tt-rev");
    if (!revEls.length) return;
    const observer = new IntersectionObserver(
      (entries) => { for (const e of entries) { if (e.isIntersecting) e.target.classList.add("tt-vis"); } },
      { threshold: 0.1, root: el }
    );
    revEls.forEach((r) => observer.observe(r));
    return () => observer.disconnect();
  }, [showLanding]);

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

  /* Esc key → back to landing from upload screen */
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const phase = progress.phase;
      const running = phase === "loading" || phase === "detecting" || phase === "embedding" || phase === "clustering";
      const showUpload = !showLanding && !running && phase !== "done";
      if (showUpload) setShowLanding(true);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showLanding, progress.phase]);

  const isProcessing =
    progress.phase === "loading" ||
    progress.phase === "detecting" ||
    progress.phase === "embedding" ||
    progress.phase === "clustering";
  const hasCompletedPipeline = progress.phase === "done";
  const showResults = hasCompletedPipeline && resultsView === "clusters";
  const showExportResults = hasCompletedPipeline && resultsView === "export" && exportSummary !== null;
  const showUpload = !showLanding && !isProcessing && !hasCompletedPipeline;

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
  }, [progress]);

  /* Result stats */
  const namedClusters = clusters.filter((c) => c.clusterId !== 0);
  const uncatCluster = clusters.find((c) => c.clusterId === 0);
  const totalFaces = tagged.length;
  const uncatCount = (uncatCluster?.detectionIds.length ?? 0) + imageIdsWithNoFaces.length;

  const fact = FACTS[factIdx];

  const navActions = (
    <button
      type="button"
      className={`tt-nav-auth-btn${driveConnected ? " tt-nav-auth-btn--connected" : ""}`}
      onClick={() => {
        if (driveConnected) {
          void signOut();
          return;
        }
        void signIn();
      }}
      disabled={authBusy || authStatus === "loading"}
    >
      <span className={`tt-nav-auth-dot${driveConnected ? " tt-nav-auth-dot--connected" : ""}`} />
      <span>
        {authStatus === "loading"
          ? "Checking Drive…"
          : driveConnected
            ? authUser?.email ?? "Drive connected"
            : authBusy
              ? "Connecting…"
              : "Connect Drive"}
      </span>
    </button>
  );

  return (
    <Layout onLogoClick={() => { if (!showLanding) { reset(); setFiles([]); setShowLanding(true); } }} navActions={navActions}>
      <ParticleBackground visible={showLanding} />
      {/* ------------------------------------------
          SCREEN 0 — LANDING
      ------------------------------------------ */}
      <div
        ref={landingScreenRef}
        className={`tt-screen tt-screen--landing ${!showLanding ? "tt-screen--hidden" : ""}`}
      >
        <div className="tt-landing-pg">
          {/* ── HERO ── */}
          <section className="tt-hero-wrap">
            <div className="tt-hero">
              {/* LEFT: headline + badges + stats + CTA */}
              <div className="tt-hleft">
                <div className="tt-eyebrow">
                  <svg width="7" height="7" viewBox="0 0 10 10" fill="currentColor" aria-hidden><circle cx="5" cy="5" r="5" /></svg>
                  Privacy-first &middot; On-device AI &middot; Zero photo uploads
                </div>
                <h1 className="tt-headline">
                  Sort your trip<br />
                  photos by person,<br />
                  <em>privately</em>.
                </h1>
                <p className="tt-subtext">
                  AI-powered face clustering that lives entirely in your browser tab.
                  No photo uploads. Optional Google Drive sign-in for export. No creepy storage.
                </p>
                <div className="tt-badges">
                  <div className="tt-badge"><IcoBan /> 0 photo uploads</div>
                  <div className="tt-badge"><IcoPhone /> 100% on-device</div>
                  <div className="tt-badge"><IcoFolder /> &#8734; photos local</div>
                  <div className="tt-badge"><IcoUser /> Drive sign-in optional</div>
                </div>
                <div className="tt-stats">
                  <div>
                    <div className="tt-stat-n">0</div>
                    <div className="tt-stat-l">Photo Uploads</div>
                  </div>
                  <div>
                    <div className="tt-stat-n tt-stat-n--sys">&#8734;</div>
                    <div className="tt-stat-l">Photos Local</div>
                  </div>
                  <div>
                    <div className="tt-stat-n tt-stat-n--accent">100%</div>
                    <div className="tt-stat-l">Your Device</div>
                  </div>
                </div>
              </div>

              {/* RIGHT: polaroid strip + CTA card */}
              <div className="tt-hright">
                <div className="tt-polaroid-strip">
                  <div
                    className={`tt-polaroid tt-polaroid--a${hoveredPolaroid === 'a' ? ' tt-polaroid--hovered' : ''}`}
                    onMouseEnter={() => { if (polaroidLeaveTimerRef.current) clearTimeout(polaroidLeaveTimerRef.current); setHoveredPolaroid('a'); }}
                    onMouseLeave={() => { polaroidLeaveTimerRef.current = setTimeout(() => setHoveredPolaroid(null), 120); }}
                  >
                    <div className="tt-polaroid-face" style={{ background: "linear-gradient(145deg, #EAC890, #D4A460)" }}>
                      <IcoFaceSilhouette fill="rgba(110,60,10,0.22)" />
                    </div>
                    <div className="tt-polaroid-label">Alex</div>
                  </div>
                  <div
                    className={`tt-polaroid tt-polaroid--b${hoveredPolaroid === 'b' ? ' tt-polaroid--hovered' : ''}`}
                    onMouseEnter={() => { if (polaroidLeaveTimerRef.current) clearTimeout(polaroidLeaveTimerRef.current); setHoveredPolaroid('b'); }}
                    onMouseLeave={() => { polaroidLeaveTimerRef.current = setTimeout(() => setHoveredPolaroid(null), 120); }}
                  >
                    <div className="tt-polaroid-face" style={{ background: "linear-gradient(145deg, #C0D4E8, #9AB4CC)" }}>
                      <IcoFaceSilhouette fill="rgba(30,60,100,0.22)" />
                    </div>
                    <div className="tt-polaroid-label">Sam</div>
                  </div>
                  <div
                    className={`tt-polaroid tt-polaroid--c${hoveredPolaroid === 'c' ? ' tt-polaroid--hovered' : ''}`}
                    onMouseEnter={() => { if (polaroidLeaveTimerRef.current) clearTimeout(polaroidLeaveTimerRef.current); setHoveredPolaroid('c'); }}
                    onMouseLeave={() => { polaroidLeaveTimerRef.current = setTimeout(() => setHoveredPolaroid(null), 120); }}
                  >
                    <div className="tt-polaroid-face" style={{ background: "linear-gradient(145deg, #C8E4BC, #A8C898)" }}>
                      <IcoFaceSilhouette fill="rgba(20,70,20,0.22)" />
                    </div>
                    <div className="tt-polaroid-label">Jamie</div>
                  </div>
                </div>

                <div className="tt-cta-card">
                  <div className="tt-cta-card-eyebrow">Start in seconds</div>
                  <div className="tt-cta-card-title">Drop your photos,<br />get results instantly</div>
                  <p className="tt-cta-card-sub">
                    Zero config. Zero photo uploads. Results in your browser as fast as your device can process.
                  </p>
                  <button
                    type="button"
                    className="tt-btn-go"
                    onClick={() => setShowLanding(false)}
                  >
                    Try it free, no sign up
                  </button>
                  <div className="tt-trust-row">
                    <div className="tt-trust-item"><IcoShield /> No photo uploads</div>
                    <div className="tt-trust-item"><IcoLock /> No storage</div>
                    <div className="tt-trust-item"><IcoEyeOff /> No tracking</div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ── HOW IT WORKS ── */}
          <section className="tt-how tt-rev">
            <div className="tt-how-headline">How it <em>works</em></div>
            <p className="tt-how-sub">Four steps, entirely in your browser. No server ever sees your photos.</p>
            <div className="tt-how-layout">
              <div className="tt-how-particles-col">
                <HowParticles />
              </div>
              <div className="tt-how-grid">
                {([
                  { Icon: IcoDownload, step: "Step 1", title: "Upload photos", desc: "Drag your trip folder or select images. All data stays in-browser, nothing leaves this tab." },
                  { Icon: IcoScanFace, step: "Step 2", title: "Detect faces", desc: "RetinaFace ONNX model pinpoints every face across all your photos in seconds." },
                  { Icon: IcoLayers, step: "Step 3", title: "Create embeddings", desc: "ArcFace maps each face to a 512-dimensional vector that captures identity." },
                  { Icon: IcoSparkles, step: "Step 4", title: "Cluster people", desc: "DBSCAN groups similar embeddings automatically. No need to guess how many people." },
                ] as const).map((card, i) => (
                  <div key={i} className="tt-how-card">
                    <div className="tt-how-ico"><card.Icon /></div>
                    <div className="tt-how-step">{card.step}</div>
                    <div className="tt-how-title">{card.title}</div>
                    <p className="tt-how-desc">{card.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ── PRIVACY BLOCK ── */}
          <section className="tt-priv-block tt-rev">
            <div className="tt-priv-inner">
              <div>
                <div className="tt-priv-headline">Your photos <em>never</em><br />leave your device</div>
                <p className="tt-priv-text">
                  Every byte of your data is processed right inside this browser tab. The ML models run entirely in
                  WebAssembly. Your photos never hit our server, and optional Drive auth only stores an encrypted token.
                </p>
              </div>
              <div className="tt-priv-list">
                {([
                  { Icon: IcoBan, label: "Zero photo uploads", desc: "Photos never touch our server. Only optional Google auth requests leave the page." },
                  { Icon: IcoLock, label: "No persistent storage", desc: "Nothing written to disk, IndexedDB, or any server. Refresh and it's gone." },
                  { Icon: IcoEyeOff, label: "No tracking", desc: "No analytics, no telemetry, no third-party scripts phoning home." },
                  { Icon: IcoUser, label: "No account required to tag", desc: "Open the page, drop photos, get results. Google sign-in is only for Drive export." },
                ] as const).map((item, i) => (
                  <div key={i} className="tt-priv-item">
                    <div className="tt-priv-item-ico"><item.Icon /></div>
                    <div>
                      <div className="tt-priv-item-label">{item.label}</div>
                      <div className="tt-priv-item-desc">{item.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ── FOOTER ── */}
          <footer className="tt-footer tt-rev">
            <div className="tt-footer-logo">Trip<em>Tag</em></div>
            <div className="tt-footer-love">Made with love by people who care about your privacy</div>
            <div className="tt-footer-actions">
              <a href="/privacy" className="tt-footer-link">
                Privacy
              </a>
              <a
                href="https://buymeacoffee.com/darshbir"
                target="_blank"
                rel="noopener noreferrer"
                className="tt-footer-link tt-footer-coffee"
              >
                ☕ Buy me a coffee
              </a>
            </div>
          </footer>
        </div>
      </div>

      {/* ------------------------------------------
          SCREEN 1 � UPLOAD
      ------------------------------------------ */}
      <div ref={uploadScreenRef} tabIndex={-1} className={`tt-screen tt-screen--upload ${!showUpload ? "tt-screen--hidden" : ""}`} style={{ outline: "none" }}>
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
          {mlAvailable === false && !error && (
            <div className="tt-ml-unavailable-banner" style={{ width: "100%", maxWidth: 460, marginBottom: "0.75rem" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flexShrink: 0 }}>
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" strokeWidth="2.5" />
              </svg>
              <span>AI models could not load (WebGL or network issue). Upload photos to use <strong>manual mode</strong> — you can still group and export them.</span>
            </div>
          )}

          {error && (
            <div className="tt-error-banner" style={{ width: "100%", maxWidth: 460, marginBottom: "0.75rem" }}>
              {error}
            </div>
          )}

          {error && mlAvailable === false && files.length > 0 && (
            <button
              type="button"
              className="tt-btn-manual-mode"
              style={{ width: "100%", maxWidth: 460, marginBottom: "0.75rem" }}
              onClick={() => {
                const payload = files.map((file, i) => ({ id: String(i), file }));
                startManualMode(payload);
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
              </svg>
              Continue in manual mode
            </button>
          )}

          <DriveConnectionCard
            status={authStatus}
            user={authUser}
            error={authError}
            busy={authBusy}
            onConnect={() => {
              void signIn();
            }}
            onDisconnect={() => {
              void signOut();
            }}
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
        </div>
      </div>

      {/* ══════════════════════════════════════════
          SCREEN 2 — PROCESSING
      ══════════════════════════════════════════ */}
      <div className={`tt-screen tt-screen--proc ${!isProcessing ? "tt-screen--hidden" : ""}`}>
        <div className="tt-proc-wrap">
          <div className="tt-proc-header">
            <div className="tt-proc-title">
              Processing your <em>memories</em>
            </div>
            <div className="tt-proc-sub">
              All computation is happening right here in your tab. Zero bytes uploaded.
            </div>
          </div>

          <LiquidCanvas phase={progress.phase} />

          {/* Fun fact */}
          <div className="tt-fact-box">
            <div style={{ flexShrink: 0, color: "var(--accent2)", display: "flex", alignItems: "center", justifyContent: "center", width: 24, height: 24 }}><fact.Icon /></div>
            <div>
              <div className="tt-fact-label">Did you know?</div>
              <div className={`tt-fact-text ${factFade ? "tt-fact-text--fade" : ""}`}>
                {fact.text}
              </div>
            </div>
          </div>

          {/* Steps */}
          <div className="tt-steps">
            {STEPS.map((step, i) => {
              const state =
                activeStep === i ? "active" : activeStep > i ? "done" : "idle";
              const isActiveStep = state === "active";
              const barPct = state === "done" ? 100 : isActiveStep && pct !== null ? pct : 0;
              const isIndeterminate = isActiveStep && pct === null;
              return (
                <div
                  key={i}
                  className={`tt-step ${state === "active" ? "tt-step--active" : ""} ${state === "done" ? "tt-step--done" : ""}`}
                >
                  <div className="tt-step-header">
                    <div className="tt-step-ico" style={{ color: "var(--accent2)" }}><step.Icon /></div>
                    <div className="tt-step-info">
                      <div className="tt-step-label">{step.label}</div>
                      <div className="tt-step-detail">
                        {state === "active" ? (progress.message ?? step.sublabel) : state === "done" ? "Completed" : step.sublabel}
                      </div>
                    </div>
                    <div className="tt-step-status">
                      {state === "done" ? <><IcoCheckDone /> done</> : state === "active" ? "running…" : "waiting"}
                    </div>
                  </div>
                  <div className="tt-pbar-track">
                    <div
                      className={`tt-pbar-fill${isIndeterminate ? " tt-pbar-fill--indeterminate" : ""}`}
                      style={isIndeterminate ? undefined : { width: `${barPct}%` }}
                    />
                  </div>
                  {isActiveStep && (
                    <div className="tt-prog-meta">
                      <span>{pct !== null ? `${pct}%` : "initialising…"}</span>
                      {eta && <span>{eta}</span>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════
          SCREEN 3 — RESULTS
      ══════════════════════════════════════════ */}
      <div className={`tt-screen tt-screen--results ${!showResults ? "tt-screen--hidden" : ""}`}>
        <div className="tt-results-wrap">
          <div className="tt-res-header">
            <div>
              <div className="tt-res-title">
                <em>{namedClusters.length}</em> {namedClusters.length === 1 ? "person" : "people"} identified
              </div>
            </div>
            <div className="tt-res-meta">
              {files.length} photo{files.length !== 1 ? "s" : ""} · {totalFaces} face{totalFaces !== 1 ? "s" : ""}
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
              <div className="tt-sum-n">{driveConnected ? "Ready" : "Optional"}</div>
              <div className="tt-sum-l">Drive session</div>
            </div>
            <button
              type="button"
              className="tt-btn-new-scan"
              onClick={handleOpenExportModal}
              disabled={namedClusters.length === 0 || exportBusy}
              title={namedClusters.length === 0 ? "Name at least one person before exporting" : "Export to Google Drive"}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              {exportBusy ? "Exporting…" : "Export"}
            </button>
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

          <DriveConnectionCard
            compact
            status={authStatus}
            user={authUser}
            error={authError}
            busy={authBusy}
            onConnect={() => {
              void signIn();
            }}
            onDisconnect={() => {
              void signOut();
            }}
          />

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
              imageClusterMap={imageAssignments}
              onRename={setClusterName}
              onMerge={mergeClusters}
              onSplit={splitCluster}
              onAssignToCluster={assignDetectionsToCluster}
              onAssignImageToCluster={assignImageToCluster}
              onClearImageAssignment={clearImageAssignment}
            />
          )}
        </div>
      </div>

      <div className={`tt-screen tt-screen--results ${!showExportResults ? "tt-screen--hidden" : ""}`}>
        {exportSummary ? (
          <DriveExportResults
            summary={exportSummary}
            onBack={() => setResultsView("clusters")}
            onNewScan={handleReset}
            onCopyLink={handleCopyExportLink}
            copiedLinkId={copiedLinkId}
            copyToast={copyToast}
          />
        ) : null}
      </div>

      <DriveExportModal
        isOpen={isExportModalOpen}
        manifest={exportManifest.characters.length > 0 ? exportManifest : null}
        nameDrafts={nameDrafts}
        onNameChange={handleExportNameChange}
        onClose={() => setIsExportModalOpen(false)}
        onConnectDrive={handleConnectDriveForExport}
        onExport={handleExportToDrive}
        authStatus={authStatus}
        authBusy={authBusy}
        quota={quota}
        quotaLoading={quotaLoading}
        quotaError={quotaError}
        exportBusy={exportBusy}
        exportStatusMessage={exportStatusMessage}
        exportError={exportError}
        exportSuccessMessage={exportSuccessMessage}
      />
    </Layout>
  );
}
