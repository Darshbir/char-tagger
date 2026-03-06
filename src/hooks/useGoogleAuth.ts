"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { AuthMeResponse, GoogleUser } from "@/lib/authTypes";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

const AUTH_MESSAGE_SOURCE = "triptag-google-auth";

async function fetchSession(): Promise<AuthMeResponse> {
  const response = await fetch("/api/auth/me", {
    method: "GET",
    cache: "no-store",
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Failed to load Google Drive session.");
  }

  return (await response.json()) as AuthMeResponse;
}

export function useGoogleAuth() {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<GoogleUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const data = await fetchSession();
      setUser(data.authenticated ? data.user ?? null : null);
      setStatus(data.authenticated ? "authenticated" : "unauthenticated");
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load Google Drive session.";
      setStatus("unauthenticated");
      setUser(null);
      setError(message);
      return { authenticated: false, error: message } satisfies AuthMeResponse;
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const signIn = useCallback(async () => {
    setError(null);
    setIsBusy(true);

    const width = 540;
    const height = 720;
    const left = window.screenX + Math.max(0, (window.outerWidth - width) / 2);
    const top = window.screenY + Math.max(0, (window.outerHeight - height) / 2);
    const features = [
      `width=${width}`,
      `height=${height}`,
      `left=${Math.round(left)}`,
      `top=${Math.round(top)}`,
      "resizable=yes",
      "scrollbars=yes",
    ].join(",");

    const popup = window.open("/api/auth/google?popup=1", "triptag-google-auth", features);
    if (!popup) {
      setIsBusy(false);
      setError("Google sign-in popup was blocked. Allow popups for this site to connect Drive without losing your current scan.");
      return false;
    }

    popup.focus();

    const result = await new Promise<boolean>((resolve) => {
      let settled = false;

      const cleanup = () => {
        window.removeEventListener("message", onMessage);
        window.clearInterval(timerId);
      };

      const finish = (value: boolean, nextError?: string) => {
        if (settled) return;
        settled = true;
        cleanup();
        if (nextError) setError(nextError);
        resolve(value);
      };

      const onMessage = (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;
        const data = event.data as { source?: string; success?: boolean; error?: string } | null;
        if (!data || data.source !== AUTH_MESSAGE_SOURCE) return;
        finish(Boolean(data.success), data.success ? undefined : data.error || "Google sign-in failed.");
      };

      const timerId = window.setInterval(() => {
        if (!popup || popup.closed) {
          finish(false, "Google sign-in was cancelled before completion.");
        }
      }, 400);

      window.addEventListener("message", onMessage);
    });

    await refresh();
    setIsBusy(false);
    return result;
  }, [refresh]);

  const signOut = useCallback(async () => {
    setError(null);
    setIsBusy(true);
    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to disconnect Google Drive.");
      }
      setUser(null);
      setStatus("unauthenticated");
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to disconnect Google Drive.";
      setError(message);
      return false;
    } finally {
      setIsBusy(false);
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return useMemo(
    () => ({
      status,
      user,
      error,
      isBusy,
      signIn,
      signOut,
      refresh,
      clearError,
    }),
    [status, user, error, isBusy, signIn, signOut, refresh, clearError]
  );
}
