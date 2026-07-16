import { Extension } from "@tiptap/core";
import { Plugin, PluginKey, type EditorState, type Transaction } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { DiffProposal } from "@docket/shared";
import { getBinding, resolveProposalRange } from "@/lib/anchors";

export const proposalDecoKey = new PluginKey<DecoPluginState>("proposalDecorations");

/** Statuses whose range should still be highlighted in the editor. */
const VISIBLE_STATUSES: ReadonlySet<DiffProposal["status"]> = new Set([
  "streaming",
  "staged",
  "outdated",
]);

export interface ResolvedRange {
  id: string;
  status: DiffProposal["status"];
  from: number;
  to: number;
}

interface DecoPluginState {
  proposals: DiffProposal[];
  activeId: string | null;
  decorations: DecorationSet;
  ranges: ResolvedRange[];
}

interface DecoMeta {
  proposals?: DiffProposal[];
  activeId?: string | null;
}

export interface ProposalDecorationsOptions {
  /** Called when the user clicks inside a staged proposal's decoration. */
  onDecorationClick: (proposalId: string) => void;
}

function buildDecorations(
  state: EditorState,
  proposals: DiffProposal[],
  activeId: string | null,
): { decorations: DecorationSet; ranges: ResolvedRange[] } {
  const binding = getBinding(state);
  if (!binding) {
    return { decorations: DecorationSet.empty, ranges: [] };
  }

  const decos: Decoration[] = [];
  const ranges: ResolvedRange[] = [];
  const docSize = state.doc.content.size;

  for (const p of proposals) {
    if (!VISIBLE_STATUSES.has(p.status)) continue;
    if (!p.anchorStart || !p.anchorEnd) continue;

    const range = resolveProposalRange(binding, p.anchorStart, p.anchorEnd);
    if (!range) continue;

    const from = Math.max(0, Math.min(range.from, docSize));
    const to = Math.max(0, Math.min(range.to, docSize));
    ranges.push({ id: p.id, status: p.status, from, to });

    const classes = ["proposal-deco", `proposal-deco--${p.status}`];
    if (p.id === activeId) classes.push("is-active");
    const attrs = {
      class: classes.join(" "),
      "data-proposal-id": p.id,
    };

    if (from === to) {
      // Insertion-only proposal: no text to underline, so mark the caret point.
      decos.push(
        Decoration.widget(from, () => {
          const el = document.createElement("span");
          el.className = `${classes.join(" ")} proposal-deco--point`;
          el.setAttribute("data-proposal-id", p.id);
          el.textContent = "​";
          return el;
        }),
      );
    } else {
      decos.push(Decoration.inline(from, to, attrs));
    }
  }

  return { decorations: DecorationSet.create(state.doc, decos), ranges };
}

/**
 * Renders each staged DiffProposal as an in-editor decoration. Ranges are
 * derived from serialized Yjs relative anchors and re-resolved on every doc
 * change, so they track the text as collaborators edit. This is one of the two
 * views of a DiffProposal (the other being the activity-feed card); they share
 * the proposalId for the bidirectional click link.
 */
export const ProposalDecorations = Extension.create<ProposalDecorationsOptions>({
  name: "proposalDecorations",

  addOptions() {
    return {
      onDecorationClick: () => undefined,
    };
  },

  addProseMirrorPlugins() {
    const options = this.options;
    return [
      new Plugin<DecoPluginState>({
        key: proposalDecoKey,
        state: {
          init: () => ({
            proposals: [],
            activeId: null,
            decorations: DecorationSet.empty,
            ranges: [],
          }),
          apply(
            tr: Transaction,
            prev: DecoPluginState,
            _oldState: EditorState,
            newState: EditorState,
          ): DecoPluginState {
            const meta = tr.getMeta(proposalDecoKey) as DecoMeta | undefined;
            let proposals = prev.proposals;
            let activeId = prev.activeId;
            let needsRebuild = false;

            if (meta) {
              if (meta.proposals) {
                proposals = meta.proposals;
                needsRebuild = true;
              }
              if ("activeId" in meta) {
                activeId = meta.activeId ?? null;
                needsRebuild = true;
              }
            }
            // Doc changed (local edit or remote sync) -> anchors must re-resolve.
            if (tr.docChanged) needsRebuild = true;

            if (!needsRebuild) {
              return {
                ...prev,
                decorations: prev.decorations.map(tr.mapping, tr.doc),
              };
            }

            const { decorations, ranges } = buildDecorations(newState, proposals, activeId);
            return { proposals, activeId, decorations, ranges };
          },
        },
        props: {
          decorations(state) {
            return proposalDecoKey.getState(state)?.decorations ?? DecorationSet.empty;
          },
          handleClick(view, pos) {
            const st = proposalDecoKey.getState(view.state);
            if (!st) return false;
            // Prefer the smallest range containing the click.
            const hit = st.ranges
              .filter((r) => pos >= r.from && pos <= r.to)
              .sort((a, b) => b.from - b.to - (a.from - a.to))[0];
            if (hit) {
              options.onDecorationClick(hit.id);
              return false; // don't swallow the click; let the cursor move too
            }
            return false;
          },
        },
      }),
    ];
  },
});

/** Push the current proposal list into the decoration plugin. */
export function syncProposals(
  view: { state: EditorState; dispatch: (tr: Transaction) => void },
  proposals: DiffProposal[],
): void {
  view.dispatch(view.state.tr.setMeta(proposalDecoKey, { proposals }));
}

/** Set the active/highlighted proposal in the decoration plugin. */
export function syncActive(
  view: { state: EditorState; dispatch: (tr: Transaction) => void },
  activeId: string | null,
): void {
  view.dispatch(view.state.tr.setMeta(proposalDecoKey, { activeId }));
}
