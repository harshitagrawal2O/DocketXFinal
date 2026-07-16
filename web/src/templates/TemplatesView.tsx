import { useState } from "react";
import { TemplateGallery } from "./TemplateGallery";
import { TemplateDetail } from "./TemplateDetail";
import { GeneratePanel } from "./GeneratePanel";
import { UploadTemplate } from "./UploadTemplate";
import { IntakeChat } from "@/intake/IntakeChat";

type View =
  | { mode: "gallery" }
  | { mode: "detail"; templateId: string }
  | { mode: "new" }
  | { mode: "generate"; templateId: string }
  | { mode: "upload" }
  | { mode: "viki" };

interface Props {
  /** Open a (freshly-generated or existing) document in the workspace. */
  onOpenDocument: (id: string) => void;
}

export function TemplatesView({ onOpenDocument }: Props) {
  const [view, setView] = useState<View>({ mode: "gallery" });
  const [reloadKey, setReloadKey] = useState(0);

  function backToGallery() {
    setView({ mode: "gallery" });
  }

  return (
    <div className="templates-scroll">
      {view.mode === "gallery" && (
        <TemplateGallery
          reloadKey={reloadKey}
          onOpenTemplate={(id) => setView({ mode: "detail", templateId: id })}
          onCreate={() => setView({ mode: "new" })}
          onUpload={() => setView({ mode: "upload" })}
          onDraftWithViki={() => setView({ mode: "viki" })}
        />
      )}

      {view.mode === "viki" && (
        <IntakeChat onBack={backToGallery} onOpenDocument={onOpenDocument} />
      )}

      {(view.mode === "detail" || view.mode === "new") && (
        <TemplateDetail
          templateId={view.mode === "detail" ? view.templateId : undefined}
          onBack={backToGallery}
          onUse={(id) => setView({ mode: "generate", templateId: id })}
          onSaved={() => {
            setReloadKey((k) => k + 1);
            backToGallery();
          }}
          onDeleted={() => {
            setReloadKey((k) => k + 1);
            backToGallery();
          }}
          onCloned={(tpl) => {
            // Open the freshly-cloned owned copy in edit mode.
            setReloadKey((k) => k + 1);
            setView({ mode: "detail", templateId: tpl.id });
          }}
        />
      )}

      {view.mode === "generate" && (
        <GeneratePanel
          templateId={view.templateId}
          onBack={backToGallery}
          onOpenDocument={onOpenDocument}
        />
      )}

      {view.mode === "upload" && (
        <UploadTemplate
          onBack={backToGallery}
          onCreated={(tpl) => {
            // Refresh the gallery next time it mounts, and open the template
            // Viki just produced in the detail view for review/editing.
            setReloadKey((k) => k + 1);
            setView({ mode: "detail", templateId: tpl.id });
          }}
        />
      )}
    </div>
  );
}
