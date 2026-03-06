import "server-only";

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import type { GoogleUser, PendingGoogleOAuthState, StoredGoogleSession } from "@/lib/authTypes";

export const GOOGLE_AUTH_COOKIE = "tt-google-oauth";
export const GOOGLE_SESSION_COOKIE = "tt-google-session";

const GOOGLE_OAUTH_SCOPE = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/drive.file",
].join(" ");

const OAUTH_COOKIE_MAX_AGE_SECONDS = 60 * 10;
const SESSION_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function getEncryptionKey(): Buffer {
  return createHash("sha256").update(getRequiredEnv("AUTH_SECRET"), "utf8").digest();
}

function encodeBase64Url(value: Buffer): string {
  return value.toString("base64url");
}

function decodeBase64Url(value: string): Buffer {
  return Buffer.from(value, "base64url");
}

function sealJson(value: unknown): string {
  const key = getEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(value), "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return [iv, authTag, ciphertext].map(encodeBase64Url).join(".");
}

function unsealJson<T>(payload: string | undefined): T | null {
  if (!payload) return null;
  const [ivPart, authTagPart, cipherPart] = payload.split(".");
  if (!ivPart || !authTagPart || !cipherPart) return null;

  try {
    const key = getEncryptionKey();
    const decipher = createDecipheriv("aes-256-gcm", key, decodeBase64Url(ivPart));
    decipher.setAuthTag(decodeBase64Url(authTagPart));
    const plaintext = Buffer.concat([
      decipher.update(decodeBase64Url(cipherPart)),
      decipher.final(),
    ]).toString("utf8");
    return JSON.parse(plaintext) as T;
  } catch {
    return null;
  }
}

function base64UrlSha256(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("base64url");
}

function generateRandomToken(size = 32): string {
  return randomBytes(size).toString("base64url");
}

export function getAppBaseUrl(request?: Request): string {
  const configured = process.env.NEXTAUTH_URL?.trim();
  if (configured) {
    return configured.replace(/\/$/, "");
  }
  if (request) {
    return new URL(request.url).origin;
  }
  throw new Error("Unable to determine app base URL. Set NEXTAUTH_URL.");
}

export function getPopupPostMessageOrigin(request?: Request): string {
  return new URL(getAppBaseUrl(request)).origin;
}

export function createOAuthState(popup: boolean): PendingGoogleOAuthState {
  return {
    state: generateRandomToken(24),
    codeVerifier: generateRandomToken(48),
    popup,
    createdAt: Date.now(),
  };
}

export function serializeOAuthState(state: PendingGoogleOAuthState): string {
  return sealJson(state);
}

export function parseOAuthState(payload: string | undefined): PendingGoogleOAuthState | null {
  return unsealJson<PendingGoogleOAuthState>(payload);
}

export function serializeGoogleSession(session: StoredGoogleSession): string {
  return sealJson(session);
}

export function parseGoogleSession(payload: string | undefined): StoredGoogleSession | null {
  return unsealJson<StoredGoogleSession>(payload);
}

export function getOAuthCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: OAUTH_COOKIE_MAX_AGE_SECONDS,
  };
}

export function getExpiredCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 0,
  };
}

export function getSessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_COOKIE_MAX_AGE_SECONDS,
  };
}

export function buildGoogleAuthorizationUrl(request: Request, state: PendingGoogleOAuthState): string {
  const clientId = getRequiredEnv("GOOGLE_CLIENT_ID");
  const redirectUri = `${getAppBaseUrl(request)}/api/auth/callback`;
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GOOGLE_OAUTH_SCOPE);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("code_challenge", base64UrlSha256(state.codeVerifier));
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("state", state.state);
  return url.toString();
}

interface GoogleTokenResponse {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
}

export async function exchangeGoogleAuthCode(request: Request, code: string, codeVerifier: string) {
  const redirectUri = `${getAppBaseUrl(request)}/api/auth/callback`;
  const body = new URLSearchParams({
    client_id: getRequiredEnv("GOOGLE_CLIENT_ID"),
    client_secret: getRequiredEnv("GOOGLE_CLIENT_SECRET"),
    code,
    code_verifier: codeVerifier,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
  });

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
    cache: "no-store",
  });

  const json = (await response.json()) as GoogleTokenResponse;
  if (!response.ok || !json.access_token) {
    throw new Error(json.error_description || json.error || "Failed to exchange Google OAuth code.");
  }

  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresIn: json.expires_in,
    scope: json.scope,
  };
}

export async function fetchGoogleUser(accessToken: string): Promise<GoogleUser> {
  const response = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch Google account profile.");
  }

  const json = (await response.json()) as Partial<GoogleUser>;
  if (!json.sub || !json.email) {
    throw new Error("Google profile response was missing required fields.");
  }

  return {
    sub: json.sub,
    email: json.email,
    name: json.name,
    picture: json.picture,
  };
}

interface RefreshTokenResponse {
  access_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
}

export async function refreshGoogleAccessToken(refreshToken: string) {
  const body = new URLSearchParams({
    client_id: getRequiredEnv("GOOGLE_CLIENT_ID"),
    client_secret: getRequiredEnv("GOOGLE_CLIENT_SECRET"),
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
    cache: "no-store",
  });

  const json = (await response.json()) as RefreshTokenResponse;
  if (!response.ok || !json.access_token) {
    throw new Error(json.error_description || json.error || "Failed to refresh Google Drive access token.");
  }

  return {
    accessToken: json.access_token,
    expiresIn: json.expires_in,
    scope: json.scope,
  };
}
