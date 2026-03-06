import { APP_NAME, UNCATEGORIZED_CLUSTER_ID } from "@/lib/constants";
import type { ClusterSummary, TaggedDetection } from "@/lib/types";

export interface DriveQuotaSummary {
  limitBytes: number | null;
  usageBytes: number | null;
  availableBytes: number | null;
  isUnlimited: boolean;
}

export interface DriveExportSessionResponse {
  accessToken: string;
  quota: DriveQuotaSummary;
  email?: string;
}

export interface ExportCharacterFolder {
  clusterId: number;
  name: string;
  folderName: string;
  imageIds: string[];
  fileCount: number;
  reviewed: boolean;
}

export interface ExportReviewItem {
  clusterId: number;
  currentName: string;
  suggestedFolderName: string;
  fileCount: number;
}

export interface DriveExportManifest {
  exportKey: string;
  rootFolderName: string;
  allImageIds: string[];
  totalBytes: number;
  characters: ExportCharacterFolder[];
  needsReview: ExportReviewItem[];
}

export interface DriveFolderLink {
  id: string;
  name: string;
  url: string;
}

export interface DriveCharacterFolderLink extends DriveFolderLink {
  clusterId: number;
  fileCount: number;
}

export interface DriveExportResultSummary {
  rootFolder: DriveFolderLink;
  allFolder: DriveFolderLink;
  characters: DriveCharacterFolderLink[];
  totalBytes: number;
  uploadedCount: number;
  shortcutCount: number;
}

export function getDefaultClusterName(clusterId: number): string {
  return clusterId === UNCATEGORIZED_CLUSTER_ID ? "Uncategorized" : `Character ${clusterId}`;
}

export function sanitizeDriveFolderName(name: string): string {
  const cleaned = name
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^\.+|\.+$/g, "")
    .trim();
  return cleaned;
}

