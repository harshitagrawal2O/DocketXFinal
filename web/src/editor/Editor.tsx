import { useCallback, useEffect, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import type { Transaction } from "@tiptap/pm/state";
import StarterKit from "@tiptap/starter-kit";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCursor from "@tiptap/extension-collaboration-cursor";
import type * as Y from "yjs";
import type { WebsocketProvider } from "y-websocket";
import type { Role, SessionUser } from "@docket/shared";
import { can } from "@docket/shared";
import { exportDocx, proposalsApi } from "@/lib/api";
import { downloadBlob, safeFileName } from "@/lib/download";
import { XML_FRAGMENT } from "@/lib/yjs";
import { ySyncPluginKey } from "y-prosemirror";
import { CommentMark } from "./CommentMark";
import { ProposalDecorations, proposalDecoKey, syncActive, syncProposals } from "./ProposalDecorations";
import { useEditorInstance } from "./EditorContext";
import { useStaging } from "@/staging/StagingContext";
import { useComments } from "./CommentsContext";

interface Props {
  ydoc: Y.Doc;
  provider: WebsocketProvider;
  user: SessionUser;
  documentId: string;
  role: Role;
  title: string;
  /** Server-provided HTML for a template-generated doc awaiting seeding. */
  initialHtml: string | null;
}

export function Editor({
  ydoc,
  provider,
  user,
  documentId,
  role,
  title,
  initialHtml,
}: Props) {
  const { setEditor } = useEditorInstance();
  const staging = useStaging();
  const comments = useComments();
  const [printHtml, setPrintHtml] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // Stable ref so the editor's captured decoration-click callback always sees
  // the freshest setActive without re-creating the editor.
  const setActiveRef = useRef(staging.setActive);
  setActiveRef.current = staging.setActive;

  const [commentDraft, setCommentDraft] = useState("");
  const [showCommentBox, setShowCommentBox] = useState(false);
  const editable = can(role, "edit");

  const editor = useEditor(
    {
      editable,
      extensions: [
        // Collaboration provides history via Yjs, so disable StarterKit's.
        StarterKit.configure({ history: false }),
        Collaboration.configure({ document: ydoc, field: XML_FRAGMENT }),
        CollaborationCursor.configure({
          provider,
          user: { name: user.name, color: user.color },
        }),
        CommentMark,
        ProposalDecorations.configure({
          onDecorationClick: (proposalId) => setActiveRef.current(proposalId),
        }),
      ],
    },
    [ydoc, provider],
  );

  // Register / unregister the editor instance for other panels.
  useEffect(() => {
    setEditor(editor ?? null);
    return () => setEditor(null);
  }, [editor, setEditor]);

  // Client-side seeding of template-generated docs. The FIRST client to open a
  // doc whose server record carries `initialHtml` seeds the empty Yjs fragment,
  // guarded by a `seeded` flag in a `meta` Y.Map set in the SAME transaction so
  // exactly one client seeds and all tabs converge. We only seed after the
  // provider has synced the server state — otherwise a reconnecting client
  // could see a momentarily-empty fragment and double-seed.
  useEffect(() => {
    if (!editor || !initialHtml) return;
    let handled = false;

    const seedOnce = () => {
      if (handled) return;
      handled = true;
      const meta = ydoc.getMap<boolean>("meta");
      // Already seeded (by us earlier, or by another tab) → never re-seed.
      if (meta.get("seeded") === true) return;
      // Someone typed / the fragment already has content → don't clobber it.
      if (!editor.isEmpty) return;
      ydoc.transact(() => {
        editor.commands.setContent(initialHtml, false);
        meta.set("seeded", true);
      });
    };

    if (provider.synced) {
      seedOnce();
      return;
    }
    const onSync = (isSynced: boolean) => {
      if (isSynced) seedOnce();
    };
    provider.on("sync", onSync);
    return () => provider.off("sync", onSync);
  }, [editor, provider, ydoc, initialHtml]);

  // Push proposals into the decoration plugin whenever they change.
  useEffect(() => {
    if (!editor) return;
    syncProposals(editor.view, staging.proposals);
  }, [editor, staging.proposals]);

  // Reflect the active card highlight into the editor decoration.
  useEffect(() => {
    if (!editor) return;
    syncActive(editor.view, staging.activeId);
  }, [editor, staging.activeId]);

  // Conflict rule (invariant / claude.md): a LOCAL edit overlapping a staged
  // proposal's range flips it to `outdated` for every tab via the server.
  useEffect(() => {
    if (!editor) return;
    const onUpdate = ({ transaction }: { transaction: Transaction }) => {
      if (!transaction.docChanged) return;
      // Ignore doc changes that came from the Yjs sync (remote edits / accept).
      if (transaction.getMeta(ySyncPluginKey)) return;

      let from = Infinity;
      let to = -1;
      transaction.mapping.maps.forEach((map) => {
        map.forEach((_os, _oe, newStart, newEnd) => {
          from = Math.min(from, newStart);
          to = Math.max(to, newEnd);
        });
      });
      if (to < 0) return;

      const decoState = proposalDecoKey.getState(editor.state);
      // Overlap is detected here in ProseMirror coordinates (both the edit
      // range and each proposal range live in PM space). We send the ids we
      // found overlapping; the server flips exactly those. This avoids any
      // ProseMirror<->flat-text coordinate mismatch on the server.
      const overlappingIds = (decoState?.ranges ?? [])
        .filter((r) => r.status === "staged" && !(to < r.from || from > r.to))
        .map((r) => r.id);
      if (overlappingIds.length > 0) {
        // Fire-and-forget; server broadcasts `outdated` over the Y.Map.
        void proposalsApi.markOutdated(documentId, overlappingIds).catch(() => undefined);
      }
    };
    editor.on("update", onUpdate);
    return () => {
      editor.off("update", onUpdate);
    };
  }, [editor, documentId]);

  const addComment = useCallback(() => {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    if (from === to) return;
    const quote = editor.state.doc.textBetween(from, to, " ");
    const threadId = comments.createThread(quote, commentDraft);
    editor.chain().focus().setCommentThread(threadId).run();
    setCommentDraft("");
    setShowCommentBox(false);
  }, [editor, comments, commentDraft]);

  const handlePrint = useCallback(() => {
    if (!editor) return;
    setPrintHtml(editor.getHTML());
    // Let React paint the print-only view before opening the print dialog.
    requestAnimationFrame(() => window.print());
  }, [editor]);

  const handleDownloadDocx = useCallback(async () => {
    if (!editor || exporting) return;
    setExporting(true);
    setExportError(null);
    try {
      const blob = await exportDocx(documentId, editor.getHTML(), title);
      downloadBlob(blob, `${safeFileName(title)}.docx`);
    } catch {
      setExportError("Could not export .docx. Please try again.");
    } finally {
      setExporting(false);
    }
  }, [editor, documentId, title, exporting]);

  const handleDownloadHtml = useCallback(() => {
    if (!editor) return;
    const doc = `<!doctype html><html><head><meta charset="utf-8"><title>${title
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")}</title></head><body>${editor.getHTML()}</body></html>`;
    downloadBlob(new Blob([doc], { type: "text/html" }), `${safeFileName(title)}.html`);
  }, [editor, title]);

  const hasSelection = editor ? editor.state.selection.from !== editor.state.selection.to : false;

  if (!editor) {
    return <div className="intent-line editor-loading">Opening the document…</div>;
  }

  return (
    <div className="editor-wrap">
      <div className="editor-toolbar">
        <button
          className="btn btn-sm"
          disabled={!editable}
          onClick={() => editor.chain().focus().toggleBold().run()}
          data-active={editor.isActive("bold")}
        >
          Bold
        </button>
        <button
          className="btn btn-sm"
          disabled={!editable}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          data-active={editor.isActive("italic")}
        >
          Italic
        </button>
        <button
          className="btn btn-sm"
          disabled={!editable}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          data-active={editor.isActive("heading", { level: 2 })}
        >
          H2
        </button>
        <button
          className="btn btn-sm"
          disabled={!editable}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          data-active={editor.isActive("bulletList")}
        >
          • List
        </button>
        <div className="toolbar-spacer" />
        {can(role, "comment") && (
          <button
            className="btn btn-sm"
            disabled={!hasSelection}
            title={hasSelection ? "Comment on selection" : "Select text to comment"}
            onClick={() => setShowCommentBox((v) => !v)}
          >
            💬 Comment
          </button>
        )}
        <span className="toolbar-divider" />
        <button className="btn btn-sm" onClick={handlePrint} title="Print or Save as PDF">
          🖨 Print
        </button>
        <button
          className="btn btn-sm"
          onClick={() => void handleDownloadDocx()}
          disabled={exporting}
          title="Download as Word (.docx)"
        >
          {exporting ? "Preparing…" : "⬇ .docx"}
        </button>
        <button
          className="btn btn-sm"
          onClick={handleDownloadHtml}
          title="Download as HTML"
        >
          ⬇ .html
        </button>
      </div>

      {exportError && <div className="error-line">{exportError}</div>}

      {showCommentBox && (
        <div className="comment-compose">
          <textarea
            autoFocus
            placeholder="Add a comment on the selected text…"
            value={commentDraft}
            onChange={(e) => setCommentDraft(e.target.value)}
          />
          <div className="comment-compose-actions">
            <button className="btn btn-sm" onClick={() => setShowCommentBox(false)}>
              Cancel
            </button>
            <button className="btn btn-primary btn-sm" onClick={addComment}>
              Comment
            </button>
          </div>
        </div>
      )}

      <EditorContent editor={editor} className="editor-surface" />

      {/* Clean print view: hidden on screen, revealed only by the print
          stylesheet (@media print) so window.print() / Save-as-PDF is tidy. */}
      {printHtml !== null && (
        <div className="print-doc" aria-hidden="true">
          <h1 className="print-doc-title">{title}</h1>
          <div className="print-doc-body" dangerouslySetInnerHTML={{ __html: printHtml }} />
        </div>
      )}
    </div>
  );
}
