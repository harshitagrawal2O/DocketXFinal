import { useEffect, useState } from "react";
import type { Role, SessionUser } from "@docket/shared";
import { can } from "@docket/shared";
import { docsApi } from "@/lib/api";
import { SharingModal } from "@/documents/SharingModal";
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
import { WorkspaceOutlineRail } from "@/documents/WorkspaceOutlineRail";

type Tab = "activity" | "agent" | "comments" | "versions" | "audit";
/** Which mobile bottom-sheet drawer is open, if any. */
type MobilePanel = "outline" | Tab | null;

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "agent", label: "Viki AI", icon: "auto_awesome" },
  { id: "activity", label: "Activity", icon: "timeline" },
  { id: "comments", label: "Comments", icon: "chat_bubble" },
  { id: "versions", label: "Versions", icon: "history" },
  { id: "audit", label: "Audit", icon: "history_edu" },
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
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>(null);
  const [sharingOpen, setSharingOpen] = useState(false);

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
    return (
      <div className="flex h-full items-center justify-center p-8">
        <p className="text-body-lg text-error">{metaError}</p>
      </div>
    );
  }
  if (!meta || !conn) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <p className="italic text-on-surface-variant">Opening the document…</p>
      </div>
    );
  }

  const { ydoc, provider } = conn;
  const role = meta.role;

  /** Switch the active right-rail tab (used by the tab bar itself — shared
   * between the desktop pane and the mobile drawer, so it never touches the
   * drawer's open/closed state). */
  function selectTab(id: Tab) {
    setTab(id);
  }

  /** Bottom-nav-only: select a tab AND open its drawer, toggling closed if
   * that tab's drawer is already open (mirrors the mockup's togglePanel()). */
  function selectMobileTab(id: Tab) {
    setTab(id);
    setMobilePanel((prev) => (prev === id ? null : id));
  }

  function toggleOutline() {
    setMobilePanel((prev) => (prev === "outline" ? null : "outline"));
  }

  return (
    <EditorProvider>
      <StagingProvider ydoc={ydoc} documentId={documentId}>
        <CommentsProvider ydoc={ydoc} user={user}>
          <AgentProvider documentId={documentId}>
            {/* Assumes a 64px (h-16) persistent TopNav renders above this
                component, matching every Stitch mockup's shared header. */}
            <div className="flex h-[calc(100vh-4rem)] flex-col overflow-hidden bg-background">
              <header className="flex flex-shrink-0 items-center justify-between gap-4 border-b border-outline-variant bg-surface px-6 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <h1 className="truncate font-headline-md text-headline-md text-primary">
                    {meta.title}
                  </h1>
                  <span className="shrink-0 rounded bg-surface-container-highest px-2 py-0.5 text-label-sm font-label-md uppercase tracking-tight text-on-surface-variant">
                    {role}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <div className="flex items-center -space-x-2">
                    {meta.members.slice(0, 5).map((m) => (
                      <span
                        key={m.userId}
                        title={`${m.name} · ${m.role}`}
                        className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-surface bg-secondary-fixed text-label-sm font-label-md text-secondary"
                      >
                        {m.name[0]?.toUpperCase() ?? "?"}
                      </span>
                    ))}
                  </div>
                  {can(role, "manage_sharing") && (
                    <button
                      type="button"
                      onClick={() => setSharingOpen(true)}
                      className="rounded bg-primary px-4 py-2 font-label-md text-label-md text-on-primary transition-colors hover:opacity-90"
                    >
                      Share
                    </button>
                  )}
                </div>
              </header>

              <div className="flex flex-1 overflow-hidden">
                <WorkspaceOutlineRail
                  mobileOpen={mobilePanel === "outline"}
                  onNavigate={() => setMobilePanel(null)}
                />

                <main className="flex flex-1 justify-center overflow-y-auto bg-surface-container paper-texture py-8">
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

                {/* Right rail: same tab bar + tab content in both the
                    desktop pane and the mobile bottom-sheet drawer — only
                    the wrapper's position/size changes at the md: breakpoint,
                    so nothing here is ever mounted twice. */}
                <aside
                  className={[
                    "flex flex-col overflow-hidden border-outline-variant bg-surface-container-low",
                    "fixed inset-x-0 bottom-0 z-[70] max-h-[75vh] rounded-t-3xl border-t transition-transform duration-300 ease-in-out",
                    mobilePanel && mobilePanel !== "outline" ? "translate-y-0" : "translate-y-full",
                    "md:static md:z-auto md:h-full md:max-h-none md:w-80 md:flex-shrink-0 md:translate-y-0 md:rounded-none md:border-t-0 md:border-l",
                  ].join(" ")}
                >
                  <div className="mx-auto mt-3 h-1 w-12 flex-shrink-0 rounded-full bg-outline-variant md:hidden" />
                  <nav className="no-scrollbar flex flex-shrink-0 overflow-x-auto border-b border-outline-variant">
                    {TABS.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => selectTab(t.id)}
                        className={`flex flex-1 items-center justify-center gap-1 whitespace-nowrap px-3 py-3 text-label-sm font-label-sm uppercase tracking-tight transition-colors ${
                          tab === t.id
                            ? "border-b-2 border-primary text-primary"
                            : "text-on-surface-variant hover:text-primary"
                        }`}
                      >
                        <span
                          className="material-symbols-outlined text-[14px]"
                          style={t.id === "agent" ? { fontVariationSettings: "'FILL' 1" } : undefined}
                        >
                          {t.icon}
                        </span>
                        {t.label}
                      </button>
                    ))}
                  </nav>
                  <div className="flex-1 overflow-y-auto p-4">
                    {tab === "agent" && <AgentPanel role={role} />}
                    {tab === "activity" && <ActivityFeed role={role} />}
                    {tab === "comments" && <CommentThreads />}
                    {tab === "versions" && <VersionsPanel documentId={documentId} role={role} />}
                    {tab === "audit" && <AuditPanel documentId={documentId} />}
                  </div>
                </aside>
              </div>

              {/* Mobile-only drawer scrim */}
              <div
                className={`fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm transition-opacity md:hidden ${
                  mobilePanel ? "opacity-100" : "pointer-events-none opacity-0"
                }`}
                onClick={() => setMobilePanel(null)}
              />

              {/* Mobile-only bottom nav with a raised Viki AI FAB */}
              <nav className="fixed inset-x-0 bottom-0 z-50 flex items-center justify-between gap-1 rounded-t-xl bg-primary-container px-2 py-2 text-on-primary-container ink-shadow sm:px-8 md:hidden">
                <button
                  type="button"
                  onClick={toggleOutline}
                  className="flex flex-col items-center gap-1 px-1"
                >
                  <span className="material-symbols-outlined">format_list_bulleted</span>
                  <span className="whitespace-nowrap text-label-sm font-label-sm uppercase tracking-tighter opacity-80">
                    Outline
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => selectMobileTab("activity")}
                  className="flex flex-col items-center gap-1 px-1"
                >
                  <span className="material-symbols-outlined">timeline</span>
                  <span className="whitespace-nowrap text-label-sm font-label-sm uppercase tracking-tighter opacity-80">
                    Activity
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => selectMobileTab("comments")}
                  className="flex flex-col items-center gap-1 px-1"
                >
                  <span className="material-symbols-outlined">chat_bubble</span>
                  <span className="whitespace-nowrap text-label-sm font-label-sm uppercase tracking-tighter opacity-80">
                    Comments
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => selectMobileTab("agent")}
                  className="relative -top-6 rounded-full bg-secondary p-4 text-on-secondary-fixed shadow-2xl ring-4 ring-background transition-transform active:scale-95"
                >
                  <span
                    className="material-symbols-outlined text-3xl"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    auto_awesome
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => selectMobileTab("versions")}
                  className="flex flex-col items-center gap-1 px-1"
                >
                  <span className="material-symbols-outlined">history</span>
                  <span className="whitespace-nowrap text-label-sm font-label-sm uppercase tracking-tighter opacity-80">
                    Versions
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => selectMobileTab("audit")}
                  className="flex flex-col items-center gap-1 px-1"
                >
                  <span className="material-symbols-outlined">history_edu</span>
                  <span className="whitespace-nowrap text-label-sm font-label-sm uppercase tracking-tighter opacity-80">
                    Audit
                  </span>
                </button>
              </nav>
            </div>

            {sharingOpen && (
              <SharingModal
                documentId={documentId}
                documentTitle={meta.title}
                myRole={role}
                onClose={() => setSharingOpen(false)}
              />
            )}
          </AgentProvider>
        </CommentsProvider>
      </StagingProvider>
    </EditorProvider>
  );
}
