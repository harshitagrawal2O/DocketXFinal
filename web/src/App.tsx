import { useState } from "react";
import { useSession } from "@/session/SessionContext";
import { AuthScreen } from "@/session/AuthScreen";
import { Sidebar } from "@/documents/Sidebar";
import { DocumentWorkspace } from "@/documents/DocumentWorkspace";

export function App() {
  const { user, loading, error } = useSession();
  const [selectedId, setSelectedId] = useState<string | null>(null);

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
      <Sidebar selectedId={selectedId} onSelect={setSelectedId} />
      <div className="app-main">
        {selectedId ? (
          <DocumentWorkspace key={selectedId} documentId={selectedId} user={user} />
        ) : (
          <div className="empty-state app-empty">
            <p className="empty-title">Select a document</p>
            <p className="muted">
              Choose a document from the sidebar, or create a new one to start drafting with
              Viki.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
