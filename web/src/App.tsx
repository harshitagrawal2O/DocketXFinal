import { useState } from "react";
import { useSession } from "@/session/SessionContext";
import { AuthScreen } from "@/session/AuthScreen";
import { Sidebar } from "@/documents/Sidebar";
import { DocumentWorkspace } from "@/documents/DocumentWorkspace";
import { TemplatesView } from "@/templates/TemplatesView";

export function App() {
  const { user, loading, error } = useSession();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [docsReloadKey, setDocsReloadKey] = useState(0);

  if (loading) {
    return (
      <div className="boot-screen">
        <div className="intent-line">Checking your session…</div>
      </div>
    );
  }

  if (error && !user) {
    return (
      <div className="boot-screen">
        <div className="error-line">{error}</div>
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  return (
    <div className="app-shell">
      <Sidebar
        selectedId={showTemplates ? null : selectedId}
        onSelect={(id) => {
          setShowTemplates(false);
          setSelectedId(id);
        }}
        templatesActive={showTemplates}
        onOpenTemplates={() => setShowTemplates(true)}
        reloadKey={docsReloadKey}
      />
      <div className="app-main">
        {showTemplates ? (
          <TemplatesView
            onOpenDocument={(id) => {
              setShowTemplates(false);
              setSelectedId(id);
              // The generated doc isn't in the sidebar list yet — refresh it.
              setDocsReloadKey((k) => k + 1);
            }}
          />
        ) : selectedId ? (
          <DocumentWorkspace key={selectedId} documentId={selectedId} user={user} />
        ) : (
          <div className="empty-state app-empty">
            <p className="empty-title">Select a document</p>
            <p className="muted">
              Choose a document from the sidebar, start a new one, or generate one from a
              template.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
