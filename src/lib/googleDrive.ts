import "server-only";

import type { NextRequest } from "next/server";
import { GOOGLE_SESSION_COOKIE, parseGoogleSession, refreshGoogleAccessToken } from "@/lib/googleAuth";
import type { DriveQuotaSummary } from "@/lib/driveExport";

export class DriveAuthError extends Error {
  status: number;

  constructor(message: string, status = 401) {
    super(message);
    this.name = "DriveAuthError";
    this.status = status;
  }
}

function parseQuotaValue(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function getDriveAccess(request: NextRequest): Promise<{
  accessToken: string;
  email?: string;
  quota: DriveQuotaSummary;
}> {
  const session = parseGoogleSession(request.cookies.get(GOOGLE_SESSION_COOKIE)?.value);
  if (!session?.refreshToken) {
    throw new DriveAuthError("Connect Google Drive before exporting.", 401);
  }

  const { accessToken } = await refreshGoogleAccessToken(session.refreshToken);
  const aboutResponse = await fetch(
    "https://www.googleapis.com/drive/v3/about?fields=storageQuota,user(emailAddress)",
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    }
  );

  if (!aboutResponse.ok) {
    throw new DriveAuthError("Unable to read Google Drive storage details right now.", 502);
  }

  const aboutJson = (await aboutResponse.json()) as {
    storageQuota?: {
      limit?: string;
      usage?: string;
    };
    user?: {
      emailAddress?: string;
    };
  };

  const limitBytes = parseQuotaValue(aboutJson.storageQuota?.limit);
  const usageBytes = parseQuotaValue(aboutJson.storageQuota?.usage);
  const isUnlimited = limitBytes == null;
  const availableBytes = limitBytes != null && usageBytes != null ? Math.max(limitBytes - usageBytes, 0) : null;

  return {
    accessToken,
    email: aboutJson.user?.emailAddress ?? session.email,
    quota: {
      limitBytes,
      usageBytes,
      availableBytes,
      isUnlimited,
    },
  };
}
