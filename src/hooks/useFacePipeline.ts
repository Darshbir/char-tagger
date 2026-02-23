"use client";

import { useCallback, useMemo, useState } from "react";
import type { TaggedDetection, ClusterSummary, PipelineProgress } from "@/lib/types";
import { detectionId } from "@/lib/types";
import { loadDetectorModels, runDetectionPipeline } from "@/lib/facePipeline";
import type { PipelineProgressUpdate } from "@/lib/facePipeline";
import type { FaceDetectorType } from "@/lib/constants";
import { clusterDetections, getClusterOptions, type ClusterOptions } from "@/lib/clustering";
import { UNCATEGORIZED_CLUSTER_ID } from "@/lib/constants";

/** Ensure cluster 0 (Uncategorized) is always in the list so user can assign to it. */
function normalizeClusters(clusters: ClusterSummary[], names: Map<number, string>): ClusterSummary[] {
  const hasUncategorized = clusters.some((c) => c.clusterId === UNCATEGORIZED_CLUSTER_ID);
  if (hasUncategorized) return clusters;
  return [
    {
      clusterId: UNCATEGORIZED_CLUSTER_ID,
      name: names.get(UNCATEGORIZED_CLUSTER_ID) ?? "Uncategorized",
      detectionIds: [],
    },
    ...clusters,
  ].sort((a, b) => a.clusterId - b.clusterId);
}

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
  const [imageIdsWithNoFaces, setImageIdsWithNoFaces] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [modelsLoaded, setModelsLoaded] = useState(false);

  /** Persist custom cluster names across edit actions */
  const [clusterNames, setClusterNames] = useState<Map<number, string>>(new Map());

  const runPipeline = useCallback(
    async (
      files: Array<{ id: string; file: File }>,
      options?: { detector?: FaceDetectorType }
    ) => {
      if (files.length === 0) return;
      const detector = options?.detector ?? "retinaface";
      setError(null);
      setProgress({ phase: "loading", message: "Loading face detection and ArcFace models…" });

      try {
        await loadDetectorModels(detector);
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
        detections = await runDetectionPipeline(
          files,
          (update: PipelineProgressUpdate) => {
            setProgress({
              phase: update.phase,
              current: update.current,
              total: update.total,
              message: update.message,
            });
          },
          undefined,
          detector
        );
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
      const imageIdsWithFaces = new Set(detections.map((d) => d.imageId));
      const noFaceIds = files.map((f) => f.id).filter((id) => !imageIdsWithFaces.has(id));
      setTagged(newTagged);
      setClusters(newClusters);
      setImageIdsWithNoFaces(noFaceIds);
      const names = new Map<number, string>();
      for (const c of newClusters) names.set(c.clusterId, c.name);
      setClusterNames(names);
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
    setImageIdsWithNoFaces([]);
    setClusterNames(new Map());
    setError(null);
  }, []);

  const setClusterName = useCallback((clusterId: number, name: string) => {
    const trimmed = name.trim();
    setClusterNames((prev) => {
      const next = new Map(prev);
      next.set(clusterId, trimmed || (clusterId === UNCATEGORIZED_CLUSTER_ID ? "Uncategorized" : `Character ${clusterId}`));
      return next;
    });
    setClusters((prev) =>
      prev.map((c) => (c.clusterId === clusterId ? { ...c, name: trimmed || c.name } : c))
    );
  }, []);

  const mergeClusters = useCallback((sourceId: number, targetId: number) => {
    if (sourceId === targetId) return;
    setTagged((prev) =>
      prev.map((t) => (t.clusterId === sourceId ? { ...t, clusterId: targetId } : t))
    );
    setClusters((prev) => {
      const next = prev.filter((c) => c.clusterId !== sourceId);
      const target = next.find((c) => c.clusterId === targetId);
      if (!target) return next;
      const source = prev.find((c) => c.clusterId === sourceId);
      const mergedIds = [...target.detectionIds, ...(source?.detectionIds ?? [])];
      return next.map((c) => (c.clusterId === targetId ? { ...c, detectionIds: mergedIds } : c));
    });
  }, []);

  const splitCluster = useCallback(
    (clusterId: number, detectionIdsToMove: string[], targetClusterId?: number) => {
      if (detectionIdsToMove.length === 0) return;
      setTagged((prev) => {
        const idsSet = new Set(detectionIdsToMove);
        const newId =
          targetClusterId ??
          Math.max(UNCATEGORIZED_CLUSTER_ID, ...prev.map((t) => t.clusterId), 0) + 1;
        return prev.map((t) => {
          const id = detectionId(t.imageId, t.detectionIndex);
          return idsSet.has(id) ? { ...t, clusterId: newId } : t;
        });
      });
      setClusters((prev) => {
        const idsSet = new Set(detectionIdsToMove);
        const newId =
          targetClusterId ??
          Math.max(UNCATEGORIZED_CLUSTER_ID, ...prev.map((c) => c.clusterId), 0) + 1;
        const withNew =
          targetClusterId == null
            ? [
                ...prev,
                {
                  clusterId: newId,
                  name: `Character ${newId}`,
                  detectionIds: detectionIdsToMove,
                },
              ]
            : prev.map((c) => {
                if (c.clusterId !== clusterId && c.clusterId !== targetClusterId) return c;
                if (c.clusterId === clusterId) {
                  return { ...c, detectionIds: c.detectionIds.filter((id) => !idsSet.has(id)) };
                }
                return { ...c, detectionIds: [...c.detectionIds, ...detectionIdsToMove] };
              });
        if (targetClusterId == null) {
          setClusterNames((n) => new Map(n).set(newId, `Character ${newId}`));
          return withNew
            .map((c) => (c.clusterId === clusterId ? { ...c, detectionIds: c.detectionIds.filter((id) => !idsSet.has(id)) } : c))
            .filter((c) => c.detectionIds.length > 0 || c.clusterId === UNCATEGORIZED_CLUSTER_ID);
        }
        return withNew
          .map((c) => (c.clusterId === clusterId ? { ...c, detectionIds: c.detectionIds.filter((id) => !idsSet.has(id)) } : c))
          .filter((c) => c.detectionIds.length > 0 || c.clusterId === UNCATEGORIZED_CLUSTER_ID);
      });
    },
    []
  );

  const assignDetectionsToCluster = useCallback((detectionIds: string[], targetClusterId: number) => {
    if (detectionIds.length === 0) return;
    const idsSet = new Set(detectionIds);
    setTagged((prev) =>
      prev.map((t) => {
        const id = detectionId(t.imageId, t.detectionIndex);
        return idsSet.has(id) ? { ...t, clusterId: targetClusterId } : t;
      })
    );
    setClusters((prev) => {
      const updates = new Map(prev.map((c) => [c.clusterId, { ...c }]));
      for (const c of prev) {
        const removed = c.detectionIds.filter((id) => idsSet.has(id));
        if (removed.length > 0) {
          const cur = updates.get(c.clusterId)!;
          cur.detectionIds = cur.detectionIds.filter((id) => !idsSet.has(id));
        }
      }
      const target = updates.get(targetClusterId);
      if (target) {
        target.detectionIds = [...target.detectionIds, ...detectionIds];
      } else {
        updates.set(targetClusterId, {
          clusterId: targetClusterId,
          name: targetClusterId === UNCATEGORIZED_CLUSTER_ID ? "Uncategorized" : `Character ${targetClusterId}`,
          detectionIds: [...detectionIds],
        });
        setClusterNames((n) =>
          new Map(n).set(
            targetClusterId,
            targetClusterId === UNCATEGORIZED_CLUSTER_ID ? "Uncategorized" : `Character ${targetClusterId}`
          )
        );
      }
      let out = Array.from(updates.values());
      if (!out.some((c) => c.clusterId === UNCATEGORIZED_CLUSTER_ID)) {
        out = [{ clusterId: UNCATEGORIZED_CLUSTER_ID, name: "Uncategorized", detectionIds: [] }, ...out];
      }
      return out
        .sort((a, b) => a.clusterId - b.clusterId)
        .filter((c) => c.detectionIds.length > 0 || c.clusterId === UNCATEGORIZED_CLUSTER_ID);
    });
  }, []);

  const clustersNormalized = useMemo(
    () => normalizeClusters(clusters, clusterNames),
    [clusters, clusterNames]
  );

  return {
    progress,
    tagged,
    clusters: clustersNormalized,
    imageIdsWithNoFaces,
    error,
    modelsLoaded,
    runPipeline,
    reset,
    setClusterName,
    mergeClusters,
    splitCluster,
    assignDetectionsToCluster,
  };
}
