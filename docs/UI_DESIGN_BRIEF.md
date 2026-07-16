# Docket v2 — UI design brief (for Stitch)

How to use this: paste the **Design System** block at the top of *every* Stitch prompt,
then append the specific **Screen** prompt below it. That keeps all screens visually
consistent — formal, legal, premium, smooth. Each screen prompt is written to be
pasted as-is; tweak copy/labels to taste.

---

## Design System (prepend to every prompt)

> Design a screen for **Docket**, a premium collaborative platform where Indian law firms
> and CAs draft, review, and manage legal documents with an AI assistant named **Viki**.
> The aesthetic is **formal, editorial, and trustworthy** — think a high-end legal-tech
> product (calm, precise, expensive-feeling), not a playful startup app.
>
> **Color**: warm off-white "paper" background (#FAF8F5 light / #14181D dark). Primary ink
> is a deep charcoal-navy (#1C2530). One restrained accent: a refined brass/gold (#9A7B4F)
> used sparingly for primary actions and active states. Success = deep emerald (#2F6F5B);
> destructive = muted oxblood (#9B3B36). Hairline borders (#E7E1D8 light). No neon, no
> loud purple, no gradients except very subtle ones.
>
> **Typography**: a refined serif for headings and document titles (editorial, e.g.
> Newsreader / Source Serif / GT Super), a clean neutral sans for UI and body (e.g. Inter).
> Generous line-height. Numbers and legal references in a tabular/monospace where precise.
>
> **Feel**: generous whitespace, calm density, 8–10px rounded corners, soft low shadows,
> hairline dividers, subtle 150–200ms transitions on hover/focus. Everything feels smooth
> and considered. Fully responsive (desktop + mobile) and support both light and dark.
> Accessible contrast. Include realistic Indian legal placeholder content (parties, clauses,
> statutes like "Indian Contract Act, 1872, s. 73"), never lorem ipsum.

---

## 1. Sign in / Register

> A centered, split-screen auth page. Left: a tall editorial panel in deep ink with the
> Docket wordmark (serif), a one-line promise ("Draft, review, and finalise legal documents
> with your team and Viki."), and a faint watermark of a legal document/seal motif. Right:
> a clean card with a segmented "Sign in / Create account" toggle, Email + Password fields
> (Name on register), a brass primary button, and a subtle "Continue with Google" secondary.
> Small reassuring footer: "Bank-grade security. Your documents stay privileged." Calm,
> premium, minimal.

## 2. Documents dashboard (home)

> A workspace home listing the firm's documents. Top bar: Docket wordmark, a workspace/firm
> switcher, global search, and an avatar menu. Page header "Documents" (serif) with a brass
> "New document" split-button (options: Blank, From template, Draft with Viki). Below: filter
> chips (All / Contracts / Opinions / Filings / Memos), a sort control, and a responsive grid
> or table of document cards. Each card: document title (serif), a small kind badge, the
> assigned people as overlapping avatars, a status pill (Draft / In review / Final), and
> "Edited 2 days ago". Quiet, scannable, lots of whitespace. Include an empty state with an
> inviting "Create your first document" prompt.

## 3. Document workspace (core three-pane)

> The main editing screen: a three-pane layout. Left rail (collapsible): document list +
> sections/outline. Center: a document-like editor on a "paper" surface with comfortable
> margins, a serif document title, and live multiplayer cursors with name labels in soft
> colors. Right rail: a tabbed panel — "Activity" (AI proposals + review), "Viki" (assistant),
> "Comments", "Versions", "Audit". A slim top toolbar shows the doc title, collaborator
> avatars, a Share button, and Export/Print. The center should read like a real legal
> document (clause numbering, defined terms in bold). Everything calm and focused; the AI
> lives in the rail, never overlapping the text. Responsive: on mobile the rail becomes a
> bottom sheet.

## 4. Editor toolbar & comments

> Close-up of the editor: a restrained formatting toolbar (Bold, Italic, Heading, List,
> and a brass "Comment" action enabled on selection). A highlighted text range with an
> anchored comment thread in the margin — a small card showing the commenter's avatar, the
> quoted text, the comment, a Reply field, and a "Resolve" action; resolved threads collapse.
> Multiplayer cursors visible. Formal, print-like typography.

## 5. Activity feed — staged AI proposals (the review experience)

> The right-rail "Activity" panel showing Viki's staged edit proposals as review cards. Each
> **hunk card**: a one-line reasoning, a diff preview (removed text struck-through in muted
> oxblood, added text in emerald), a citations row (e.g. "Indian Contract Act, 1872, s. 73"
> with a small verified ✓ badge), and three actions — **Accept** (brass), **Reject**, and
> **Edit & accept**. Show variety: one multi-hunk run grouped under a run header, one card
> with a "Citation blocked" warning state, one rejected card struck-through and collapsed,
> one "Outdated — re-run on current text" state. Clicking a card highlights the matching range
> in the document. Premium, precise, legal-review feel.

## 6. Viki agent run (streaming, no silent waits)

> The "Viki" rail while the assistant is working on an instruction. Top: the user's instruction
> and a live **state chip** cycling through "Thinking → Drafting → Self-checking → Awaiting
> review" (each labeled, never a bare spinner). Below: an **intent line** ("Tightening the
> indemnity clause and adding a liability cap…"), a live **checklist** ticking off sub-tasks,
> and proposal cards whose text streams in token-by-token (a subtle typing shimmer), with
> Accept disabled until complete. A "Stop" control. Calm, transparent, real-time.

## 7. Draft with Viki — conversational intake

> A refined chat panel titled "Draft with Viki". Viki (left-aligned bubbles, small brass
> monogram avatar) opens by asking what document is needed; the user replies (right-aligned).
> Show Viki asking a couple of focused clarifying questions, small "Using: Mutual NDA template"
> suggestion chips, a labeled state chip while it works, and a final **document-ready card**:
> "✅ Draft ready — Mutual NDA (Acme × Zeta)", a "Viki tailored:" bullet list, a "⚠ Confirm
> these:" list, and a brass "Open document →" button. Composer at the bottom with Enter-to-send.
> Feels like a smart, calm junior associate — premium, not chatbot-y.

## 8. Templates gallery

> A library screen titled "Templates" (serif). Controls row: a category dropdown, a
> "Mine / Presets / All" segmented control, sort, a search field, and a brass "New template"
> button plus a subtle "✨ Draft with Viki" call-to-action banner. Templates shown as cards
> grouped under "System Presets" (with a count) and "Your Templates". Each card: a category
> + kind badge, a source badge (⭐ Preset / Custom), the title (serif), a two-line description,
> and a small "12 fields" meta. Elegant, editorial, easy to scan. Include Indian legal template
> names (Mutual NDA, Master Services Agreement, CA Engagement Letter, Leave & License, Legal
> Notice u/s 138 NI Act).

## 9. Template detail (prompt/body view)

> A read-only detail view for a System Preset template. Header: a back link "← Back to
> Templates" and a pill "⭐ System Preset (Read only)". Fields (disabled): Name, Category,
> Description. Then a prominent **body panel** styled like a refined document/code card with a
> faint window header, a small "template-body" filename chip, and a Copy button; inside, the
> template renders as a formatted legal document with each `{{variable}}` shown as a subtle
> highlighted brass token. A Preview / Source toggle. Below, a **Variables** table (key, label,
> type, required). Footer actions: a brass "Copy as New Template" and "Use this template".
> Premium, precise.

## 10. Template editor (create / edit owned)

> The editable version of the detail view. Editable Name / Category / Kind / Description; a
> body editor (document-style) where `{{variables}}` are highlighted; and a Variables editor
> with add/remove rows (key, label, type dropdown, required toggle). Footer: brass "Save",
> "Use this template", and a quiet "Delete" with confirm. Clean form design, generous spacing.

## 11. Generate from template

> A focused "Create document from template" screen with three modes as tabs: **Form fill**
> (a tidy form with one field per template variable — date pickers, currency inputs, etc. — and
> a live document preview pane on the right where `{{variables}}` fill in as you type, unfilled
> ones shown as highlighted "[Label]" blanks), **From brief** (a large "Describe the matter"
> textarea + a "Viki is preparing the document…" state and, on completion, a summary of what
> Viki tailored + items to confirm), and **Batch** (a spreadsheet-style grid, one row per
> document, a title pattern field, and a progress list of created documents). Brass primary
> "Generate document". Premium, calm, document-forward.

## 12. Upload & analyze / Draft a template with Viki

> A two-option screen. Left card "Upload your document": a drag-and-drop / paste-text area
> ("Paste your firm's agreement…") + optional title, and an "Analyze into template" button;
> a note explains Viki will detect the fill-in fields. Right card "Draft with Viki": an
> instruction field ("A consultancy agreement for…"), a subtle "search the web for current
> formats" checkbox, and a "Draft template" button. Both show a calm loading state. On success,
> route to the template detail view. Trustworthy, minimal.

## 13. Version history & diff

> A "Versions" panel/screen: a vertical timeline of named snapshots (auto ones marked "Auto",
> manual ones with the author + timestamp), a "Save version" action, and the ability to select
> two versions to compare. The compare view is a clean side-by-side or inline diff of the
> document text (added emerald, removed oxblood) with a "Restore this version" action
> (confirming it creates a new version, never destroys history). Editorial, precise, reassuring.

## 14. Audit trail

> A "compliance-grade" audit timeline for a document. A filterable, exportable table/timeline:
> each row has a timestamp, an actor (avatar + name, or "Viki"), an event type pill (Agent run,
> Accepted, Rejected, Edited-accepted, Version saved, Rollback, Role changed), and a short
> detail. Filters by type and actor; an "Export CSV/JSON" button. This should feel authoritative
> and legal — the kind of record a CA/auditor would trust. Monospace timestamps, quiet rows.

## 15. Sharing & roles

> A "Share document" modal/panel. A field to invite by email with a role dropdown (Owner /
> Editor / Commenter / Viewer) and a short description of each role's rights. Below, the current
> members list with avatars, names, role dropdowns (only the Owner can change roles), and a
> remove action. A note: "Viewers and Commenters cannot accept AI changes or run Viki." Clean,
> permissions-clear, premium.

## 16. Usage & billing

> A "Usage" screen for the firm admin. Top: this month's spend / plan (₹, with the $20-equivalent
> starting plan), and a "Manage subscription" button. Charts: documents created, AI runs, and
> token usage over time (calm line/bar charts in ink + brass, no rainbow). A breakdown table by
> user and by activity (agent runs, template drafts, personalisation, intake). Restrained,
> data-dense but elegant, tabular numbers.

## 17. Batch generation progress

> A progress screen for a running batch: a header "Generating 20 documents from Mutual NDA",
> an overall progress bar (12/20 done, 0 failed), and a list of rows each showing the matter/
> counterparty, a per-row status (Queued / Drafting / Ready / Failed), and a link to open the
> ready ones. A calm "This runs in the background — you can leave this page" note. Premium,
> reassuring.

## 18. Settings / firm profile

> A settings screen with left-nav sections: Firm profile (name, logo/letterhead upload, address
> for document footers), Members, Billing, Viki (model, whether web-search is enabled), Security
> (sessions, sign out everywhere), and API keys (masked, "add your own key"). Right pane shows
> the selected section as a clean form. A letterhead preview for the firm profile. Formal,
> orderly.

## 19. Print / export view

> A print-optimised document view on a white A4 page with the firm letterhead at top (logo,
> address), the document title (serif), clean legal body with clause numbering, page margins,
> and a signature/execution block at the bottom. A floating toolbar (hidden in print): Print,
> Download .docx, Download PDF. This is what a firm hands to a client — it must look like a real,
> filed legal document. Restrained and authoritative.

## 20. Global states (reuse across screens)

> Design consistent **empty**, **loading**, and **error** states in the Docket style: empty
> states have a small line-art legal motif + one calm sentence + a single brass action; loading
> states always show a labeled intent line (never a bare spinner); error states are quiet and
> reassuring with a retry. Also a "Viki unavailable" state (when AI is off): a soft notice that
> editing/templates/review still work. And a subtle top progress bar for navigation.

---

### Tips for Stitch
- Generate **desktop and mobile** for the workspace, dashboard, templates, and chat screens.
- Ask for **light and dark** variants — the palette above defines both.
- Reuse the exact color hexes and the serif+sans pairing in every prompt so screens match.
- For the document surfaces (editor, template detail, print), tell Stitch "this is a real legal
  document, use clause numbering and defined terms" so it doesn't render generic marketing text.
