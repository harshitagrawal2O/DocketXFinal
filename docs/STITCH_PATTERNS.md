# Stitch Docket Legal Workspace — Pattern Reference

Source: `d:\MONARCH\LawDocERP\stitch_docket_legal_workspace\<screen>\code.html` (20 Stitch mockups). This doc covers the 19 screens NOT already reviewed (sign_in_register, documents_dashboard, document_workspace_3_pane were reviewed separately). Sections appear in the order requested. All 19 files were read in full.

## Canonical tailwind.config baseline

Confirmed present (values below) in **all 19 files** except where a section explicitly flags a delta. Key *order* in the JSON varies file-to-file (Stitch re-serializes the object each run) — that is cosmetic and not called out below; only value/structural differences are flagged.

```
darkMode: "class", colors: { on-primary-fixed:#131c27, primary-fixed-dim:#bec7d6, surface-tint:#565f6c, on-surface-variant:#44474b, secondary-container:#fdd7a4, surface-container-high:#ede7de, surface-container-highest:#e8e2d9, on-tertiary-fixed:#1b1c1a, on-secondary-fixed:#291800, on-secondary-container:#785c33, background:#fff8ef, tertiary-fixed-dim:#c8c6c4, secondary-fixed-dim:#e5c18f, primary:#07101a, primary-container:#1c2530, on-surface:#1d1b16, surface-variant:#e8e2d9, surface-container-low:#f9f3ea, on-background:#1d1b16, error-container:#ffdad6, surface-container-lowest:#ffffff, on-secondary:#ffffff, secondary-fixed:#ffddb1, secondary:#755a31, outline:#75777c, inverse-on-surface:#f6f0e7, on-tertiary-fixed-variant:#474745, tertiary:#0e0f0e, on-primary-container:#838c9a, outline-variant:#c5c6cc, surface:#fff8ef, on-error-container:#93000a, on-secondary-fixed-variant:#5b421c, on-primary-fixed-variant:#3e4754, on-tertiary:#ffffff, surface-container:#f3ede4, surface-dim:#dfd9d0, tertiary-container:#242423, on-primary:#ffffff, on-error:#ffffff, surface-bright:#fff8ef, inverse-surface:#33302a, on-tertiary-container:#8c8b89, error:#ba1a1a, tertiary-fixed:#e4e2df, inverse-primary:#bec7d6, primary-fixed:#dae3f2 }, borderRadius: { DEFAULT:0.25rem, lg:0.5rem, xl:0.75rem, full:9999px }, spacing: { stack-lg:32px, unit:4px, margin-page:48px, gutter:24px, stack-sm:8px, container-max-width:1440px, stack-md:16px }, fontFamily: { headline-lg/display/md:[Newsreader], label-md/sm, body-lg/md:[Inter] }, fontSize: { headline-display:48px/1.1/600/-0.02em, headline-lg:32px/1.2/500, headline-md:24px/1.3/500, body-lg:18px/1.6/400, body-md:15px/1.5/400, label-md:13px/1.2/600/0.04em, label-sm:11px/1.2/500/0.02em }
```

Shared CSS also confirmed baseline: `.material-symbols-outlined` (variable font settings, weight varies 300/400 by file — cosmetic), `.ink-shadow` / `.paper-shadow` / `.paper-texture`, `.no-scrollbar`, `.tab-transition`, `.seal-watermark` / `.cursor-blink`. Nearly every file also defines its own one-off scrollbar / shimmer / glow class — those are noted per-section only when they introduce a genuinely new *visual pattern*, not just a new class name.

**Notable config deltas found across the 19 files** (full detail repeated in the relevant section below):
- `activity_feed_ai_proposals` — adds a `brass` color token, uses px `borderRadius` instead of rem (numerically identical), and **omits the entire `fontSize` block** — every `text-headline-*/body-*/label-*` class on that page has no defined size.
- `generate_from_template_multi_mode` — **`secondary` is redefined to `#9A7B4F`** (brass-gold) instead of the canonical `#755a31` (muted umber). Real color delta, not cosmetic.
- `version_history_diff` — adds 4 new tokens (`diff-added`, `diff-added-text`, `diff-removed`, `diff-removed-text`) that duplicate values already hardcoded in a plain CSS block; the Tailwind tokens appear unused.
- `audit_trail_compliance` — most divergent file by far: colors/spacing/fontFamily/fontSize all pruned to a small subset, `borderRadius` dropped entirely, a `mono` (JetBrains Mono) font family added. The pruning is imperfect — see that section.
- `settings_firm_profile` — the only file that actually wires up `dark:` variants in markup (others declare `darkMode:"class"` but never use `dark:` classes).

---

## editor_toolbar_comments

**1. Config:** Matches baseline exactly (colors reordered only). Adds plain CSS `.highlight-brass` (inline text highlight) and reuses `.ink-shadow`/`.paper-texture`.

**2. Layout:** Fixed top nav + fixed left sidebar (firm switcher, matter nav, "New Matter" CTA) + two-column main: editor column (sticky mini toolbar + paper canvas) and a 400px comment rail. Single floating Viki FAB bottom-right.

**3. Distinctive patterns:**
- **Restrained floating toolbar** (not a full ribbon): `sticky top-20 z-40 bg-surface-container-lowest/80 backdrop-blur-md border ... p-2 rounded-lg flex items-center justify-between ink-shadow`, icon buttons grouped with `border-r border-outline-variant pr-2 mr-2` dividers, a "Heading ▾" dropdown-style button, and a distinct outline "Comment" button: `border border-secondary/30 text-secondary rounded ... hover:bg-secondary/5`.
- **Anchored comment card** with reply affordance:
```html
<div class="bg-surface-container-lowest border border-outline-variant/60 rounded-lg p-stack-md ink-shadow animate-in slide-in-from-right duration-500">
  <div class="flex items-start justify-between mb-stack-sm">
    <div class="flex items-center gap-stack-sm">
      <img class="w-8 h-8 rounded-full border border-outline-variant object-cover" .../>
      <div><h4 class="text-label-md font-label-md text-primary leading-none">Adv. Arjun Mehta</h4>
      <p class="text-[10px] text-on-surface-variant font-medium">Senior Partner • 2h ago</p></div>
    </div>
    <button class="text-secondary hover:underline text-[11px] font-bold uppercase tracking-wider">Resolve</button>
  </div>
  <div class="bg-surface-container-low border-l-4 border-secondary p-3 mb-stack-md italic text-body-md text-on-surface-variant text-sm">"...quoted excerpt..."</div>
```
- **Secondary/resolved-adjacent comment** de-emphasized via `opacity-40 grayscale hover:opacity-100 hover:grayscale-0`.
- Text-anchor highlight: `.highlight-brass { background-color: rgba(154,123,79,.15); border-bottom: 2px solid #9A7B4F; }`, JS-linked hover to nudge the comment card.

**4. Icons:** notifications, help, format_bold, format_italic, expand_more, format_list_bulleted, add_comment, add, folder_open, travel_explore, description, inventory_2, settings, support_agent, auto_awesome.

**5. Copy:** "Restrained Toolbar", "Comment", "Resolve" / "Post Reply", clause label `Section 4.2`, firm "Khaitan & Co. — Arbitration Dept."

**6. Data shape:** `Comment {id, author, authorRole, avatarUrl, timestamp, anchorText, body, resolved, replies:[{author, initials, body}]}` anchored to a document text range; `Document{title, sections}`.

---

## activity_feed_ai_proposals

**1. Config delta (important):** Adds `"brass": "#9A7B4F"` to colors; `borderRadius` given in px (`4px/8px/12px/9999px`, numerically = baseline rem values); **`fontSize` block is entirely absent** — this page's `text-headline-lg`, `text-label-sm`, `text-body-lg`, etc. have no defined size in this file's own config (relies on whatever the CDN default/last-loaded config resolves to).

**2. Layout:** Fixed top nav + fixed left sidebar (identical nav shell to editor_toolbar_comments) + document canvas (left) + 400px "Viki AI Proposals" rail (right) with its own header/scroll body/footer.

