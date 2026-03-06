import { NextRequest, NextResponse } from "next/server";
import type { PendingGoogleOAuthState, StoredGoogleSession } from "@/lib/authTypes";
import {
  GOOGLE_AUTH_COOKIE,
  GOOGLE_SESSION_COOKIE,
  exchangeGoogleAuthCode,
  fetchGoogleUser,
  getAppBaseUrl,
  getExpiredCookieOptions,
  getPopupPostMessageOrigin,
  getSessionCookieOptions,
  parseGoogleSession,
  parseOAuthState,
  serializeGoogleSession,
} from "@/lib/googleAuth";

export const dynamic = "force-dynamic";

const AUTH_MESSAGE_SOURCE = "triptag-google-auth";

function buildPopupHtml(success: boolean, message: string | null, targetOrigin: string) {
  const payload = JSON.stringify({
    source: AUTH_MESSAGE_SOURCE,
    success,
    error: success ? undefined : message ?? "Google sign-in failed.",
  });

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${success ? "Drive connected" : "Sign-in failed"}</title>
  </head>
  <body style="font-family: sans-serif; background: #111827; color: #f9fafb; display: grid; place-items: center; min-height: 100vh; margin: 0;">
    <div style="text-align: center; max-width: 24rem; padding: 1.5rem; line-height: 1.5;">
      <h1 style="margin: 0 0 0.75rem; font-size: 1.1rem;">${success ? "Google Drive connected" : "Unable to connect Google Drive"}</h1>
      <p style="margin: 0; opacity: 0.85;">${message ?? (success ? "You can close this window." : "Please close this window and try again.")}</p>
    </div>
    <script>
      (function () {
        const payload = ${payload};
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage(payload, ${JSON.stringify(targetOrigin)});
        }
        window.setTimeout(function () { window.close(); }, 120);
      })();
    </script>
  </body>
</html>`;
}

function buildErrorResponse(request: NextRequest, popup: boolean, message: string, status = 400) {
  if (popup) {
    return new NextResponse(buildPopupHtml(false, message, getPopupPostMessageOrigin(request)), {
      status,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }

  const redirectUrl = new URL(getAppBaseUrl(request));
  redirectUrl.searchParams.set("authError", message);
  return NextResponse.redirect(redirectUrl, { status: 302 });
}

function readPendingState(request: NextRequest): PendingGoogleOAuthState | null {
  return parseOAuthState(request.cookies.get(GOOGLE_AUTH_COOKIE)?.value);
}

function readExistingSession(request: NextRequest): StoredGoogleSession | null {
  return parseGoogleSession(request.cookies.get(GOOGLE_SESSION_COOKIE)?.value);
}

export async function GET(request: NextRequest) {
  const popup = readPendingState(request)?.popup ?? false;
  const error = request.nextUrl.searchParams.get("error");
  if (error) {
    return buildErrorResponse(request, popup, error);
  }

  const code = request.nextUrl.searchParams.get("code");
  const returnedState = request.nextUrl.searchParams.get("state");
  const pendingState = readPendingState(request);

  if (!code || !returnedState || !pendingState) {
    return buildErrorResponse(request, popup, "Missing or expired OAuth state.");
  }

  if (Date.now() - pendingState.createdAt > 10 * 60 * 1000) {
    return buildErrorResponse(request, pendingState.popup, "Google sign-in took too long. Please try again.");
  }

  if (pendingState.state !== returnedState) {
    return buildErrorResponse(request, pendingState.popup, "Google sign-in state did not match.");
  }

  try {
    const tokenSet = await exchangeGoogleAuthCode(request, code, pendingState.codeVerifier);
    const user = await fetchGoogleUser(tokenSet.accessToken);
    const existing = readExistingSession(request);
    const refreshToken = tokenSet.refreshToken ?? existing?.refreshToken;

    if (!refreshToken) {
      throw new Error("Google did not return a refresh token. Remove the app from your Google account permissions and try again.");
    }

    const now = Date.now();
    const session: StoredGoogleSession = {
      ...user,
      refreshToken,
      scope: tokenSet.scope,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    if (pendingState.popup) {
      const response = new NextResponse(
        buildPopupHtml(true, "You can close this window.", getPopupPostMessageOrigin(request)),
        {
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "no-store",
          },
        }
      );
      response.cookies.set(GOOGLE_SESSION_COOKIE, serializeGoogleSession(session), getSessionCookieOptions());
      response.cookies.set(GOOGLE_AUTH_COOKIE, "", getExpiredCookieOptions());
      return response;
    }

    const redirectUrl = new URL(getAppBaseUrl(request));
    redirectUrl.searchParams.set("auth", "connected");
    const response = NextResponse.redirect(redirectUrl, { status: 302 });
    response.cookies.set(GOOGLE_SESSION_COOKIE, serializeGoogleSession(session), getSessionCookieOptions());
    response.cookies.set(GOOGLE_AUTH_COOKIE, "", getExpiredCookieOptions());
    return response;
  } catch (caughtError) {
    const message = caughtError instanceof Error ? caughtError.message : "Google sign-in failed.";
    const response = buildErrorResponse(request, pendingState.popup, message, 500);
    response.cookies.set(GOOGLE_AUTH_COOKIE, "", getExpiredCookieOptions());
    return response;
  }
}
