"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { UploadZone } from "@/components/UploadZone";
import { Layout } from "@/components/Layout";
import { ClusterResults } from "@/components/ClusterResults";
import { useFacePipeline } from "@/hooks/useFacePipeline";
import {
  getClusterOptions,
  setClusterOptions,
  type ClusterMethod,
} from "@/lib/clustering";

export default function Home() {
  const [files, setFiles] = useState<File[]>([]);
  const [clusterMethod, setClusterMethod] = useState<ClusterMethod>("dbscan");
  const [kmeansK, setKmeansK] = useState(5);

  useEffect(() => {
    const opts = getClusterOptions();
    setClusterMethod(opts.method);
    setKmeansK(opts.k ?? 5);
  }, []);

  const {
    progress,
    tagged,
    clusters,
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
    const payload = files.map((file, i) => ({ id: String(i), file }));
    runPipeline(payload);
  }, [files, runPipeline]);

  const handleReset = useCallback(() => {
    reset();
  }, [reset]);

  const isProcessing =
    progress.phase === "loading" ||
    progress.phase === "detecting" ||
    progress.phase === "embedding" ||
    progress.phase === "clustering";
  const showResults = progress.phase === "done" && clusters.length >= 0;

  return (
    <Layout>
      <main className="flex flex-1 flex-col items-center p-8">
        <h1 className="mb-2 text-2xl font-semibold">Character Tagger</h1>
        <p className="mb-8 text-center text-gray-600 dark:text-gray-400">
          Upload photos to detect and tag recurring characters. Processing runs
          in your browser; no images are sent to any server.
        </p>

        <div className="mb-4 w-full max-w-xl rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50">
          <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
            Clustering
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">Method:</span>
              <select
                value={clusterMethod}
                onChange={(e) => {
                  const m = e.target.value as ClusterMethod;
                  setClusterMethod(m);
                  setClusterOptions({ method: m });
                }}
                className="rounded border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
              >
                <option value="dbscan">DBSCAN (default)</option>
                <option value="kmeans">K-means</option>
              </select>
            </label>
            {clusterMethod === "kmeans" && (
              <label className="flex items-center gap-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Expected characters (k):
                </span>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={kmeansK}
                  onChange={(e) => {
                    const v = Math.max(1, Math.min(100, parseInt(e.target.value, 10) || 1));
                    setKmeansK(v);
                    setClusterOptions({ k: v });
                  }}
                  className="w-16 rounded border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
                />
              </label>
            )}
          </div>
        </div>

        <UploadZone
          files={files}
          onFilesChange={setFiles}
          showProcessHint={true}
          actions={
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleProcess}
                disabled={files.length === 0 || isProcessing}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
              >
                {isProcessing
                  ? progress.message ?? "Processing…"
                  : "Process"}
              </button>
              {progress.phase === "done" && (
                <button
                  type="button"
                  onClick={handleReset}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800"
                >
                  Reset results
                </button>
              )}
            </div>
          }
        />

        {isProcessing && (
          <div className="mt-6 w-full max-w-xl rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {progress.message}
            </p>
            {progress.total != null && progress.total > 0 && (
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                <div
                  className="h-full rounded-full bg-blue-500 transition-all duration-300"
                  style={{
                    width: `${Math.min(100, ((progress.current ?? 0) / progress.total) * 100)}%`,
                  }}
                />
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="mt-6 w-full max-w-xl rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200">
            {error}
          </div>
        )}

        {showResults && (
          <div className="mt-8 w-full max-w-4xl">
            <ClusterResults
              clusters={clusters}
              tagged={tagged}
              filesById={filesById}
              onRename={setClusterName}
              onMerge={mergeClusters}
              onSplit={splitCluster}
              onAssignToCluster={assignDetectionsToCluster}
            />
          </div>
        )}
      </main>
    </Layout>
  );
}
