import { useEffect, useState } from "react";
import type { DocumentSummary } from "@docket/shared";
import { docsApi } from "@/lib/api";
import { useSession } from "@/session/SessionContext";

const KIND_LABEL: Record<DocumentSummary["kind"], string> = {
  contract: "Contract",
  opinion: "Legal opinion",
  filing: "Filing",
  memo: "Compliance memo",
};

const KINDS = Object.keys(KIND_LABEL) as DocumentSummary["kind"][];

interface Props {
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function Sidebar({ selectedId, onSelect }: Props) {
  const { user, logout } = useSession();
  const [docs, setDocs] = useState<DocumentSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newKind, setNewKind] = useState<DocumentSummary["kind"]>("contract");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    docsApi
      .list()
      .then((d) => alive && setDocs(d))
      .catch(() => alive && setError("Could not load documents."));
    return () => {
      alive = false;
    };
  }, []);

  async function create() {
    if (!newTitle.trim()) return;
    setBusy(true);
    try {
      const doc = await docsApi.create(newTitle.trim(), newKind);
      setDocs((prev) => [doc, ...(prev ?? [])]);
      setNewTitle("");
      setCreating(false);
      onSelect(doc.id);
    } catch {
      setError("Could not create the document.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-head">
        <div className="sidebar-brand">
          <span className="auth-logo sm">D</span>
          <strong>Docket</strong>
        </div>
        <button
          className="btn btn-primary btn-sm"
          onClick={() => setCreating((v) => !v)}
          title="New document"
        >
          + New
        </button>
      </div>

      {creating && (
        <div className="doc-create">
          <input
            autoFocus
            placeholder="Document title"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && create()}
          />
          <select
            value={newKind}
            onChange={(e) => setNewKind(e.target.value as DocumentSummary["kind"])}
          >
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {KIND_LABEL[k]}
              </option>
            ))}
          </select>
          <div className="doc-create-actions">
            <button className="btn btn-sm" onClick={() => setCreating(false)}>
              Cancel
            </button>
            <button className="btn btn-primary btn-sm" onClick={create} disabled={busy}>
              {busy ? "Creating…" : "Create"}
            </button>
          </div>
        </div>
      )}

      <nav className="doc-list">
        {docs === null && !error && <div className="intent-line">Loading documents…</div>}
        {error && <div className="error-line">{error}</div>}
        {docs && docs.length === 0 && (
          <div className="empty-state sm">
            <p>No documents yet.</p>
            <p className="muted">Create your first draft to get started.</p>
          </div>
        )}
        {docs?.map((d) => (
          <button
            key={d.id}
            className={`doc-item${selectedId === d.id ? " active" : ""}`}
            onClick={() => onSelect(d.id)}
          >
            <span className="doc-item-title">{d.title}</span>
            <span className="doc-item-meta">
              {KIND_LABEL[d.kind]} · {d.myRole}
            </span>
          </button>
        ))}
      </nav>

      <div className="sidebar-foot">
        <div className="sidebar-user">
          <span className="avatar" style={{ background: user?.color ?? "#888" }}>
            {user?.name?.[0]?.toUpperCase() ?? "?"}
          </span>
          <div className="sidebar-user-info">
            <span className="sidebar-user-name">{user?.name}</span>
            <span className="muted sidebar-user-email">{user?.email}</span>
          </div>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => void logout()}>
          Sign out
        </button>
      </div>
    </aside>
  );
}
