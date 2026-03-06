import { NextRequest, NextResponse } from "next/server";
import type { AuthMeResponse } from "@/lib/authTypes";
import {
  GOOGLE_SESSION_COOKIE,
  getExpiredCookieOptions,
  parseGoogleSession,
} from "@/lib/googleAuth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = parseGoogleSession(request.cookies.get(GOOGLE_SESSION_COOKIE)?.value);

  const payload: AuthMeResponse = session
    ? {
        authenticated: true,
        user: {
          sub: session.sub,
          email: session.email,
          name: session.name,
          picture: session.picture,
        },
      }
    : { authenticated: false };

  const response = NextResponse.json(payload, {
    headers: {
      "Cache-Control": "no-store",
    },
  });

  if (!session && request.cookies.get(GOOGLE_SESSION_COOKIE)?.value) {
    response.cookies.set(GOOGLE_SESSION_COOKIE, "", getExpiredCookieOptions());
  }

  return response;
}
