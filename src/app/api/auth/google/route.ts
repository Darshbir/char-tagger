import { NextRequest, NextResponse } from "next/server";
import {
  GOOGLE_AUTH_COOKIE,
  buildGoogleAuthorizationUrl,
  createOAuthState,
  getOAuthCookieOptions,
  serializeOAuthState,
} from "@/lib/googleAuth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const popup = request.nextUrl.searchParams.get("popup") === "1";
    const oauthState = createOAuthState(popup);
    const response = NextResponse.redirect(buildGoogleAuthorizationUrl(request, oauthState));
    response.cookies.set(GOOGLE_AUTH_COOKIE, serializeOAuthState(oauthState), getOAuthCookieOptions());
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Google OAuth is not configured.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
