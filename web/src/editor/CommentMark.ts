import { Mark, mergeAttributes } from "@tiptap/core";

/**
 * MINIMAL COMMENT IMPLEMENTATION (no Tiptap Pro / Comments license).
 *
 * A `comment` mark carries a `threadId` attribute. Thread metadata (author,
 * body, resolved flag) lives in a shared Yjs Y.Map named `comments` so it syncs
 * to all collaborators; the mark only anchors the highlight to a text range.
 * Resolving a thread removes/greys the highlight without deleting the record.
 */

export interface CommentMarkOptions {
  HTMLAttributes: Record<string, unknown>;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    comment: {
      setCommentThread: (threadId: string) => ReturnType;
      unsetCommentThread: (threadId: string) => ReturnType;
    };
  }
}

export const CommentMark = Mark.create<CommentMarkOptions>({
  name: "comment",
  inclusive: false,
  excludes: "",

  addOptions() {
    return { HTMLAttributes: {} };
  },

  addAttributes() {
    return {
      threadId: {
        default: null,
        parseHTML: (el) => (el as HTMLElement).getAttribute("data-thread-id"),
        renderHTML: (attrs) =>
          attrs.threadId ? { "data-thread-id": attrs.threadId as string } : {},
      },
      resolved: {
        default: false,
        parseHTML: (el) => (el as HTMLElement).getAttribute("data-resolved") === "true",
        renderHTML: (attrs) => (attrs.resolved ? { "data-resolved": "true" } : {}),
      },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-thread-id]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        class: "comment-mark",
      }),
      0,
    ];
  },

  addCommands() {
    return {
      setCommentThread:
        (threadId: string) =>
        ({ commands }) =>
          commands.setMark(this.name, { threadId, resolved: false }),
      unsetCommentThread:
        () =>
        ({ commands }) =>
          commands.unsetMark(this.name),
    };
  },
});