**3. Distinctive patterns — the canonical diff/proposal-review UI:**
```html
<div class="bg-surface-container-low p-3 border-l-2 border-outline-variant font-mono text-[13px] leading-relaxed">
  The Defaulting Party shall indemnify <span class="diff-removed">all losses sustained</span>
  <span class="diff-added">only direct losses foreseeable at the time of contract</span>.
</div>
<div class="flex items-center gap-2 py-1 px-2 bg-surface rounded w-fit border border-outline-variant/30">
  <span class="material-symbols-outlined text-[14px] text-secondary" style="font-variation-settings:'FILL' 1;">verified</span>
  <span class="text-[11px] font-label-md text-secondary">Indian Contract Act, 1872, s. 73</span>
</div>
<div class="flex gap-2 pt-2">
  <button class="flex-1 py-1.5 bg-primary text-on-primary text-label-sm font-label-md rounded hover:opacity-90">Accept</button>
  <button class="flex-1 py-1.5 border border-outline text-on-surface-variant text-label-sm font-label-md rounded hover:bg-surface-container">Reject</button>
  <button class="p-1.5 border border-outline text-outline rounded hover:bg-surface-container"><span class="material-symbols-outlined text-sm">edit</span></button>
</div>
```
`.diff-removed{text-decoration:line-through;color:#7f1d1d;background:#fef2f2}` / `.diff-added{color:#065f46;background:#ecfdf5;font-weight:500}` — a different (Tailwind-red/emerald-900-ish) palette than `version_history_diff`'s tokens. Also: **blocked-citation card** (`border-error/30`, `bg-error-container/20`, `block` icon, "Accept & Log"/"Ignore" actions); **stale/outdated card** (grayscale, centered overlay chip "Outdated: Content Modified" + `history` icon, underlying content at `opacity-40`); dashed **"add supporting authority" row** (`border-2 border-dashed hover:border-secondary`, `gavel` icon, `add_circle` action); section divider with centered label (`h-px flex-1` lines flanking `ACTIVE PROPOSALS (3)`); footer **"Apply All Proposed"** solid-secondary button + icon-only `refresh` button; model attribution footer text.

**4. Icons:** search, notifications, help, business_center, travel_explore, description, inventory_2, settings, support_agent, auto_awesome, filter_list, more_vert, lightbulb, verified, warning, block, history, gavel, add_circle, done_all, refresh, chat_bubble.

**5. Copy:** "Viki AI Proposals", "Active Proposals (3)", "Clause 7.1 Realignment", "Citation blocked: Confidential Precedent X-04", "Apply All Proposed", "Powered by Viki Legal LLM v4.2".

**6. Data shape:** `Proposal {id, clauseRef, title, rationale, diff:{before,after}, citation:{text, statute, status: verified|blocked}, state: active|blocked|stale, createdAt}`.

---

## viki_agent_run_active

**1. Config:** Matches baseline exactly.

**2. Layout:** Fixed top nav + fixed left sidebar (Viki AI item highlighted with `bg-secondary-container/30 border border-secondary/20`) + split main: document editor (left, `flex-1`) and a 400px **agent-run rail** (right, `bg-surface-dim`, `sticky`).

**3. Distinctive patterns — the only "live agent run" screen:**
- **Active-run header**: instruction quoted verbatim in a `bg-primary-container` box, a pill state-chip with an animated ping dot that cycles text via `setInterval` (Thinking → Drafting → Self-checking), an italic "intent line", and a **Stop** button: `bg-error-container text-on-error-container hover:bg-error hover:text-on-error`.
- **Sub-task checklist** (done = check icon in filled box; active = pulsing dot; pending = empty box + `opacity-40` text):
```html
<div class="flex items-center gap-3 group">
  <div class="w-5 h-5 flex items-center justify-center rounded border border-secondary bg-secondary/10">
    <span class="material-symbols-outlined text-[14px] text-secondary">check</span>
  </div>
  <span class="text-body-md text-on-surface">Analyzing Clause 11.1 context</span>
</div>
<div class="flex items-center gap-3 group opacity-40">
  <div class="w-5 h-5 flex items-center justify-center rounded border border-outline"></div>
  <span class="text-body-md">Conducting self-checking &amp; consistency audit</span>
</div>
```
- **Streaming proposal card** with `.shimmer` overlay, JS `typeWriter()` char-by-char reveal, and a progress bar + `%` label; a **queued/skeleton card** below it (`opacity-60`, pulsing grey bars, no content yet).
- In-document "Active AI Revision in Progress" block with shimmer + a ghost/streaming placeholder line (`opacity-40 italic`, "[Streaming Value...]").
- Footer: "Edit Prompt" (neutral) + "Apply Changes" (primary, `disabled` + `disabled:opacity-50`) + model line "Model: Viki-Legal-L5 (Arbitration Optimized)".

**4. Icons:** notifications, help, folder_open, travel_explore, description, inventory_2, settings, support_agent, auto_awesome, add, stop_circle, check, history, done_all, security.

**5. Copy:** "Viki AI Active Run", "Thinking / Drafting / Self-checking", "Sub-tasks status", "Live Proposals", "Apply Changes".

**6. Data shape:** `AgentRun {id, instruction, state: thinking|drafting|checking, subtasks:[{label,status:done|active|pending}], proposals:[{id,text,confidencePct,status:drafting|queued}]}`.

---

## draft_with_viki_chat

**1. Config:** Matches baseline exactly.

**2. Layout:** Fixed left sidebar + fixed top header + single-column **full-page chat** (no document canvas) — the only screen where Viki is the entire workspace, not a side rail.

**3. Distinctive patterns — the chat/conversation primitives:**
```html
<!-- Agent bubble -->
<div class="flex gap-4 max-w-2xl">
  <div class="w-8 h-8 rounded-sm viki-gradient flex-shrink-0 flex items-center justify-center text-white font-headline-md italic text-lg shadow-sm">V</div>
  <div class="bg-surface-container-low p-4 rounded-lg border border-outline-variant/50 ink-shadow">
    <p class="text-body-md leading-relaxed">Good morning. I'm ready to assist...</p>
  </div>
</div>
<!-- User bubble (right-aligned, reversed) -->
<div class="flex gap-4 max-w-2xl ml-auto flex-row-reverse">
  <div class="w-8 h-8 rounded-sm bg-primary-container ... text-white font-label-md text-xs">JD</div>
  <div class="bg-primary text-on-primary p-4 rounded-lg ink-shadow"><p class="text-body-md">Let's go with the Mutual NDA...</p></div>
</div>
```
`.viki-gradient{background:linear-gradient(135deg,#9A7B4F 0%,#755a31 100%)}` — brass gradient square avatar is the Viki identity mark (reused nowhere else this explicitly). Suggested-reply **chip row** (`bg-white border border-outline-variant hover:border-secondary`), a **2-up choice card grid** for clarifying questions, and a **"Document Ready" success card**: secondary-bordered white card, solid-secondary header bar with `check_circle`, a checklist of `verified_user` rows, full-width CTA "Open document →". Chat input bar: `attach_file` icon + text input + primary "Send" button. `.typing-dot` keyframes defined (3-dot indicator) though not rendered in this static state. Decorative giant rotated background text "Archival Quality" (`opacity-20`, pointer-events none).

**4. Icons:** folder_open, travel_explore, description, inventory_2, auto_awesome, support_agent, settings, notifications, help, attach_file, send, arrow_forward, check_circle, verified_user, bolt.

**5. Copy:** "Draft with Viki", "Smart Drafting Assistant", "High Priority" chip, "Document Ready", "Open document", "Drafting suggestions based on Firm Guidelines 2024".

**6. Data shape:** `ChatMessage {id, sender: viki|user, avatarInitials, body, suggestions?:[string], choiceCards?:[{title,description}], resultCard?:{status,title,version,highlights:[string],ctaLabel}}`.

---

## templates_gallery

**1. Config:** Matches baseline exactly.

**2. Layout:** Top nav + fixed left sidebar (chambers identity, generic nav incl. highlighted "Templates") + main content: header + filter row + a Viki promo banner + two card-grid sections ("System Presets", "Your Templates"). Mobile-only FAB.

**3. Distinctive patterns:**
- **Segmented control** with a JS-toggled active pill: `flex bg-surface-container-high p-1 rounded-full border border-outline-variant` → active gets `.active-pill{background:#1c2530;color:#fff}` (i.e., `bg-primary`-equivalent solid fill), inactive `hover:bg-surface-container-highest`.
- **Solid brass CTA button** distinct from the standard primary button: `.brass-button{background:#755a31;color:#fff}` + `hover{background:#5b421c; translateY(-1px)}`, used for "NEW TEMPLATE" (`rounded-full`).
- **Viki promo banner**: `.viki-gradient{linear-gradient(135deg,#07101a,#1c2530)}` full-bleed card, on-primary CTA pill "START GENERATING" (`bg-on-primary text-primary hover:bg-primary-fixed`).
- **Template card**:
```html
<div class="p-stack-md border border-outline-variant bg-white card-hover transition-all cursor-pointer flex flex-col h-full">
  <div class="flex justify-between items-start mb-4">
    <span class="px-2 py-1 bg-surface-container-high rounded text-[10px] font-label-md text-secondary uppercase tracking-tighter">Arbitration</span>
    <button class="material-symbols-outlined text-outline hover:text-primary">more_vert</button>
  </div>
  <h3 class="font-headline-md text-headline-md text-primary mb-2">Notice of Arbitration</h3>
  <p class="text-on-surface-variant text-label-md font-body-md flex-1">Standardized notice under Section 21...</p>
  <div class="mt-stack-md pt-stack-md border-t border-outline-variant/30 flex justify-between items-center text-outline">
    <span class="text-[11px] font-label-md uppercase">V.3 (Latest)</span>
    <span class="material-symbols-outlined text-sm">open_in_new</span>
  </div>
</div>
```
System-preset footer shows version + `open_in_new`; user-template footer shows "Last used X ago" + `edit`. Dashed **empty/add-new card**: `border-2 border-dashed ... min-h-[220px]`, `post_add` icon, "Save current draft as template".

