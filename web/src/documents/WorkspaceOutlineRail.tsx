import { useCallback, useEffect, useState } from "react";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { useEditorInstance } from "@/editor/EditorContext";

/**
 * The LEFT rail from the `document_workspace_3_pane` mockup ("Outline"
 * section only — see DocumentWorkspace.tsx for why "Matter Files" is
 * intentionally omitted: Docket has no per-document file-grouping concept,
 * so fabricating one here would misrepresent real data).
 *
 * Headings are derived live from the Tiptap/ProseMirror document (H1/H2
 * only, matching the mockup's outline depth) and re-computed whenever the
 * collaborative doc changes, so remote edits keep the outline in sync.
 */

interface HeadingItem {
  id: string;
  level: 1 | 2;
  text: string;
  pos: number;
}

function headingLevel(node: ProseMirrorNode): 1 | 2 | null {
  if (node.type.name !== "heading") return null;
  const level = (node.attrs as Record<string, unknown>).level;
  return level === 1 || level === 2 ? level : null;
}

function collectHeadings(doc: ProseMirrorNode): HeadingItem[] {
  const items: HeadingItem[] = [];
  doc.descendants((node, pos) => {
    const level = headingLevel(node);
    if (level) {
      const text = node.textContent.trim();
      items.push({ id: `h-${pos}`, level, text: text || "Untitled section", pos });
      return false;
    }
    return true;
  });
  return items;
}

interface Props {
  /** Whether the mobile bottom-sheet variant should be visible. Has no
   * visual effect at the md: breakpoint and up, where the rail is always
   * shown as a static pane. */
  mobileOpen?: boolean;
  /** Called after the user taps a heading (used to close the mobile drawer). */
  onNavigate?: () => void;
}

export function WorkspaceOutlineRail({ mobileOpen = false, onNavigate }: Props) {
  const { editor } = useEditorInstance();
  const [headings, setHeadings] = useState<HeadingItem[]>([]);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (!editor) {
      setHeadings([]);
      return;
    }
    const update = () => setHeadings(collectHeadings(editor.state.doc));
    update();
    editor.on("update", update);
    return () => {
      editor.off("update", update);
    };
  }, [editor]);

  const goTo = useCallback(
    (pos: number) => {
      if (!editor) return;
      const info = editor.view.domAtPos(pos);
      let node: Node | null = info.node;
      while (node && node.nodeType !== Node.ELEMENT_NODE) node = node.parentNode;
      (node as HTMLElement | null)?.scrollIntoView({ behavior: "smooth", block: "start" });
      onNavigate?.();
    },
    [editor, onNavigate],
  );

  return (
    <aside
      className={[
        "flex flex-col overflow-hidden border-outline-variant bg-surface-container-low",
        "fixed inset-x-0 bottom-0 z-[70] max-h-[75vh] rounded-t-3xl border-t transition-transform duration-300 ease-in-out",
        mobileOpen ? "translate-y-0" : "translate-y-full",
        "md:static md:z-auto md:h-full md:max-h-none md:flex-shrink-0 md:translate-y-0 md:rounded-none md:border-t-0 md:border-r",
        collapsed ? "md:w-12" : "md:w-64",
      ].join(" ")}
    >
      {/* Drag handle — mobile drawer only */}
      <div className="mx-auto mt-3 h-1 w-12 flex-shrink-0 rounded-full bg-outline-variant md:hidden" />

      <div className="flex flex-shrink-0 items-center justify-between border-b border-outline-variant p-stack-md">
        <span
          className={`text-label-md font-label-md uppercase tracking-wider text-secondary ${
            collapsed ? "md:hidden" : ""
          }`}
        >
          Outline
        </span>
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          aria-label={collapsed ? "Expand outline" : "Collapse outline"}
          title={collapsed ? "Expand outline" : "Collapse outline"}
          className="hidden shrink-0 text-on-surface-variant hover:text-primary md:inline-flex"
        >
          <span className="material-symbols-outlined text-[18px]">menu_open</span>
        </button>
      </div>

      <nav className={`flex-1 space-y-1 overflow-y-auto p-2 ${collapsed ? "md:hidden" : ""}`}>
        {editor && headings.length === 0 && (
          <p className="p-2 text-body-md text-on-surface-variant">
            No headings yet — add an H1 or H2 to build an outline.
          </p>
        )}
        {headings.map((h) => (
          <button
            key={h.id}
            type="button"
            onClick={() => goTo(h.pos)}
            title={h.text}
            className={`block w-full truncate rounded border-l-2 border-transparent p-2 text-left text-on-surface-variant transition-colors hover:border-secondary hover:bg-surface-container hover:text-primary ${
              h.level === 1 ? "text-body-md font-medium text-primary" : "pl-6 text-label-md"
            }`}
          >
            {h.text}
          </button>
        ))}
      </nav>
    </aside>
  );
}
