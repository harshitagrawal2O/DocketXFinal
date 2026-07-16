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

/** Shared classes for a grouped toolbar icon button (Bold/Italic/Heading/List). */
const TOOLBAR_ICON_BTN =
  "group rounded p-2 transition-colors hover:bg-surface-container-low disabled:pointer-events-none disabled:opacity-40";
const TOOLBAR_ICON =
  "material-symbols-outlined text-[20px] text-on-surface-variant transition-colors group-hover:text-primary group-data-[active=true]:text-primary";

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
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="italic text-on-surface-variant">Opening the document…</p>
      </div>
    );
  }

  return (
    <>
      <div className="w-full max-w-[850px] px-4 py-8 md:px-0">
        {/* Restrained floating toolbar */}
        <div className="sticky top-0 z-20 mb-6 flex items-center justify-between gap-2 rounded-lg border border-outline-variant/50 bg-surface-container-lowest/80 p-2 ink-shadow backdrop-blur-md">
          <div className="flex items-center gap-1">
            <div className="mr-2 flex items-center gap-1 border-r border-outline-variant pr-2">
              <button
                type="button"
                className={TOOLBAR_ICON_BTN}
                disabled={!editable}
                data-active={editor.isActive("bold")}
                onClick={() => editor.chain().focus().toggleBold().run()}
                title="Bold"
              >
                <span className={TOOLBAR_ICON}>format_bold</span>
              </button>
              <button
                type="button"
                className={TOOLBAR_ICON_BTN}
                disabled={!editable}
                data-active={editor.isActive("italic")}
                onClick={() => editor.chain().focus().toggleItalic().run()}
                title="Italic"
              >
                <span className={TOOLBAR_ICON}>format_italic</span>
              </button>
            </div>
            <div className="mr-2 flex items-center border-r border-outline-variant pr-2">
              <button
                type="button"
                className={TOOLBAR_ICON_BTN}
                disabled={!editable}
                data-active={editor.isActive("heading", { level: 2 })}
                onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                title="Heading 2"
              >
                <span
                  className={`px-1 text-label-md font-label-md text-on-surface-variant transition-colors group-hover:text-primary group-data-[active=true]:text-primary`}
                >
                  H2
                </span>
              </button>
            </div>
            <button
              type="button"
              className={TOOLBAR_ICON_BTN}
              disabled={!editable}
              data-active={editor.isActive("bulletList")}
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              title="Bulleted list"
            >
              <span className={TOOLBAR_ICON}>format_list_bulleted</span>
            </button>
          </div>

          {can(role, "comment") && (
            <button
              type="button"
              className="flex items-center gap-1 whitespace-nowrap rounded border border-secondary/30 bg-transparent px-4 py-2 text-label-md font-label-md text-secondary transition-all hover:bg-secondary/5 disabled:pointer-events-none disabled:opacity-40"
              disabled={!hasSelection}
              title={hasSelection ? "Comment on selection" : "Select text to comment"}
              onClick={() => setShowCommentBox((v) => !v)}
            >
              <span className="material-symbols-outlined text-[18px]">add_comment</span>
              Comment
            </button>
          )}
        </div>

        {exportError && (
          <div className="mb-4 rounded border border-error/30 bg-error-container px-3 py-2 text-label-md text-on-error-container">
            {exportError}
          </div>
        )}

        {showCommentBox && (
          <div className="mb-6 rounded-lg border border-outline-variant/60 bg-surface-container-lowest p-stack-md ink-shadow">
            <textarea
              autoFocus
              placeholder="Add a comment on the selected text…"
              value={commentDraft}
              onChange={(e) => setCommentDraft(e.target.value)}
              className="min-h-[80px] w-full resize-none rounded border border-outline-variant bg-surface p-2 text-body-md text-on-surface focus:border-secondary focus:outline-none"
            />
            <div className="mt-2 flex justify-end gap-2">
              <button
                type="button"
                className="rounded border border-outline-variant px-4 py-2 text-label-md font-label-md text-on-surface-variant transition-colors hover:bg-surface-container-high"
                onClick={() => setShowCommentBox(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded bg-primary px-4 py-2 text-label-md font-label-md text-on-primary transition-opacity hover:opacity-90"
                onClick={addComment}
              >
                Comment
              </button>
            </div>
          </div>
        )}

        <EditorContent editor={editor} className="pb-24" />
      </div>

      {/* Floating pill toolbar: Print / Download .docx / Download .html.
          Kept clear of the mobile bottom nav (DocumentWorkspace) via the
          responsive bottom offset. */}
      <div className="pointer-events-none fixed inset-x-0 bottom-24 z-30 flex justify-center md:bottom-6">
        <div className="pointer-events-auto flex items-center gap-1 rounded-full bg-primary bg-opacity-95 px-2 py-1.5 text-on-primary shadow-2xl backdrop-blur-md">
          <button
            type="button"
            className="rounded-full p-2.5 transition-colors hover:bg-on-primary/10"
            onClick={handlePrint}
            title="Print or Save as PDF"
          >
            <span className="material-symbols-outlined text-[20px]">print</span>
          </button>
          <div className="h-5 w-px bg-on-primary/20" />
          <button
            type="button"
            className="rounded-full p-2.5 transition-colors hover:bg-on-primary/10 disabled:opacity-50"
            onClick={() => void handleDownloadDocx()}
            disabled={exporting}
            title={exporting ? "Preparing…" : "Download as Word (.docx)"}
          >
            <span className={`material-symbols-outlined text-[20px] ${exporting ? "animate-spin" : ""}`}>
              {exporting ? "progress_activity" : "description"}
            </span>
          </button>
          <div className="h-5 w-px bg-on-primary/20" />
          <button
            type="button"
            className="rounded-full p-2.5 transition-colors hover:bg-on-primary/10"
            onClick={handleDownloadHtml}
            title="Download as HTML"
          >
            <span className="material-symbols-outlined text-[20px]">code</span>
          </button>
        </div>
      </div>

      {/* Clean print view: hidden on screen, revealed only by the print
          stylesheet (@media print) so window.print() / Save-as-PDF is tidy. */}
      {printHtml !== null && (
        <div className="print-doc" aria-hidden="true">
          <header className="print-doc-letterhead">
            <div>
              <p className="print-doc-privileged">Privileged &amp; Confidential</p>
            </div>
            <div className="print-doc-meta">
              <p>Prepared by {user.name}</p>
              <p>
                {new Date().toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </div>
          </header>
          <h1 className="print-doc-title">{title}</h1>
          <div className="print-doc-body" dangerouslySetInnerHTML={{ __html: printHtml }} />
          <footer className="print-doc-signature">
            <p>Exported via Docket by {user.name}.</p>
          </footer>
        </div>
      )}
    </>
  );
}
