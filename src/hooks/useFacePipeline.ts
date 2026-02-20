"use client";

import { useCallback, useState } from "react";
import type { TaggedDetection, ClusterSummary, PipelineProgress } from "@/lib/types";
import { loadFaceModels, runDetectionPipeline } from "@/lib/facePipeline";
import type { PipelineProgressUpdate } from "@/lib/facePipeline";
import { clusterDetections, getClusterOptions, type ClusterOptions } from "@/lib/clustering";

export interface FacePipelineState {
  progress: PipelineProgress;
  tagged: TaggedDetection[];
  clusters: ClusterSummary[];
  error: string | null;
  modelsLoaded: boolean;
}

const initialProgress: PipelineProgress = {
  phase: "idle",
};

export function useFacePipeline() {
  const [progress, setProgress] = useState<PipelineProgress>(initialProgress);
  const [tagged, setTagged] = useState<TaggedDetection[]>([]);
  const [clusters, setClusters] = useState<ClusterSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [modelsLoaded, setModelsLoaded] = useState(false);

  const runPipeline = useCallback(
    async (files: Array<{ id: string; file: File }>) => {
      if (files.length === 0) return;
      setError(null);
      setProgress({ phase: "loading", message: "Loading face detection and ArcFace models…" });

      try {
        await loadFaceModels();
        setModelsLoaded(true);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Failed to load models";
        setProgress({ phase: "error", message: msg });
        setError(msg);
        return;
      }

      setProgress({
        phase: "detecting",
        current: 0,
        total: files.length,
        message: "Detecting faces…",
      });

      let detections;
      try {
        detections = await runDetectionPipeline(files, (update: PipelineProgressUpdate) => {
          setProgress({
            phase: update.phase,
            current: update.current,
            total: update.total,
            message: update.message,
          });
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Detection failed";
        setProgress({ phase: "error", message: msg });
        setError(msg);
        return;
      }

      setProgress({
        phase: "clustering",
        message: "Grouping same character…",
      });
      await new Promise((r) => setTimeout(r, 0));

      const clusterOptions: ClusterOptions = getClusterOptions();
      const { tagged: newTagged, clusters: newClusters } = clusterDetections(detections, clusterOptions);
      setTagged(newTagged);
      setClusters(newClusters);
      setProgress({
        phase: "done",
        message: `Done. ${newClusters.length} character${newClusters.length !== 1 ? "s" : ""} found.`,
      });
    },
    []
  );

  const reset = useCallback(() => {
    setProgress(initialProgress);
    setTagged([]);
    setClusters([]);
    setError(null);
  }, []);

  return {
    progress,
    tagged,
    clusters,
    error,
    modelsLoaded,
    runPipeline,
    reset,
  };
}
