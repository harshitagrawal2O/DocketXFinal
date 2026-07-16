import { useEffect, useState } from "react";
import type { Role, SessionUser } from "@docket/shared";
import { docsApi } from "@/lib/api";
import { useDocConnection } from "@/lib/yjs";
import { EditorProvider } from "@/editor/EditorContext";
import { StagingProvider } from "@/staging/StagingContext";
import { CommentsProvider } from "@/editor/CommentsContext";
import { AgentProvider } from "@/agent/AgentContext";
import { Editor } from "@/editor/Editor";
import { CommentThreads } from "@/editor/CommentThreads";
import { ActivityFeed } from "@/staging/ActivityFeed";
import { AgentPanel } from "@/agent/AgentPanel";
import { VersionsPanel } from "@/versions/VersionsPanel";
import { AuditPanel } from "@/audit/AuditPanel";

type Tab = "activity" | "agent" | "comments" | "versions" | "audit";

const TABS: { id: Tab; label: string }[] = [
  { id: "agent", label: "Viki" },
  { id: "activity", label: "Feed" },
  { id: "comments", label: "Comments" },
  { id: "versions", label: "Versions" },
  { id: "audit", label: "Audit" },
];

interface DocMeta {
  title: string;
  role: Role;
  members: { userId: string; name: string; role: Role }[];
  /** Non-null for template-generated docs still awaiting client-side seeding. */
  initialHtml: string | null;
}

export function DocumentWorkspace({
  documentId,
  user,
}: {
  documentId: string;
  user: SessionUser;
}) {
  const [meta, setMeta] = useState<DocMeta | null>(null);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("agent");
  const [railOpen, setRailOpen] = useState(false); // mobile bottom-sheet

  useEffect(() => {
    let alive = true;
    setMeta(null);
    setMetaError(null);
    docsApi
      .get(documentId)
      .then((d) => {
        if (alive)
          setMeta({
            title: d.summary.title,
            role: d.summary.myRole,
            members: d.members,
            initialHtml: d.initialHtml,
          });
      })
      .catch(() => alive && setMetaError("Could not load this document."));
    return () => {
      alive = false;
    };
  }, [documentId]);

  const conn = useDocConnection(documentId, user);

  if (metaError) {
    return <div className="workspace-message error-line">{metaError}</div>;
  }
  if (!meta || !conn) {
    return <div className="workspace-message intent-line">Opening the document…</div>;
  }

  const { ydoc, provider } = conn;
  const role = meta.role;

  return (
    <EditorProvider>
      <StagingProvider ydoc={ydoc} documentId={documentId}>
        <CommentsProvider ydoc={ydoc} user={user}>
          <AgentProvider documentId={documentId}>
            <div className="workspace">
              <header className="workspace-head">
                <div className="workspace-title">
                  <h2>{meta.title}</h2>
                  <span className="role-pill">{role}</span>
                </div>
                <div className="workspace-presence">
                  {meta.members.slice(0, 5).map((m) => (
                    <span key={m.userId} className="avatar sm" title={`${m.name} · ${m.role}`}>
                      {m.name[0]?.toUpperCase() ?? "?"}
                    </span>
                  ))}
                </div>
              </header>

              <div className="workspace-body">
                <main className="editor-col">
                  <Editor
                    ydoc={ydoc}
                    provider={provider}
                    user={user}
                    documentId={documentId}
                    role={role}
                    title={meta.title}
                    initialHtml={meta.initialHtml}
                  />
                </main>

                <section className={`rail${railOpen ? " open" : ""}`}>
                  <nav className="rail-tabs">
                    {TABS.map((t) => (
                      <button
                        key={t.id}
                        className={tab === t.id ? "active" : ""}
                        onClick={() => {
                          setTab(t.id);
                          setRailOpen(true);
                        }}
                      >
                        {t.label}
                      </button>
                    ))}
                  </nav>
                  <div className="rail-content">
                    {tab === "agent" && <AgentPanel role={role} />}
                    {tab === "activity" && <ActivityFeed role={role} />}
                    {tab === "comments" && <CommentThreads />}
                    {tab === "versions" && <VersionsPanel documentId={documentId} role={role} />}
                    {tab === "audit" && <AuditPanel documentId={documentId} />}
                  </div>
                </section>
              </div>

              {/* Mobile-only handle to toggle the rail as a bottom sheet. */}
              <button
                className="rail-toggle"
                onClick={() => setRailOpen((v) => !v)}
                aria-label="Toggle review panel"
              >
                {railOpen ? "Close panel ▾" : "Review & Viki ▴"}
              </button>
            </div>
          </AgentProvider>
        </CommentsProvider>
      </StagingProvider>
    </EditorProvider>
  );
}
