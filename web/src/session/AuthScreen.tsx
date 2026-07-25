import { useMemo, useState, type FormEvent } from "react";
import { ApiError } from "@/lib/api";
import { useSession } from "./SessionContext";

type Mode = "login" | "register";

/** An admin-issued invite link looks like /?invite=<token>&email=<email>. */
function parseInviteFromUrl(): { token: string; email: string } | null {
  const params = new URLSearchParams(window.location.search);
  const token = params.get("invite");
  if (!token) return null;
  return { token, email: params.get("email") ?? "" };
}

export function AuthScreen() {
  const { login, register } = useSession();
  const invite = useMemo(parseInviteFromUrl, []);
  const [mode, setMode] = useState<Mode>(invite ? "register" : "login");
  const [email, setEmail] = useState(invite?.email ?? "");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "login") await login(email, password);
      else await register(email, name, password, invite?.token);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 py-10 paper-texture">
      <form
        className="w-full max-w-md rounded-xl border border-outline-variant bg-surface-container-lowest p-8 shadow-[0_20px_40px_-10px_rgba(28,37,48,0.06)]"
        onSubmit={onSubmit}
      >
        <div className="mb-8 flex items-center gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary font-headline-md text-headline-md text-on-primary">
            D
          </span>
          <div>
            <h1 className="font-headline-lg text-headline-lg text-primary">Docket</h1>
            <p className="mt-1 font-body-md text-body-md text-on-surface-variant">
              Agentic legal drafting, reviewed by humans.
            </p>
          </div>
        </div>

        {invite && (
          <div className="mb-5 rounded-lg border border-success bg-success-container px-4 py-3 font-body-md text-body-md text-success">
            You've been invited to join a firm on Docket. Create your account below to accept.
          </div>
        )}

        <div className="mb-6 grid grid-cols-2 rounded-lg bg-surface-container p-1">
          <button
            type="button"
            className={`rounded-md px-4 py-2 font-label-md text-label-md transition-colors ${
              mode === "login"
                ? "bg-surface-container-lowest text-primary shadow-sm"
                : "text-on-surface-variant hover:text-primary"
            }`}
            onClick={() => setMode("login")}
          >
            Sign in
          </button>
          <button
            type="button"
            className={`rounded-md px-4 py-2 font-label-md text-label-md transition-colors ${
              mode === "register"
                ? "bg-surface-container-lowest text-primary shadow-sm"
                : "text-on-surface-variant hover:text-primary"
            }`}
            onClick={() => setMode("register")}
          >
            Create account
          </button>
        </div>

        {mode === "register" && (
          <label className="mb-4 block">
            <span className="mb-2 block font-label-md text-label-md text-on-surface-variant">Name</span>
            <input
              className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-4 py-3 font-body-md text-body-md text-on-surface outline-none transition-colors placeholder:text-outline focus:border-primary"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete="name"
              placeholder="Priya Sharma"
            />
          </label>
        )}

        <label className="mb-4 block">
          <span className="mb-2 block font-label-md text-label-md text-on-surface-variant">Email</span>
          <input
            className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-4 py-3 font-body-md text-body-md text-on-surface outline-none transition-colors placeholder:text-outline focus:border-primary"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            placeholder="you@firm.in"
          />
        </label>

        <label className="mb-5 block">
          <span className="mb-2 block font-label-md text-label-md text-on-surface-variant">Password</span>
          <input
            className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-4 py-3 font-body-md text-body-md text-on-surface outline-none transition-colors placeholder:text-outline focus:border-primary"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            placeholder="••••••••"
          />
        </label>

        {error && (
          <div className="mb-5 rounded-lg border border-error/30 bg-error-container px-4 py-3 font-body-md text-body-md text-on-error-container">
            {error}
          </div>
        )}

        <button
          className="flex w-full items-center justify-center rounded-lg bg-primary px-4 py-3 font-label-md text-label-md text-on-primary transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          type="submit"
          disabled={busy}
        >
          {busy ? "Working..." : mode === "login" ? "Sign in" : "Create account"}
        </button>

        <p className="mt-5 font-body-md text-body-md text-on-surface-variant">
          Dev shortcut: set <code>localStorage.docket_dev_user_id</code> to impersonate a
          seeded user, then reload.
        </p>
      </form>
    </div>
  );
}
