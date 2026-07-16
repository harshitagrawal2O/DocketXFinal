import { useState } from "react";
import { TemplateGallery } from "./TemplateGallery";
import { GeneratePanel } from "./GeneratePanel";
import { UploadTemplate } from "./UploadTemplate";

type View = { mode: "gallery" } | { mode: "generate"; templateId: string } | { mode: "upload" };

interface Props {
  /** Open a (freshly-generated or existing) document in the workspace. */
  onOpenDocument: (id: string) => void;
}

export function TemplatesView({ onOpenDocument }: Props) {
  const [view, setView] = useState<View>({ mode: "gallery" });
  const [reloadKey, setReloadKey] = useState(0);

  return (
    <div className="templates-scroll">
      {view.mode === "gallery" && (
        <TemplateGallery
          reloadKey={reloadKey}
          onOpenTemplate={(id) => setView({ mode: "generate", templateId: id })}
          onNewFromUpload={() => setView({ mode: "upload" })}
        />
      )}

      {view.mode === "generate" && (
        <GeneratePanel
          templateId={view.templateId}
          onBack={() => setView({ mode: "gallery" })}
          onOpenDocument={onOpenDocument}
        />
      )}

      {view.mode === "upload" && (
        <UploadTemplate
          onBack={() => setView({ mode: "gallery" })}
          onCreated={(tpl) => {
            // Refresh the gallery next time it mounts, and jump straight into
            // generating from the template Viki just produced.
            setReloadKey((k) => k + 1);
            setView({ mode: "generate", templateId: tpl.id });
          }}
        />
      )}
    </div>
  );
}