function uniquifyFolderNames(entries: Array<{ clusterId: number; preferredName: string }>): Map<number, string> {
  const used = new Map<string, number>();
  const next = new Map<number, string>();

  for (const entry of entries) {
    const base = sanitizeDriveFolderName(entry.preferredName) || getDefaultClusterName(entry.clusterId);
    const key = base.toLocaleLowerCase();
    const seen = used.get(key) ?? 0;
    used.set(key, seen + 1);
    next.set(entry.clusterId, seen === 0 ? base : `${base} (${seen + 1})`);
  }

  return next;
}

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null || !Number.isFinite(bytes)) return "Unknown";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes;
  let unitIndex = -1;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(value >= 10 || unitIndex <= 0 ? 1 : 2)} ${units[unitIndex]}`;
}

export function buildExportRootFolderName(now = new Date()): string {
  const isoDate = now.toISOString().slice(0, 10);
  return `${APP_NAME} Export ${isoDate}`;
}

function stableHash(value: string): string {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function escapeDriveQueryValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function buildExportKey(params: {
  characters: ExportCharacterFolder[];
  filesById: Map<string, File>;
  allImageIds: string[];
}): string {
  const { characters, filesById, allImageIds } = params;
  const fileSignature = allImageIds
    .map((imageId) => {
      const file = filesById.get(imageId);
      return `${imageId}:${file?.name ?? ""}:${file?.size ?? 0}:${file?.lastModified ?? 0}`;
    })
    .join("|");
  const clusterSignature = characters
    .map((cluster) => `${cluster.clusterId}:${cluster.folderName}:${cluster.imageIds.join(",")}`)
    .join("|");
  return `tt-export-${stableHash(`${fileSignature}::${clusterSignature}`)}`;
}

export function buildDriveExportManifest(params: {
  clusters: ClusterSummary[];
  tagged: TaggedDetection[];
  filesById: Map<string, File>;
  reviewedClusterIds: Set<number>;
  imageAssignments: Map<string, number>;
}): DriveExportManifest {
  const { clusters, tagged, filesById, reviewedClusterIds, imageAssignments } = params;
  const fileOrder = Array.from(filesById.keys());
  const namedClusters = clusters.filter((cluster) => cluster.clusterId !== UNCATEGORIZED_CLUSTER_ID);

  const imageIdsByClusterId = new Map<number, Set<string>>();
  for (const detection of tagged) {
    if (detection.clusterId === UNCATEGORIZED_CLUSTER_ID) continue;
    const clusterImages = imageIdsByClusterId.get(detection.clusterId) ?? new Set<string>();
    clusterImages.add(detection.imageId);
    imageIdsByClusterId.set(detection.clusterId, clusterImages);
  }

  imageAssignments.forEach((clusterId, imageId) => {
    if (clusterId === UNCATEGORIZED_CLUSTER_ID || !filesById.has(imageId)) return;
    const clusterImages = imageIdsByClusterId.get(clusterId) ?? new Set<string>();
    clusterImages.add(imageId);
    imageIdsByClusterId.set(clusterId, clusterImages);
  });

  const folderNames = uniquifyFolderNames(
    namedClusters.map((cluster) => ({
      clusterId: cluster.clusterId,
      preferredName: cluster.name || getDefaultClusterName(cluster.clusterId),
    }))
  );

  const characters: ExportCharacterFolder[] = namedClusters
    .map((cluster) => {
      const imageIdsSet = imageIdsByClusterId.get(cluster.clusterId) ?? new Set<string>();
      const imageIds = fileOrder.filter((imageId) => imageIdsSet.has(imageId));
      return {
        clusterId: cluster.clusterId,
        name: cluster.name || getDefaultClusterName(cluster.clusterId),
        folderName: folderNames.get(cluster.clusterId) ?? getDefaultClusterName(cluster.clusterId),
        imageIds,
        fileCount: imageIds.length,
        reviewed: reviewedClusterIds.has(cluster.clusterId),
      };
    })
    .filter((cluster) => cluster.fileCount > 0);

  const allImageIds = fileOrder;
  const totalBytes = allImageIds.reduce((sum, imageId) => sum + (filesById.get(imageId)?.size ?? 0), 0);
  const exportKey = buildExportKey({
    characters,
    filesById,
    allImageIds,
  });

  return {
    exportKey,
    rootFolderName: buildExportRootFolderName(),
    allImageIds,
    totalBytes,
    characters,
    needsReview: characters
      .filter((cluster) => !cluster.reviewed)
      .map((cluster) => ({
        clusterId: cluster.clusterId,
        currentName: cluster.name,
        suggestedFolderName: cluster.folderName,
        fileCount: cluster.fileCount,
      })),
  };
}

async function parseDriveJson<T>(response: Response): Promise<T> {
  if (response.ok) {
    return (await response.json()) as T;
  }

  let message = "Google Drive request failed.";
  try {
    const errorPayload = (await response.json()) as { error?: { message?: string } };
    message = errorPayload.error?.message || message;
  } catch {
    // ignore
  }
  throw new Error(message);
}

async function delay(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withDriveRetry<T>(operationName: string, operation: () => Promise<T>, maxAttempts = 3): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt >= maxAttempts) break;
      await delay(300 * 2 ** (attempt - 1));
    }
  }

  const message = lastError instanceof Error ? lastError.message : `${operationName} failed.`;
  throw new Error(`${operationName} failed after ${maxAttempts} attempts. ${message}`);
}

async function findDriveFiles<T extends Record<string, unknown>>(params: {
  accessToken: string;
  q: string;
  fields: string;
}): Promise<T[]> {
  const url = new URL("https://www.googleapis.com/drive/v3/files");
  url.searchParams.set("q", params.q);
  url.searchParams.set("fields", `files(${params.fields})`);
  url.searchParams.set("supportsAllDrives", "false");

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
    },
  });

  const data = await parseDriveJson<{ files?: T[] }>(response);
  return data.files ?? [];
}

export async function getDriveItemLink(accessToken: string, fileId: string): Promise<{ id: string; name: string; webViewLink: string }> {
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,webViewLink`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  return parseDriveJson<{ id: string; name: string; webViewLink: string }>(response);
}

export async function ensureDriveFolder(
  accessToken: string,
  params: { name: string; parentId?: string; appProperties: Record<string, string> }
): Promise<{ id: string; name: string; webViewLink: string }> {
  const qParts = [
    "trashed = false",
    `mimeType = 'application/vnd.google-apps.folder'`,
    ...Object.entries(params.appProperties).map(
      ([key, value]) => `appProperties has { key='${escapeDriveQueryValue(key)}' and value='${escapeDriveQueryValue(value)}' }`
    ),
  ];

  if (params.parentId) {
    qParts.push(`'${escapeDriveQueryValue(params.parentId)}' in parents`);
  }

  const existing = await findDriveFiles<{ id: string; name: string; webViewLink: string }>({
    accessToken,
    q: qParts.join(" and "),
    fields: "id,name,webViewLink",
  });
  if (existing[0]) {
    return existing[0];
  }

  const response = await fetch("https://www.googleapis.com/drive/v3/files?fields=id,name,webViewLink", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: params.name,
      mimeType: "application/vnd.google-apps.folder",
      appProperties: params.appProperties,
      ...(params.parentId ? { parents: [params.parentId] } : {}),
    }),
  });

  return parseDriveJson<{ id: string; name: string; webViewLink: string }>(response);
}

