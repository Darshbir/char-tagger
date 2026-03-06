import { NextRequest, NextResponse } from "next/server";
import { DriveAuthError, getDriveAccess } from "@/lib/googleDrive";
import type { DriveExportSessionResponse } from "@/lib/driveExport";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await getDriveAccess(request);
    const payload: DriveExportSessionResponse = {
      accessToken: session.accessToken,
      quota: session.quota,
      email: session.email,
    };

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const status = error instanceof DriveAuthError ? error.status : 500;
    const message = error instanceof Error ? error.message : "Unable to prepare Drive export.";
    return NextResponse.json(
      { error: message },
      {
        status,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }
}
