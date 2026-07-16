import { useState } from "react";
import type { DocumentSummary } from "@docket/shared";
import { useSession } from "@/session/SessionContext";
import { AuthScreen } from "@/session/AuthScreen";
import { docsApi } from "@/lib/api";
import { TopNav, type NavView } from "@/shell/TopNav";
import { DocumentsDashboard } from "@/documents/DocumentsDashboard";
import { DocumentWorkspace } from "@/documents/DocumentWorkspace";
import { TemplatesView } from "@/templates/TemplatesView";
import { SettingsShell } from "@/settings/SettingsShell";

type Screen = "dashboard" | "templates" | "settings";

export function App() {
  const { user, loading, error } = useSession();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [screen, setScreen] = useState<Screen>("dashboard");
  const [docsReloadKey, setDocsReloadKey] = useState(0);
  const [createError, setCreateError] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="font-label-md text-label-md text-on-surface-variant">
          Checking your session…
        </div>
      </div>
    );
  }

  if (error && !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="rounded-lg bg-error-container px-4 py-3 font-body-md text-on-error-container">
          {error}
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  const activeNav: NavView = screen === "dashboard" && selectedId ? "dashboard" : screen;

  function goToDashboard() {
    setScreen("dashboard");
    setSelectedId(null);
  }

  function handleNavigate(view: NavView) {
    if (view === "dashboard") {
      goToDashboard();
    } else {
      setScreen(view);
      setSelectedId(null);
    }
  }

  async function handleCreateBlank() {
    setCreateError(null);
    const defaultKind: DocumentSummary["kind"] = "contract";
    try {
      const doc = await docsApi.create("Untitled document", defaultKind);
      setDocsReloadKey((k) => k + 1);
      setScreen("dashboard");
      setSelectedId(doc.id);
    } catch {
      setCreateError("Could not create the document. Please try again.");
    }
  }

  return (
    <div className="min-h-screen bg-background paper-texture">
      <TopNav active={activeNav} onNavigate={handleNavigate} />
      <div className="pt-16">
        {createError && (
          <div className="mx-auto max-w-container-max-width px-margin-page pt-6">
            <div className="rounded-lg bg-error-container px-4 py-3 font-body-md text-on-error-container">
              {createError}
            </div>
          </div>
        )}

        {screen === "settings" ? (
          <SettingsShell />
        ) : screen === "templates" ? (
          <TemplatesView
            onOpenDocument={(id) => {
              setScreen("dashboard");
              setSelectedId(id);
              // The generated doc isn't in the dashboard's list yet — refresh it.
              setDocsReloadKey((k) => k + 1);
            }}
          />
        ) : selectedId ? (
          <DocumentWorkspace key={selectedId} documentId={selectedId} user={user} />
        ) : (
          <DocumentsDashboard
            reloadKey={docsReloadKey}
            onOpenDocument={setSelectedId}
            onCreateBlank={() => void handleCreateBlank()}
            onOpenTemplates={() => setScreen("templates")}
          />
        )}
      </div>
    </div>
  );
}