**4. Icons:** notifications, help_outline, account_balance, business_center, saved_search, description, inventory_2, settings, auto_awesome, contact_support, logout, add, expand_more, search, more_vert, open_in_new, edit, post_add.

**5. Copy:** "Curated repository of standardized legal instruments and firm-approved drafting presets.", "Draft with Viki — Describe your requirements and let Viki generate a custom legal template based on your firm's historical filings and latest judicial precedents.", category labels ("Civil Litigation", "Writ Jurisdiction", "Corporate").

**6. Data shape:** `Template {id, title, category, description, version, scope: system|user, lastUsedAt?, updatedAt}` split into System Presets vs Your Templates collections.

---

## template_detail_read_only

**1. Config:** Matches baseline exactly.

**2. Layout:** Top nav + fixed left sidebar (Templates highlighted) + centered single-column detail: breadcrumb/header, a bordered document-preview panel, a variables table, and a **page-fixed footer action bar** (not just page-bottom — `fixed bottom-0` with `lg:pl-64` to clear the sidebar).

**3. Distinctive patterns — template variable rendering + Preview/Source toggle:**
```html
<span class="flex items-center gap-1 bg-secondary-container text-secondary px-3 py-0.5 rounded-full font-label-sm text-label-sm border border-secondary/20">
  <span class="material-symbols-outlined text-[14px]" style="font-variation-settings:'FILL' 1;">star</span> SYSTEM PRESET
</span>
<div class="flex bg-surface-container-low p-1 rounded-lg border border-outline-variant shadow-sm">
  <button class="px-4 py-1.5 font-label-sm text-label-sm rounded-md bg-white shadow-sm text-primary" id="previewBtn">Preview</button>
  <button class="px-4 py-1.5 font-label-sm text-label-sm rounded-md text-on-surface-variant" id="sourceBtn">Source</button>
</div>
...
<h2 class="font-headline-md text-headline-md uppercase tracking-[0.2em]">In the High Court of <span class="brass-variable">{{Court_Jurisdiction}}</span></h2>
```
`.brass-variable` = filled secondary-container pill for inline `{{Variable}}` tokens inside rendered prose (vs. `template_editor_edit_create`'s dashed-underline `.variable-chip` — two different visual treatments for the same "variable placeholder" concept worth reconciling). **Dynamic Variables table**: `thead bg-surface-container-low`, zebra rows (`bg-[#FAF8F5]` alternating), mono key column, TYPE badge chip (`bg-surface-container rounded text-[11px] font-bold uppercase` → "Text"/"Date"/"Selection"), REQUIRED column (`check_circle` filled vs `radio_button_unchecked opacity-20`), "+ Show all N remaining variables" expand link. Ghost notary-seal image + 3%-opacity "Docket Official" watermark. Footer: info note + "Copy as New Template" (outline-secondary) + "Use this template" (solid primary, `bolt` icon).

**4. Icons:** notifications, help_outline, account_balance, business_center, saved_search, description, inventory_2, settings, auto_awesome, arrow_back, star, check_circle, radio_button_unchecked, content_copy, bolt, info.

**5. Copy:** "SYSTEM PRESET", "Service of Process Affidavit", "Dynamic Variables", "14 Keys Identified", "Standard High Court compliance template (v2.4)", "Use this template".

**6. Data shape:** `Template {..., variables:[{key, label, type: text|date|selection, required:boolean}], renderedBody, sourceBody}`.

---

## template_editor_edit_create

**1. Config:** Matches baseline exactly.

**2. Layout:** Top nav + fixed left sidebar + centered form (Name/Category/Description) above a two-column workspace: document editor (left, serif canvas with inline variable chips) + a **variables sidebar** (right, sticky). Sticky footer action bar.

**3. Distinctive patterns — the variable-authoring UI (inverse of template_detail's read-only view):**
```html
<span class="variable-chip" onclick="alert('Variable: Execution Date')">{{Execution_Date}}</span>
<!-- .variable-chip { background:#fdd7a4; color:#785c33; padding:0 4px; border-radius:2px; font-weight:600; border-bottom:1px solid #9A7B4F; cursor:pointer; } -->
```
```html
<div class="group border-b border-surface-container-high pb-2">
  <div class="flex justify-between items-start">
    <span class="text-[12px] font-mono bg-surface-container-highest px-1 rounded text-primary">Execution_Date</span>
    <button class="opacity-0 group-hover:opacity-100 material-symbols-outlined text-error text-[18px]">delete</button>
  </div>
  <input class="w-full border-0 p-0 text-[13px] bg-transparent text-on-surface-variant focus:ring-0" type="text" value="DD-MM-YYYY"/>
</div>
```
Hover-reveal delete icon (`opacity-0 group-hover:opacity-100`) is a reusable "editable list row" pattern. "+ Add Row" ghost link, tip callout about `{{ }}` syntax. Breadcrumb `Templates > Edit Master Agreement`. Footer: destructive text-link "Delete Template" (`text-error`, left-aligned, opposite side from primary actions) + "Save Draft" (outline) + "Save and Finalize" (solid primary) — both uppercase/tracked, unlike other screens' sentence-case buttons.

**4. Icons:** notifications, help_outline, business_center, saved_search, description, auto_awesome, contact_support, logout, chevron_right, add, delete.

**5. Copy:** "Master Service Agreement", "Active Variables", "Tip: Type double curly braces {{ }} anywhere in the document to create a new interactive variable.", "Save and Finalize".

**6. Data shape:** `Template {id, name, category, description, bodyWithVariables, variables:[{key, placeholderValue}]}` — editable, contrasts with template_detail_read_only's read-only variant of the same object.

---

## generate_from_template_multi_mode

**1. Config delta:** `"secondary": "#9A7B4F"` — overrides the canonical `#755a31`. All other tokens match baseline. (This is the file the user's own inline comment calls out: `/* Adjusted to Brass from prompt/identity */`.)

**2. Layout:** Contextual header (no persistent sidebar — "Back to Library" replaces it) + two-pane workspace: 1/3-width **tabbed interaction column** (left) driving a live 2/3-width **document preview** (right). This is the richest multi-mode screen in the set.

**3. Distinctive patterns — three generation modes behind one tab bar:**
```html
<div class="flex border-b border-outline-variant bg-surface px-8 pt-4">
  <button class="px-4 py-2 font-label-md text-label-md active-tab" id="tab-form" onclick="switchTab('form')">Form Fill</button>
  <button class="px-4 py-2 font-label-md text-label-md text-on-surface-variant" id="tab-brief" onclick="switchTab('brief')">From Brief</button>
  <button class="px-4 py-2 font-label-md text-label-md text-on-surface-variant" id="tab-batch" onclick="switchTab('batch')">Batch</button>
</div>
<!-- .active-tab { border-bottom: 2px solid #9A7B4F; color: #07101a; } -->
```
- **Form Fill** = underline inputs incl. a prefixed-currency field (`<span>INR</span>` beside a number input).
- **From Brief** = Viki assistant intro + large free-text textarea + "Process Brief" button (`bg-primary-container`).
- **Batch** = an editable spreadsheet-like table (row-number column, one live `<input>` cell mid-table, a trailing `opacity-40` ghost row for visual padding).
- **Live preview pane**: zoom/print controls + "Page 1 of 12" counter above an A4-like card with a radial-dot watermark background and `.brass-highlight` inline spans (`background:rgba(154,123,79,.1); border-bottom:1px dashed #9A7B4F`) marking populated values live; signature blocks show italic `opacity-20` "Digital Signature Required" placeholders pre-signature.

**4. Icons:** notifications, help_outline, arrow_back, auto_awesome, zoom_in, print.

**5. Copy:** "Form Fill / From Brief / Batch", "Describe your case brief... Viki will automatically extract variables and draft the document following the Chambers' standard archival style.", "Digital Archival Copy", "Digital Signature Required".

**6. Data shape:** `GenerationRequest {templateId, mode: form|brief|batch, formValues?:{...}, briefText?, batchRows?:[{clientName,date,valuation}]}` → live-rendered `DocumentPreview{pageCount, htmlBody}`.

---

## upload_analyze_draft_intake

**1. Config:** Matches baseline exactly.

**2. Layout:** Top nav + fixed left sidebar + centered header + a **2-up "bento" choice grid** (Upload vs. Draft-with-Viki), each card structurally identical (icon chip → heading → description → interactive body → CTA). Contextual tip footer.

**3. Distinctive patterns — the entry-point chooser:**
```html
<div class="flex-grow flex flex-col items-center justify-center border-2 border-dashed border-outline-variant rounded-lg p-stack-lg bg-surface-container-low group hover:border-primary transition-colors cursor-pointer relative overflow-hidden" id="drop-zone">
  <div class="hidden absolute inset-0 bg-surface-container-low/90 backdrop-blur-sm z-10 flex flex-col items-center justify-center p-stack-lg" id="loading-overlay">
    <div class="w-48 h-1 bg-outline-variant rounded-full overflow-hidden relative mb-stack-md"><div class="absolute inset-0 loading-shimmer"></div></div>
    <p class="font-label-md text-label-md text-primary animate-pulse">OCR &amp; Clause Identification In Progress...</p>
  </div>
  <span class="material-symbols-outlined text-outline text-4xl mb-stack-sm group-hover:scale-110 transition-transform">cloud_upload</span>
  <p class="font-label-md text-label-md text-on-surface-variant">Drop PDF, DOCX or Scan here</p>
</div>
<button class="w-full bg-primary text-on-primary py-stack-md ... rounded-lg" onclick="simulateAnalysis()">Analyze into template →</button>
```
JS drag/drop listeners toggle border/bg; a chained `setTimeout` cycles overlay copy ("OCR & Clause Identification..." → "Extracting Metadata..." → "Ready for Template Mapping") — a 3-stage inline-overlay loading pattern distinct from the rail-based one in `viki_agent_run_active`. Second card uses an **outline-secondary CTA** (`border border-secondary text-secondary hover:bg-secondary-container/10`) with icon `magic_button`, plus topic-suggestion chips (Litigation/Taxation/Contract). Footer "Pro Tip" callout: `lightbulb` icon + bold lead-in.

**4. Icons:** notifications, help_outline, business_center, saved_search, description, inventory_2, settings, auto_awesome, contact_support, logout, upload_file, cloud_upload, arrow_forward, lightbulb, magic_button.

**5. Copy:** "Intake New Document", "Select an entry method to begin the drafting process with archival precision.", "Analyze into template", "Draft template", "Pro Tip: You can mention specific Clause numbers or Statutes to help Viki reference the Indian Penal Code or specialized tax acts."

**6. Data shape:** Entry point only — produces either `UploadedFile{name,size,mime}` → OCR job, or `{instructionText, suggestedTags:[string]}` → Viki draft job.

---

## version_history_diff

**1. Config delta:** Adds 4 tokens to `colors`: `diff-added:#d1fae5`, `diff-added-text:#065f46`, `diff-removed:#fee2e2`, `diff-removed-text:#991b1b`. These duplicate a plain CSS block (`.diff-added{background:#d1fae5;color:#065f46}` / `.diff-removed{background:#fee2e2;color:#991b1b;text-decoration:line-through}`) that markup actually uses via bare class names — the Tailwind color tokens appear to be dead config. Note this is a **different palette** than `activity_feed_ai_proposals`'s diff colors (emerald-50/#065f46 here vs `#ecfdf5`/`#065f46` there — close but not identical; removed is `#fee2e2`/`#991b1b` here vs `#fef2f2`/`#7f1d1d` there).

**2. Layout:** Fixed left sidebar + top nav + split main: full-height document diff view (left, scrollable) and a fixed 320px **version-history timeline** (right) with its own footer action.

**3. Distinctive patterns — the version timeline:**
```html
<div class="relative space-y-stack-lg">
  <div class="absolute left-[13px] top-2 bottom-2 w-[1px] bg-outline-variant z-0"></div>
  <div class="relative z-10 flex gap-4 group cursor-pointer">
    <div class="w-7 h-7 rounded-full bg-primary flex items-center justify-center border-4 border-surface-container-low">
      <span class="material-symbols-outlined text-white text-[14px]">history</span>
    </div>
    <div class="flex-1 -mt-1 bg-surface border border-primary p-3 rounded-lg shadow-sm">
      <div class="flex justify-between items-start mb-1">
        <span class="font-label-md text-[12px] text-primary">Current Version</span>
        <span class="font-label-sm text-[10px] bg-secondary-container text-on-secondary-container px-1.5 py-0.5 rounded">AUTO</span>
      </div>
      <h4 class="font-body-md font-semibold text-primary mb-1">Escalation Clause Adjusted</h4>
      <div class="flex items-center gap-2 mb-3">
        <div class="w-5 h-5 rounded-full bg-primary-fixed flex items-center justify-center"><span class="font-label-sm text-[9px] text-primary">SR</span></div>
        <span class="font-label-sm text-on-surface-variant">S. Rao • Just now</span>
      </div>
      <button class="w-full py-1.5 border border-primary text-primary font-label-sm text-[11px] rounded hover:bg-primary hover:text-on-primary">Restore this version</button>
    </div>
  </div>
```
Vertical connector line + filled/active dot (primary, `history` icon) vs. hollow/past dots (`bg-surface-container-highest`, small inner dot). Tag chips: **AUTO** and **MILESTONE** both render `bg-secondary-container` while **MANUAL** renders neutral `bg-surface-container-highest` — tag color is not 1:1 per type. Inline diff uses clause-number eyebrow labels (`CLAUSE 1.1: DEFINITIONS`). Footer: "Create Manual Snapshot" primary CTA + "All changes are digitally signed" trust microcopy.

**4. Icons:** business_center, description, saved_search, auto_awesome, inventory_2, settings, contact_support, logout, lock, filter_list, history, add_circle.

**5. Copy:** "Draft No. 42-B", "VERSION HISTORY", "Restore this version", "End of Comparison View", "All changes are digitally signed."

**6. Data shape:** `Version {id, label, type: AUTO|MANUAL|MILESTONE, author:{name,initials}, timestamp, isCurrent}` list + a `Diff{clauseRef, removedText, addedText}[]` for the currently-selected comparison.

---

## audit_trail_compliance

**1. Config — most divergent file in the set.** `colors` pruned from 45 to ~26 keys (drops `secondary`/`on-secondary`, `surface-tint`, `on-primary-fixed-variant`, `surface-bright`, `surface-variant`, `inverse-on-surface`, `surface-dim`, `on-error-container`, `on-tertiary-fixed`, `tertiary-fixed`, plain `surface-container`, `on-error`, `on-tertiary(-container)`, `secondary-fixed(-dim)`, `inverse-primary`, `primary-fixed-dim`, and **`on-surface-variant`**; also has a literal duplicate `"secondary-container"` key). `borderRadius` block is dropped entirely. `spacing` cut to 4 of 7 keys. `fontFamily`/`fontSize` cut to `label-md`/`headline-md`/`body-md` only, **plus a new `mono: ["JetBrains Mono"]`** family for timestamps/hashes. **Real bug, not just pruning:** the markup still uses `text-on-surface-variant` (nav links, table header labels) and `bg-surface-container` (thead row) — both now-undefined tokens — so those utilities silently produce no CSS in this file.

**2. Layout:** Top nav + fixed left sidebar ("Audit Trail" highlighted, icon `history_edu`) + main: breadcrumb, header + Export buttons, a filter bar, a dense audit **table**, and pagination.

**3. Distinctive patterns — compliance ledger table with ad-hoc (non-token) badge colors:**
```html
<td class="p-4 mono-font text-[13px] text-primary">2023-11-24 14:22:08</td>
<td class="p-4"><div class="flex items-center gap-3">
  <div class="w-6 h-6 rounded-full bg-primary-container flex items-center justify-center"><span class="material-symbols-outlined text-[14px] text-white">smart_toy</span></div>
  <span class="font-label-md text-primary">Viki AI Agent</span>
</div></td>
<td class="p-4"><span class="px-2 py-0.5 bg-[#E8F1F8] text-[#1E4D7B] rounded-sm text-[11px] font-bold uppercase tracking-tight">Agent Run</span></td>
<td class="p-4 text-body-md text-on-surface">Automated cross-reference check...</td>
<td class="p-4 text-right mono-font text-[12px] text-outline">f7a2...91b0</td>
```
Event-type badges use **raw inline hex, not design tokens**: Agent Run = `#E8F1F8`/`#1E4D7B` (blue), Accepted = `#E7F3E8`/`#2E5B31` (green), Rollback = `#FDE8E8`/`#9B2C2C` (rose) — only "Access Log" uses a token (`bg-surface-container-highest`). Actor cell swaps icon-badge (`smart_toy` for AI, `shield_person` for admin) vs. real avatar photo for humans. Hash column right-aligned truncated mono hex. Numbered pagination with disabled prev, filled current page (`bg-primary-container`), ellipsis.

**4. Icons:** search, notifications, account_balance, business_center, history_edu, description, auto_awesome, contact_support, logout, chevron_right, download, terminal, info, smart_toy, shield_person, chevron_left.

**5. Copy:** "Compliance Audit Trail", "Permanent archival record of all modifications, validations, and agent-driven workflows...", "Export CSV" / "Export JSON", "128 total entries recorded".

**6. Data shape:** `AuditEntry {timestamp, actor:{type:ai|human|system, name, avatarUrl?}, eventType: AgentRun|Accepted|Rollback|AccessLog, details, hash}`.

---

## sharing_roles_modal

**1. Config:** Matches baseline exactly.

**2. Layout:** Standalone centered **modal card** (no page chrome at all — `body` is just a flex-centered viewport holding one `max-w-[560px]` card). Header / invite row / scrollable members list / footer note + actions.

**3. Distinctive patterns — the canonical sharing modal:**
```html
<div class="w-full max-w-[560px] bg-surface-container-lowest hairline-border rounded-lg ink-shadow overflow-hidden flex flex-col animate-in fade-in zoom-in duration-300">
  <div class="px-stack-lg pt-stack-lg pb-stack-md flex justify-between items-start">
    <div class="space-y-1"><h1 class="font-headline-md text-headline-md text-primary">Share document</h1>
    <p class="font-body-md text-body-md text-on-surface-variant italic">Partnership Agreement - Project Astra (Rev 4)</p></div>
    <button aria-label="Close modal" class="p-2 hover:bg-surface-container transition-colors rounded-full"><span class="material-symbols-outlined text-outline">close</span></button>
  </div>
  <div class="flex gap-2"><!-- email input + role <select>(Editor/Commenter/Viewer) + Invite button --></div>
```
Member row: avatar (photo or initials-fallback circle, e.g. "PL") + name/email; **Owner** renders as plain italic text (`text-outline italic`, not editable), all other roles render as an inline `<select>` whose options double as actions — `Editor / Commenter / Viewer / Remove` (Remove styled `text-error`), and choosing "Remove" fades+desaturates the row via JS rather than deleting immediately. Footer restriction note: `info` icon + bold lead-in explaining that Viewers/Commenters cannot print/download/copy and Editors cannot manage permissions. Footer actions: ghost "Copy link" (icon+text, left) vs. Cancel/Save Changes (right).

**4. Icons:** close, expand_more, info, link.

**5. Copy:** "Share document", "ADD MEMBERS BY EMAIL", "PEOPLE WITH ACCESS", "Restriction Note: Viewers and Commenters are restricted from printing, downloading, or copying the sensitive artifacts within this case folder. Editors may modify content but cannot manage permissions.", "Copy link".

**6. Data shape:** `Share {documentTitle, members:[{name,email,avatarUrl?,role: Owner|Editor|Commenter|Viewer}], inviteForm:{email,role}}`. Confirms canonical role vocabulary: **Owner, Editor, Commenter, Viewer**.

---

## usage_billing_dashboard

**1. Config:** Matches baseline exactly. Note: this screen's top-left header renders the literal word **"Settings"** in place of the "Docket" logotype, with a Profile/Firm Details/Usage & Billing/Integrations sub-nav next to it — see cross-reference under `settings_firm_profile` below; the two "Settings" screens disagree on IA.

**2. Layout:** Fixed left sidebar (standard app nav, "Settings" highlighted) + top header (settings sub-nav, see above) + main: hero billing summary (2/3 + 1/3 grid), a 2-up analytics bento (bar chart + line chart), and a full-width user-activity table.

**3. Distinctive patterns — billing/analytics primitives (new to this doc):**
- **Spend card** with decorative blurred background circle (`absolute -right-12 -bottom-12 w-64 h-64 bg-surface-container-highest rounded-full opacity-50 blur-3xl`), big currency figure (`₹42,850`), primary + outline button pair.
- **Plan card**: badge chip "Premium Enterprise" (`bg-secondary-container text-on-secondary-container`), thin (`h-1.5`) seat-usage progress bar.
- **CSS bar chart**: divs with inline `style="height:N%"` + `.chart-bar{transition:height .6s}`, animated from 0 on `DOMContentLoaded`.
- **Inline SVG line chart** with gradient-filled area under a `<path>`, plus a floating tooltip chip (`bg-primary-container text-surface`, "Peak: 242 Runs (Sept 18)").
- **Zebra-striped data table** (`.zebra-row:nth-child(even)`) with avatar-initial circles, right-aligned numeric columns, `more_vert` row action, disabled-state pagination button (`disabled` + `disabled:opacity-50`).

**4. Icons:** business_center, saved_search, description, inventory_2, settings, auto_awesome, contact_support, logout, notifications, help_outline, trending_up, search, filter_list, more_vert, chevron_left, chevron_right.

**5. Copy:** "Current Month Spend", "Manage Subscription" / "View Invoices", "Chambers Suite", "Documents Drafted", "Viki AI Utilization", "User Activity Breakdown".

**6. Data shape:** `BillingSummary{monthlySpend, plan:{name,tier,seatsUsed,seatsTotal,nextBillingDate}}`, `UsageSeries{weekly:[docsDrafted]}`, `AiUsageSeries{daily:[queries]}`, `UserActivity[]{name,initials,role,docsDrafted,aiQueries,costContribution}`.

---

## batch_generation_progress

**1. Config:** Matches baseline exactly.

**2. Layout:** Fixed left sidebar + top nav + breadcrumb header + a 12-col bento: 8-col **progress card** (left) with an embedded per-item list, 4-col **sidebar stack** (reassurance card + generation log + quick actions). Sticky glass bottom bar.

**3. Distinctive patterns — batch/queue status vocabulary (Ready / Drafting / Queued):**
```html
<div class="flex justify-between items-center mb-stack-md">
  <div class="flex items-center gap-2">
    <span class="font-headline-md text-headline-md text-primary">60% Complete</span>
    <span class="animate-pulse-slow font-label-sm text-label-sm px-2 py-0.5 bg-secondary-container text-on-secondary-container rounded-full">ACTIVE DRAFTING</span>
  </div>
  <span class="font-label-md text-label-md text-on-surface-variant">12 of 20 finalized</span>
</div>
<div class="w-full h-3 bg-surface-container-highest rounded-full overflow-hidden mb-stack-lg">
  <div class="progress-bar-fill h-full bg-primary" style="width: 60%;"></div>
</div>
```
Per-row status renders three ways: **Ready** = `check_circle` (secondary, filled) + "Open Draft" link; **Drafting** = CSS spinner (`border-2 border-outline-variant border-t-primary rounded-full animate-spin`) + "Processing..." (`cursor-not-allowed`); **Queued** = `schedule` icon + whole row at `opacity-60` + "Waiting". Sidebar: dark reassurance card (`bg-primary-container`, nested `bg-white/5` info box), a **vertical-line activity log** (timestamp + description pairs, dot markers), and stacked Quick Action buttons. Sticky footer: `sync` icon with an injected `spin-slow` keyframe (8s) + "Running in background: Batch #4992-G" + "Network Status: Secured (SSL)".

**4. Icons:** business_center, saved_search, description, inventory_2, settings, auto_awesome, contact_support, notifications, help_outline, chevron_right, check_circle, schedule, expand_more, security, info, sync.

**5. Copy:** "Generating 20 documents...", "You can safely close this window; the process will continue in the background.", "Digital Stationery Standards", "High-Grade Archival protocol", "Cancel Remainder".

**6. Data shape:** `BatchJob {id, totalCount, completedCount, etaMinutes, items:[{matterName, refNumber, status: ready|drafting|queued, draftUrl?}], log:[{timestamp, message}]}`.

---

## settings_firm_profile

**1. Config:** Matches baseline exactly. **Notable:** this is the only file in the set that actually applies `dark:` variant classes throughout the header/sidebar (`dark:bg-surface`, `dark:text-primary-fixed`, `dark:bg-tertiary-container`, `dark:bg-primary-container`, `dark:border-outline`, `dark:hover:bg-primary-container/50`) even though `darkMode:"class"` is declared identically in every file — everywhere else it's declared but unused. Also: this screen keeps the standard "Docket" logo + Dashboard/Matters/Documents/Reports top nav and puts the settings sub-nav (Workspace/Members/Billing/Viki AI Settings/Security) in the **left sidebar** — a different IA from `usage_billing_dashboard`, which puts "Settings" in the logo slot and a Profile/Firm Details/Usage & Billing/Integrations sub-nav in the **top header**. Flag for reconciliation before building the real Settings IA.

**2. Layout:** Top nav + settings-scoped left sidebar + 2-column main (form column + sticky live-preview column). Hidden-by-default mobile bottom nav bar included in markup.

**3. Distinctive patterns — brand/stationery configuration:**
```html
<div class="flex items-center justify-between gap-stack-md border-b border-outline-variant/30 pb-stack-md">
  <div><h3 class="font-label-md text-label-md">Firm Logo</h3><p class="text-label-sm text-on-surface-variant">Vector SVG or high-res PNG (min 400x400px)</p></div>
  <button class="px-stack-md py-unit border border-primary font-label-md text-label-md hover:bg-primary hover:text-on-primary transition-all rounded">UPLOAD</button>
</div>
```
**Live letterhead preview** (sticky aside): A4-aspect (`aspect-[1/1.414]`) white card, 4px top color bar, logo+address header, `.ink-divider` gradient rule, skeleton content bars (`opacity-40/20` grey blocks standing in for body text), footer with ref number + phone/email, and a diagonal 3%-opacity rotated watermark of the firm name. First appearance of a **mobile bottom tab bar** (`md:hidden`, Home/Settings icons+labels) — foreshadows the two dedicated mobile screens.

**4. Icons:** account_balance, groups, payments, auto_awesome, security, contact_support, logout, notifications, help_outline, dashboard, settings.

**5. Copy:** "Firm Profile", "Configure your professional identity and stationery assets for formal correspondence.", "TAX IDENTIFICATION (GSTIN)", "Digital Seal", "Standard A4 Letterhead Projection".

**6. Data shape:** `FirmProfile {name, jurisdiction, gstin, logoUrl, sealUrl, letterheadAddress, letterheadPhone, letterheadEmail}`.

---

## global_states_empty_loading

**1. Config:** Matches baseline exactly. This is a pure states showcase — no real app chrome logic, just a bento of 5 example panels.

**2. Layout:** Top nav + fixed left sidebar + a 2-col bento gallery: Empty state, Loading state, Error state (spans both columns), a testimonial tile, and a status-summary tile. Global FAB.

**3. Distinctive patterns — THE reference for empty/loading/error vocabulary (all new):**
- **Empty state**: fake "window chrome" card header (label + 3 decorative dots) → centered thin-weight icon in a hover-expanding ring (`scale-0 group-hover:scale-100`) → heading + body → a **text-link CTA**, not a button: `<button class="inline-flex items-center gap-2 text-secondary ... hover:gap-3"><span class="material-symbols-outlined text-sm">add</span><span class="border-b border-secondary/30 pb-0.5">INITIALIZE NEW MATTER</span></button>`.
- **Loading state**: "VIKI AI / Synthesizing Brief..." + "Step N of 4" counter, a 1px **indeterminate sliding-highlight line** (`@keyframes lineExpand` — width 0→100%→0 while sliding right, a third distinct loading-indicator style vs. the shimmer/progress-bar patterns elsewhere) above `opacity-40` skeleton rows.
- **Error state** (2-col span): "DISCONNECTED" status pill (dot + label) in the card header; big ringed icon (`cloud_off` in an error-toned circle) with an **overlapping badge** (`priority_high` in `bg-error-container`, `-top-1 -right-1`); two CTAs — primary "Re-establish Connection" (`refresh` icon) + ghost "View Offline Workspace"; footnote "Error Code: E-503 (Server Congestion at Registry)". JS swaps button content to a spinning `autorenew` + "Attempting..." for 2s on click.
- Testimonial tile: eyebrow label, large serif pull-quote, avatar+name+role footer — a reusable "trust" bento tile.
- Status-summary tile: big rotated ghost icon top-right, colored status dot + heading, `<ul>` of label/value rows with `border-b` dividers (STABLE / 99.9% / IDLE), full-width white-outline "Download Audit Certificate" button.

**4. Icons:** business_center, saved_search, description, inventory_2, settings, auto_awesome, contact_support, logout, notifications, help_outline, account_balance_wallet, add, lock, cloud_off, priority_high, refresh, verified_user, autorenew.

**5. Copy:** "No Active Matter Files", "INITIALIZE NEW MATTER", "Temporary Connection Interruption", "Your local drafts remain securely cached in the current session.", "Precision in practice is the hallmark of legal excellence."

**6. Data shape:** No persistent entity — this is a pure UI-state reference: `EmptyState{icon,heading,body,ctaLabel}`, `LoadingState{agentLabel,stepCurrent,stepTotal,statusText}`, `ErrorState{title,body,errorCode,retryLabel,fallbackLabel}`.

---

## print_export_view_authoritative

**1. Config:** Matches baseline exactly. Adds the **only `@media print` block** in the set: `.no-print{display:none!important}`, forces white background, strips shadow/border/margin from `.a4-page` for print.

**2. Layout:** Desktop top nav (`.no-print`) + a single centered **A4 page simulation** + a floating pill toolbar (bottom, print/export actions) + a floating vertical icon rail (right edge, contextual tools). Not a mobile screen despite covering "export."

**3. Distinctive patterns — the authoritative/print-ready document shell:**
```html
<article class="a4-page mx-auto"> <!-- width:210mm; min-height:297mm; padding:25mm; box-shadow -->
  <div class="flex justify-between items-start border-b-2 border-primary-container pb-stack-md mb-stack-lg">
    <div class="font-headline-md text-headline-md text-primary flex items-center gap-unit">
      <span class="material-symbols-outlined text-secondary" style="font-variation-settings:'FILL' 1;">balance</span> CHAMBERS OF S. RAO
    </div>
    <div class="text-right text-on-surface-variant font-label-sm text-label-sm"><p>12/A Shanti Niketan, New Delhi - 110021</p></div>
  </div>
  ...
  <div class="absolute bottom-8 right-8">
    <div class="w-24 h-24 border-2 border-primary/20 rounded-full flex items-center justify-center rotate-12 opacity-40">
      <div class="text-[10px] text-center font-label-md leading-none"><p>OFFICIALLY FILED</p><p class="my-1">DOCKET SYSTEM</p><p>ID: 992-88-A</p></div>
    </div>
  </div>
</article>
```
Rotated circular "OFFICIALLY FILED / DOCKET SYSTEM / ID" stamp motif (unique to this screen — the closest thing to a notarization seal). `clause-number` inline style class (bold, primary) with JS hover-highlight of the parent row. **Floating pill toolbar**: `bg-primary rounded-full ... backdrop-blur-md`, Print/PDF/DOCX grouped with `1px` on-primary/20 dividers + a trailing `share` icon button; `onclick="window.print()"` wired for real. **Floating vertical icon rail** (right edge): 3 square white cards (Annotations/Clause Library/Compare Versions), independent of the toolbar.

**4. Icons:** notifications, help_outline, edit, balance, print, picture_as_pdf, description, share, history_edu, library_books, difference, chevron_right.

**5. Copy:** "CHAMBERS OF S. RAO — Advocates & Solicitors | Supreme Court of India", "MASTER SERVICE AGREEMENT", "ARTICLE 1: DEFINITIONS AND INTERPRETATION", "OFFICIALLY FILED".

**6. Data shape:** `Document{firmLetterhead:{name,tagline,address,contact}, title, dateExecuted, articles:[{title,clauses:[{number,text}]}], signatories:[{party,title}], filingStamp:{id}}`.

---

## document_workspace_mobile

**1. Config:** Matches baseline exactly.

**2. Layout:** Mobile-only single column: compact header (back arrow + stacked title) → scrollable document canvas → a **notched bottom action bar with a raised center FAB** → three bottom-sheet drawers (Outline / Comments / Viki AI) → a centered export modal. No sidebar at any point.

**3. Distinctive patterns — mobile drawer system (new to this doc):**
```html
<nav class="fixed bottom-0 left-0 right-0 z-50 bg-primary-container text-on-primary-container h-20 px-4 sm:px-12 flex items-center justify-between rounded-t-xl ink-shadow">
  <button class="flex flex-col items-center gap-1 group" onclick="togglePanel('outline')">...Outline</button>
  <button class="flex flex-col items-center gap-1 group relative" onclick="togglePanel('comments')">
    <span class="material-symbols-outlined text-on-primary-container">chat_bubble</span>
    <span class="absolute top-1 right-2 w-2 h-2 bg-secondary rounded-full border border-primary-container"></span>
  </button>
  <button class="relative -top-6 bg-secondary text-on-secondary-fixed p-4 rounded-full shadow-2xl ring-4 ring-background" onclick="togglePanel('viki')">
    <span class="material-symbols-outlined text-3xl" style="font-variation-settings:'FILL' 1;">auto_awesome</span>
  </button>
  ...Annotate / History
</nav>
<div class="fixed bottom-0 left-0 right-0 bg-surface h-[618px] z-[70] rounded-t-3xl translate-y-full drawer-transition p-8 overflow-y-auto" id="panel-outline">
  <div class="w-12 h-1 bg-outline-variant rounded-full mx-auto mb-8"></div> <!-- drag handle -->
```
`togglePanel()`/`closeAllPanels()` slide drawers via `translate-y-full` ↔ `translate-y-0` behind a `bg-black/40 backdrop-blur-sm` scrim. Viki drawer is dark-themed (`bg-primary-container`), with suggested-action pill chips ("Summarize Factum", "Find Contradictions", "Verify Citations"), a chat bubble, and a rounded input+send button. Document body uses a **drop-cap first letter** (`first-letter:text-5xl first-letter:float-left`) and a right-aligned pull-quote block (`border-l-4 border-primary`, citation line). Export is a **centered modal** (not a drawer) listing PDF/DOCX/Secure-Link as tappable rows with trailing download/copy icons.

**4. Icons:** arrow_back, share, more_vert, format_list_bulleted, chat_bubble, auto_awesome, edit_square, history, picture_as_pdf, description, link, download, content_copy, send.

**5. Copy:** "S.R. v Union of India", "IN THE SUPREME COURT OF INDIA", "3 UNRESOLVED" (comments badge), "Ask Viki to analyze this draft...", "PDF (Court Ready)", "Secure Access Link".

**6. Data shape:** Same document/comment/Viki-suggestion shapes as desktop, reframed for a single active-panel mobile UI: `activePanel: null|outline|comments|viki`, `commentsUnresolvedCount`.

---

## documents_dashboard_mobile

**1. Config:** Matches baseline exactly.

**2. Layout:** Mobile single column: minimal header (logo + bell + avatar, no nav links) → search + horizontal filter-chip row → stacked full-width document cards → one bento info card → a 5-item bottom tab bar → FAB. This is the mobile counterpart to the desktop `documents_dashboard` grid, now a vertical list.

**3. Distinctive patterns — mobile list card + bottom tab bar:**
```html
<div class="bg-surface border border-outline-variant p-5 rounded-lg ink-shadow active:scale-[0.98] transition-transform">
  <div class="flex justify-between items-start mb-3">
    <span class="px-2 py-0.5 bg-secondary-container text-on-secondary-container rounded font-label-sm text-label-sm uppercase">Pending Review</span>
    <span class="material-symbols-outlined text-on-surface-variant">more_vert</span>
  </div>
  <h3 class="font-headline-md text-headline-md text-primary mb-1">M/S Infrastructure Ltd vs. Union of India</h3>
  <p class="font-body-md text-on-surface-variant mb-4">Writ Petition No. 442 of 2024 • Supreme Court</p>
  <div class="flex items-center gap-4 text-on-surface-variant">
    <div class="flex items-center gap-1.5"><span class="material-symbols-outlined text-[16px]">history</span><span class="font-label-sm text-label-sm">Modified 2h ago</span></div>
    <div class="flex items-center gap-1.5"><span class="material-symbols-outlined text-[16px]">attachment</span><span class="font-label-sm text-label-sm">12 Files</span></div>
  </div>
</div>
```
Status badge color mapping on this screen: Pending Review = `bg-secondary-container`, Draft = `bg-surface-container-highest` (neutral), Finalized = `bg-primary-container` (dark) — a *third* status-color scheme, distinct from both the dot+label scheme in `documents_dashboard` (amber/blue/emerald) and the mobile workspace's plain badges; worth reconciling in the cross-cutting section. Metadata row is an extensible icon+text pair pattern (history/attachment/person/verified). **Bottom tab bar** (5 items, active tab gets `border-t-2 border-primary` + filled icon variant + bold label) + **brass-gradient FAB** (`linear-gradient(135deg,#9A7B4F,#755a31)` — the only gradient-filled FAB in the set, others are solid `bg-primary`) that hides on scroll-down/shows on scroll-up via JS.

**4. Icons:** notifications, search, history, attachment, person, verified, more_vert, add, dashboard, gavel, description, auto_awesome, settings.

**5. Copy:** "Search Documents, Cases, or Statues..." (typo: "Statues" for "Statutes" — flag for copy QA), "Active Matters", "82% Capacity Reached", "Upgrade Vault", "E-Signed".

**6. Data shape:** Same `Document{title, matterRef, status, updatedAt, fileCount|sharedWith|signed}` as desktop dashboard, plus `StorageStatus{usedGb, totalGb}`.

---

## Cross-cutting component library

### Button variants (exact class recipes observed)

| Variant | Recipe | Seen in |
|---|---|---|
| **Primary (solid)** | `bg-primary text-on-primary px-6 py-3 rounded[-lg] hover:opacity-90` (sometimes `hover:bg-primary-container` or `hover:bg-primary/90`) | nearly every screen (New Matter, Save, Send, Generate Document, Re-establish Connection) |
| **Primary uppercase-tracked** | adds `uppercase tracking-widest/wider` to the above | template_editor_edit_create ("Save and Finalize"), print_export ("PRINT" toolbar labels) |
| **Secondary/brass solid** | `.brass-button{background:#755a31;color:#fff}` + `hover{background:#5b421c;translateY(-1px)}`, or plain `bg-secondary text-on-primary` | templates_gallery, activity_feed footer ("Apply All Proposed") |
| **Outline primary** | `border border-primary text-primary hover:bg-primary hover:text-on-primary` | template_detail (variant), settings_firm_profile ("UPLOAD") |
| **Outline secondary** | `border border-secondary text-secondary hover:bg-secondary-container/10` (or `hover:bg-secondary/5`) | upload_analyze_draft_intake, template_detail_read_only, global_states retry |
| **Outline neutral/ghost** | `border border-outline-variant text-on-surface-variant hover:bg-surface-container-high` | usage_billing ("View Invoices"), sharing_roles_modal ("Cancel") |
| **Text/link CTA** | no border/fill — `text-secondary hover:underline` or icon + `border-b border-secondary/30` underline-on-text | global_states empty state ("INITIALIZE NEW MATTER"), version_history ("+ Show all...") |
| **Danger/destructive** | `text-error hover:underline opacity-70 hover:opacity-100` (text-only) or `bg-error-container text-on-error-container hover:bg-error hover:text-on-error` (filled, for Stop actions) | template_editor ("Delete Template"), viki_agent_run_active ("Stop") |
| **Icon-only button** | `p-1.5/2 border border-outline text-outline rounded hover:bg-surface-container` or borderless `material-symbols-outlined text-on-surface-variant hover:text-primary` | universal (more_vert, notifications, help) |
| **Pill/segmented (filter or tab)** | inactive `px-4 py-1.5 rounded-full bg-surface-container(-high) text-on-surface-variant`; active `bg-primary text-on-primary` or `.active-pill{bg:#1c2530;color:#fff}` | documents_dashboard, templates_gallery, documents_dashboard_mobile |
| **FAB** | `w-12..14 h-12..14 bg-primary text-on-primary rounded-full shadow-xl/2xl hover:scale-105/110` — one file uses a **gradient** FAB instead (`brass-gradient`) | templates_gallery, global_states, documents_dashboard_mobile (gradient variant) |

### Badge / chip / status-color mapping

Three **different, inconsistent** status-color systems exist across the set — worth unifying before build:

1. **Dot + label (documents_dashboard desktop)**: `<span class="w-2 h-2 rounded-full bg-{color}"></span> {Label}` — amber-400 = Draft, blue-500 = In Review, emerald-500 = Final. Uses raw Tailwind palette colors, not design tokens.
2. **Filled badge chip (documents_dashboard_mobile, usage_billing plan badge)**: `px-2 py-0.5 rounded text-[10-11px] uppercase` — Pending Review = `bg-secondary-container text-on-secondary-container`, Draft = `bg-surface-container-highest text-on-surface-variant` (neutral), Finalized = `bg-primary-container text-on-primary-container` (dark navy, reads as "success/done" here even though primary-container is used for many other "emphasis" purposes elsewhere).
3. **Ad-hoc inline hex badges (audit_trail_compliance only)**: Agent Run = `#E8F1F8`/`#1E4D7B` (blue), Accepted = `#E7F3E8`/`#2E5B31` (green), Rollback = `#FDE8E8`/`#9B2C2C` (rose/red), Access Log = token-based neutral.

Other recurring chip uses: **AUTO/MANUAL/MILESTONE** version tags (version_history_diff) — AUTO & MILESTONE both `bg-secondary-container`, MANUAL `bg-surface-container-highest`. **Category tags** on document/template cards — highlighted category = `bg-secondary-fixed text-on-secondary-fixed-variant` or `bg-tertiary-fixed text-on-tertiary-fixed-variant`, ordinary category = `bg-surface-container-highest text-on-surface-variant`. **"SYSTEM PRESET" / "ACTIVE DRAFTING" / "HIGH PRIORITY"** pill badges all reuse `bg-secondary-container text-on-secondary-container` or `text-secondary` with a small filled icon.

Recommended unification for build: pick ONE mapping — e.g. amber/`secondary-container` = Draft, blue = In Review/Pending, emerald/`primary-container` = Final/Accepted/Success, error/oxblood = Blocked/Failed/Rollback — and replace the dot-based, badge-based, and raw-hex variants with a single `<StatusBadge status>` component.

### Diff/highlight colors (also inconsistent — 2 competing implementations)
- `activity_feed_ai_proposals`: `.diff-removed{color:#7f1d1d;background:#fef2f2;line-through}` / `.diff-added{color:#065f46;background:#ecfdf5;font-weight:500}`.
- `version_history_diff`: `.diff-removed{color:#991b1b;background:#fee2e2;line-through}` / `.diff-added{color:#065f46;background:#d1fae5}` — also duplicated as unused Tailwind color tokens.
Both are close to Tailwind's stock red-900/emerald-800 on red-50/emerald-50 — should be consolidated into one token pair (e.g. `diff-add-bg/diff-add-text/diff-remove-bg/diff-remove-text`) added properly to the shared config.

### Most-used icons (Material Symbols Outlined)
Structural/nav (near-universal): `notifications`, `help_outline`/`help`, `business_center`, `description`, `settings`, `auto_awesome` (Viki AI — always brand-colored `text-secondary` or filled), `inventory_2`, `saved_search`, `contact_support`, `logout`, `more_vert`, `search`, `chevron_right`/`chevron_left`, `add`.
Status/feedback: `check_circle` (success/ready, usually filled+secondary), `history` (version/activity), `verified`/`verified_user` (citation or signature confidence), `warning`/`block`/`priority_high` (risk states), `schedule` (queued), `lock` (privileged/confidential).
Document/legal-specific: `gavel`, `balance`, `account_balance`, `library_books`, `history_edu`, `difference`, `picture_as_pdf`, `content_copy`, `link`, `attach_file`/`attachment`, `edit_square`, `format_list_bulleted`.
AI-specific: `auto_awesome` (Viki everywhere), `smart_toy` (AI actor in logs), `magic_button` (one CTA), `lightbulb` (tips/suggestions).

### Other reusable primitives worth componentizing
- **Avatar stack** with overflow count: `flex -space-x-2` + `w-8 h-8 rounded-full border-2 border-surface-container-lowest` + trailing `+N` circle.
- **Initials-fallback avatar**: `w-8/10 h-8/10 rounded-full bg-{container} flex items-center justify-center text-[10-14px] font-bold` (e.g., "SR", "AM", "PL") — used everywhere in place of a photo.
- **Progress bar** (3 variants): thin `h-1/1.5` static (seat usage), thick `h-3` with `1.5s cubic-bezier` transition (batch progress), and a fully custom 1px "sliding highlight" indeterminate line (`@keyframes lineExpand`, global_states loading).
- **Timeline/vertical-line list**: `absolute w-[1px] bg-outline-variant` spine + circular node per row — used for version history and generation logs, worth one shared `<Timeline>` component.
- **Bottom sheet drawer** (mobile only): `translate-y-full` ↔ `translate-y-0`, `rounded-t-3xl`, drag-handle bar, backdrop scrim — reusable for Outline/Comments/Viki panels.
- **Variable/placeholder chip**: two competing visual treatments for the same `{{Variable}}` concept — solid pill (`.brass-variable`, template_detail_read_only) vs. dashed-underline chip (`.variable-chip`, template_editor_edit_create) — pick one for build.

---

## Reconciled design decisions (BINDING — overrides any per-screen inconsistency above)

The 20 Stitch mockups each declare their own inline `tailwind.config` and drift from each
other (see deltas noted per-section above). **The real app has ONE shared config**:
`web/tailwind.config.js`. It is the complete, correct union of every token used anywhere in
the mockups, PLUS these additions made to resolve the conflicts this doc found:

- `brass: "#9A7B4F"` — a first-class token now. Use `brass` (not `secondary`) for: Viki's
  brand color/icon (`auto_awesome`), decorative surface fills/highlights, active-tab
  underlines, dashed "in-progress" borders, the seal/stamp motif. Keep `secondary: "#755a31"`
  (the canonical darker umber) for small TEXT/links that need solid AA contrast on paper
  (e.g. "Forgot?", inline text links, label emphasis). Do not override `secondary` in any
  component the way `generate_from_template_multi_mode` did — that was a mockup-only hack.
- `mono: ["JetBrains Mono", ...]` added — use `font-mono` for timestamps, hashes, template
  variable KEY display, and anywhere a mockup used an ad-hoc `mono-font`/`font-mono` class.
- `info: "#1E4D7B"` / `info-container: "#E8F1F8"` and `success` / `success-container`
  (`#2F6F5B` / `#DCEEE7`) added as real tokens — use these instead of any mockup's raw inline
  hex badge colors (`audit_trail_compliance`'s `#E8F1F8`/`#1E4D7B` etc. are now token-backed).
- `diff-added-bg` / `diff-added-text` / `diff-removed-bg` / `diff-removed-text` added — the
  ONE diff palette for the whole app (added/removed text highlighting in the activity feed
  AND version diff view). Do not invent a second palette.

### Status badge — ONE mapping for the whole app (do not reinvent per screen)

Use a shared `<StatusBadge>` (small pill: `px-2 py-0.5 rounded text-[11px] font-label-md
uppercase tracking-tight`) with this fixed color mapping, applied to REAL data (not fictional
mockup statuses):

| Meaning | Classes |
|---|---|
| Draft / staged / queued / pending | `bg-secondary-container text-on-secondary-container` (amber-ish) |
| In review / streaming / drafting / in-progress | `bg-info-container text-info` (blue) |
| Accepted / edited-accepted / success / final / ready | `bg-success-container text-success` (emerald) |
| Rejected / outdated / blocked / failed / rollback | `bg-error-container text-on-error-container` (oxblood) |
| Neutral / system / access-log / role-changed | `bg-surface-container-highest text-on-surface-variant` |

Concrete mappings using our REAL enums:
- `DiffProposal.status`: `staged`→Draft-amber (awaiting review, brass box-shadow accent per
  the existing `.proposal-deco--staged` treatment), `streaming`→In-review-blue (pulsing),
  `accepted`/`edited_accepted`→success-emerald with `check_circle`, `rejected`→neutral (struck
  through, stays visible per invariant #3 — do not hide it), `outdated`→error-oxblood with
  `history` icon.
- `AuditEventDTO.type`: `agent_run_started`/`agent_run_completed`→info-blue with `smart_toy`
  icon (AI actor), `agent_run_interrupted`→neutral, `proposal_accepted`/`edited_accepted`→
  success, `proposal_rejected`/`proposal_outdated`/`citation_blocked`→error, `version_saved`→
  neutral, `version_rollback`→error (destructive-adjacent, matches the mockup), `role_changed`/
  `human_edit_session`→neutral.
- **Document "status" is DERIVED, not stored** — there is no workflow-status field on
  `Document` in the schema (a deliberate simplification, not an oversight). On the dashboard,
  compute: has any `staged`/`streaming` proposals → "In Review" (blue); otherwise → "Draft"
  (amber). Do not fabricate a "Final" state — there is no finalize action in the product yet.

### Variable/placeholder chip — two treatments, kept, given distinct meaning

Both of `template_detail_read_only`'s solid pill and `template_editor_edit_create`'s
dashed-underline chip are kept, but scoped by CONTEXT rather than picked arbitrarily:
- **Read-only rendering** (template preview/detail, generate-panel live preview): solid pill —
  `bg-secondary-container text-on-secondary-container px-1.5 rounded-sm font-semibold`.
- **Editable authoring context** (template editor's variable list/inline chips you can click
  to edit or delete): dashed-underline chip — `bg-brass/15 text-secondary border-b-2
  border-brass px-1 rounded-sm cursor-pointer`.

### Settings information architecture — pick `settings_firm_profile`'s IA

`usage_billing_dashboard` and `settings_firm_profile` disagree on navigation (one replaces the
logo with the word "Settings" and puts a subnav in the top header; the other keeps the
standard Docket top nav and puts a settings-scoped subnav in the LEFT sidebar). **Use
`settings_firm_profile`'s pattern everywhere**: the standard persistent top nav (Docket logo +
Dashboard/Documents/Templates links) stays on screen at all times, and a dedicated left
sidebar (Workspace/Firm Profile, Members, Billing & Usage, Viki AI, Security) scopes the
Settings section. "Usage & Billing" is one item in that same sidebar, not a separate IA.

### Diff-view text (activity feed AND version diff) — one shared treatment
`<span className="line-through bg-diff-removed-bg text-diff-removed-text">...</span>` for
removed text, `<span className="bg-diff-added-bg text-diff-added-text font-medium">...</span>`
for added text. Use this in both the AI-proposal hunk cards and the version-compare view —
do not use two different diff palettes.

### Everything else in this doc is non-binding reference
Layout structure, icon choices, copy tone, and the cross-cutting component library
(button/badge/avatar/progress-bar/timeline recipes) above are the real reference — follow them
closely. Only the specific conflicts resolved in this section override a mockup's own file.
