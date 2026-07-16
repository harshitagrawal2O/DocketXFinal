import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { Editor } from "@tiptap/react";

interface EditorCtx {
  editor: Editor | null;
  setEditor: (e: Editor | null) => void;
}

const Ctx = createContext<EditorCtx | null>(null);

export function EditorProvider({ children }: { children: ReactNode }) {
  const [editor, setEditor] = useState<Editor | null>(null);
  const value = useMemo(() => ({ editor, setEditor }), [editor]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useEditorInstance(): EditorCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useEditorInstance must be used within EditorProvider");
  return ctx;
}