export async function createDriveFolder(accessToken: string, name: string, parentId?: string): Promise<{ id: string; name: string }> {
  const response = await fetch("https://www.googleapis.com/drive/v3/files?fields=id,name", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name,
      mimeType: "application/vnd.google-apps.folder",
      ...(parentId ? { parents: [parentId] } : {}),
    }),
  });

  return parseDriveJson<{ id: string; name: string }>(response);
}

export async function uploadFileToDrive(accessToken: string, file: File, parentId: string): Promise<{ id: string; name: string }> {
  const boundary = `char-tagger-${typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Date.now().toString(36)}`;
  const metadata = {
    name: file.name,
    mimeType: file.type || "application/octet-stream",
    parents: [parentId],
  };
  const body = new Blob([
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`,
    `--${boundary}\r\nContent-Type: ${file.type || "application/octet-stream"}\r\n\r\n`,
    file,
    `\r\n--${boundary}--`,
  ]);

  const response = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body,
  });

  return parseDriveJson<{ id: string; name: string }>(response);
}

export async function ensureUploadedFile(
  accessToken: string,
  params: { file: File; parentId: string; appProperties: Record<string, string> }
): Promise<{ id: string; name: string }> {
  const q = [
    "trashed = false",
    ...Object.entries(params.appProperties).map(
      ([key, value]) => `appProperties has { key='${escapeDriveQueryValue(key)}' and value='${escapeDriveQueryValue(value)}' }`
    ),
    `'${escapeDriveQueryValue(params.parentId)}' in parents`,
  ].join(" and ");

  const existing = await findDriveFiles<{ id: string; name: string }>({
    accessToken,
    q,
    fields: "id,name",
  });
  if (existing[0]) {
    return existing[0];
  }

  const boundary = `char-tagger-${typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Date.now().toString(36)}`;
  const metadata = {
    name: params.file.name,
    mimeType: params.file.type || "application/octet-stream",
    parents: [params.parentId],
    appProperties: params.appProperties,
  };
  const body = new Blob([
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`,
    `--${boundary}\r\nContent-Type: ${params.file.type || "application/octet-stream"}\r\n\r\n`,
    params.file,
    `\r\n--${boundary}--`,
  ]);

  const response = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body,
  });

  return parseDriveJson<{ id: string; name: string }>(response);
}

export async function createDriveShortcut(accessToken: string, params: { name: string; targetId: string; parentId: string }): Promise<{ id: string; name: string }> {
  const response = await fetch("https://www.googleapis.com/drive/v3/files?fields=id,name", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: params.name,
      mimeType: "application/vnd.google-apps.shortcut",
      parents: [params.parentId],
      shortcutDetails: {
        targetId: params.targetId,
      },
    }),
  });

  return parseDriveJson<{ id: string; name: string }>(response);
}

export async function ensureDriveShortcut(
  accessToken: string,
  params: { name: string; targetId: string; parentId: string; appProperties: Record<string, string> }
): Promise<{ id: string; name: string }> {
  const q = [
    "trashed = false",
    `mimeType = 'application/vnd.google-apps.shortcut'`,
    ...Object.entries(params.appProperties).map(
      ([key, value]) => `appProperties has { key='${escapeDriveQueryValue(key)}' and value='${escapeDriveQueryValue(value)}' }`
    ),
    `'${escapeDriveQueryValue(params.parentId)}' in parents`,
  ].join(" and ");

  const existing = await findDriveFiles<{ id: string; name: string }>({
    accessToken,
    q,
    fields: "id,name",
  });
  if (existing[0]) {
    return existing[0];
  }

  const response = await fetch("https://www.googleapis.com/drive/v3/files?fields=id,name", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: params.name,
      mimeType: "application/vnd.google-apps.shortcut",
      parents: [params.parentId],
      appProperties: params.appProperties,
      shortcutDetails: {
        targetId: params.targetId,
      },
    }),
  });

  return parseDriveJson<{ id: string; name: string }>(response);
}

export async function ensureAnyoneReaderPermission(accessToken: string, fileId: string): Promise<void> {
  const permissionsResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions?fields=permissions(id,type,role)`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const permissions = await parseDriveJson<{ permissions?: Array<{ id: string; type: string; role: string }> }>(permissionsResponse);
  const alreadyShared = permissions.permissions?.some((permission) => permission.type === "anyone" && permission.role === "reader");
  if (alreadyShared) return;

  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions?supportsAllDrives=false&sendNotificationEmail=false`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      role: "reader",
      type: "anyone",
    }),
  });

  await parseDriveJson<{ id: string }>(response);
}
