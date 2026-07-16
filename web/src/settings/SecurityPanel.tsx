/**
 * Security — a minimal, honest session panel. There is no backend concept
 * of "active sessions" yet, so this shows only the current session user
 * (real data from SessionContext) and a real sign-out action, with a plain
 * note that richer controls are coming later.
 */
import { useState } from "react";
import { useAuthedUser, useSession } from "@/session/SessionContext";

export function SecurityPanel() {
  const user = useAuthedUser();
  const { logout } = useSession();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await logout();
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto py-stack-lg px-margin-page">
      <div className="mb-stack-lg">
        <h1 className="font-headline-lg text-headline-lg text-primary mb-unit">Security</h1>
        <p className="font-body-md text-on-surface-variant">
          Manage your session and sign-in for this account.
        </p>
      </div>

      <div className="bg-surface p-stack-lg rounded border border-outline-variant/50 space-y-stack-lg max-w-xl">
        <div className="flex items-center gap-stack-md">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center text-on-primary font-label-md text-label-md flex-shrink-0"
            style={{ backgroundColor: user.color }}
            aria-hidden="true"
          >
            {initials(user.name)}
          </div>
          <div className="min-w-0">
            <p className="font-body-md text-body-md text-primary font-medium truncate">
              {user.name}
            </p>
            <p className="font-label-sm text-label-sm text-on-surface-variant truncate">
              {user.email}
            </p>
          </div>
        </div>

        <div className="pt-stack-md border-t border-outline-variant/50">
          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            className="inline-flex items-center gap-2 px-stack-lg py-stack-sm font-label-md text-label-md border border-outline-variant text-on-surface-variant hover:bg-surface-container-high transition-colors rounded disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="material-symbols-outlined text-sm" aria-hidden="true">
              logout
            </span>
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>

        <p className="text-label-sm text-on-surface-variant italic border-t border-outline-variant/30 pt-stack-md">
          Session-level security controls (sign out everywhere, active sessions) are coming soon.
        </p>
      </div>
    </div>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1] ?? "" : "";
  const combined = last ? first.charAt(0) + last.charAt(0) : first.slice(0, 2);
  return combined.toUpperCase() || "?";
}
