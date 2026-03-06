"use client";

import type { GoogleUser } from "@/lib/authTypes";

interface DriveConnectionCardProps {
  status: "loading" | "authenticated" | "unauthenticated";
  user: GoogleUser | null;
  error?: string | null;
  busy?: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  compact?: boolean;
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M21.805 10.023H12v3.955h5.608c-.242 1.273-.967 2.35-2.06 3.073v2.551h3.332c1.95-1.795 3.072-4.44 3.072-7.602 0-.676-.053-1.338-.147-1.977Z" fill="#4285F4" />
      <path d="M12 22c2.79 0 5.13-.925 6.84-2.51l-3.332-2.551c-.926.62-2.113.988-3.508.988-2.697 0-4.98-1.822-5.796-4.269H2.76v2.63A10.33 10.33 0 0 0 12 22Z" fill="#34A853" />
      <path d="M6.204 13.658A6.226 6.226 0 0 1 5.88 11.7c0-.68.117-1.34.324-1.958V7.11H2.76A10.317 10.317 0 0 0 1.68 11.7c0 1.655.397 3.22 1.08 4.59l3.444-2.632Z" fill="#FBBC04" />
      <path d="M12 5.474c1.517 0 2.88.522 3.952 1.548l2.965-2.965C17.125 2.393 14.786 1.4 12 1.4A10.33 10.33 0 0 0 2.76 7.11l3.444 2.632C7.02 7.295 9.303 5.474 12 5.474Z" fill="#EA4335" />
    </svg>
  );
}

function formatIdentity(user: GoogleUser | null): string {
  if (!user) return "Not connected";
  return user.name?.trim() || user.email;
}

export function DriveConnectionCard({
  status,
  user,
  error,
  busy = false,
  onConnect,
  onDisconnect,
  compact = false,
}: DriveConnectionCardProps) {
  const connected = status === "authenticated";
  const loading = status === "loading";

  return (
    <section className={`tt-drive-card${compact ? " tt-drive-card--compact" : ""}`}>
      <div className="tt-drive-card__header">
        <div className="tt-drive-card__copy">
          <div className="tt-drive-card__eyebrow">Google Drive session</div>
          <div className="tt-drive-card__title">{formatIdentity(connected ? user : null)}</div>
          <p className="tt-drive-card__desc">
            {connected
              ? "Your Drive refresh token is encrypted in an httpOnly session cookie. Photos still stay local until you export them."
              : "Optional for Drive export. Sign in now so later upload routes can request Drive access without ever seeing your photos."}
          </p>
        </div>
        <div className={`tt-drive-card__badge tt-drive-card__badge--${connected ? "connected" : loading ? "loading" : "idle"}`}>
          {loading ? "Checking…" : connected ? "Connected" : "Optional"}
        </div>
      </div>

      {error ? <div className="tt-drive-card__error">{error}</div> : null}

      <div className="tt-drive-card__actions">
        {connected ? (
          <>
            <button type="button" className="tt-drive-btn tt-drive-btn--secondary" onClick={onDisconnect} disabled={busy}>
              Disconnect
            </button>
            <div className="tt-drive-card__meta">Signed in as {user?.email}</div>
          </>
        ) : (
          <button type="button" className="tt-drive-btn" onClick={onConnect} disabled={busy || loading}>
            <GoogleIcon />
            {busy ? "Connecting…" : "Connect Google Drive"}
          </button>
        )}
      </div>
    </section>
  );
}
