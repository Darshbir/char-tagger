import { NextResponse } from "next/server";
import {
  GOOGLE_AUTH_COOKIE,
  GOOGLE_SESSION_COOKIE,
  getExpiredCookieOptions,
} from "@/lib/googleAuth";

export const dynamic = "force-dynamic";

export async function POST() {
  const response = NextResponse.json({ ok: true }, {
    headers: {
      "Cache-Control": "no-store",
    },
  });

  response.cookies.set(GOOGLE_SESSION_COOKIE, "", getExpiredCookieOptions());
  response.cookies.set(GOOGLE_AUTH_COOKIE, "", getExpiredCookieOptions());
  return response;
}
