import { useMemo, useState, type FormEvent } from "react";
import { ApiError } from "@/lib/api";
import { useSession } from "./SessionContext";

type Mode = "login" | "register";

/** An admin-issued invite link looks like /?invite=<token>&email=<email> — parsed once, not re-read on every render. */
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
    <div className="auth-screen">
      <form className="auth-card" onSubmit={onSubmit}>
        <div className="auth-brand">
          <span className="auth-logo">D</span>
          <div>
            <h1>Docket</h1>
            <p className="muted">Agentic legal drafting, reviewed by humans.</p>
          </div>
        </div>

        {invite && (
          <div className="auth-error" style={{ background: "#eef6ee", color: "#1c5e2a", borderColor: "#bfe3c4" }}>
            You've been invited to join a firm on Docket. Create your account below to accept.
          </div>
        )}

        <div className="auth-tabs">
          <button
            type="button"
            className={mode === "login" ? "active" : ""}
            onClick={() => setMode("login")}
          >
            Sign in
          </button>
          <button
            type="button"
            className={mode === "register" ? "active" : ""}
            onClick={() => setMode("register")}
          >
            Create account
          </button>
        </div>

        {mode === "register" && (
          <label className="field">
            <span>Name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete="name"
              placeholder="Priya Sharma"
            />
          </label>
        )}

        <label className="field">
          <span>Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            placeholder="you@firm.in"
          />
        </label>

        <label className="field">
          <span>Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            placeholder="••••••••"
          />
        </label>

        {error && <div className="auth-error">{error}</div>}

        <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
          {busy ? "Working…" : mode === "login" ? "Sign in" : "Create account"}
        </button>

        <p className="muted auth-hint">
          Dev shortcut: set <code>localStorage.docket_dev_user_id</code> to impersonate a
          seeded user, then reload.
        </p>
      </form>
    </div>
  );
}
