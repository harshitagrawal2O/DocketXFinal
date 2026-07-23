import "../src/loadEnv.js";
import { PrismaClient, Prisma } from "@prisma/client";
import * as Y from "yjs";
import { whenLoaded } from "../src/yjs/docStore.js";
import { appendUpdate } from "../src/yjs/pgPersistence.js";
import { getFragment, snapshotText } from "../src/yjs/mutations.js";
import { flattenFragment, anchorAtOffset, locateText } from "../src/yjs/anchors.js";
import { BUILTIN_TEMPLATES } from "../src/templates/builtin.js";

/**
 * Deterministic seed for local dev + the Phase-5 pilot (docs/pilot-script.md).
 *
 * It creates:
 *  - 3 stub users (owner / editor / commenter) with presence colors;
 *  - one synthetic Indian commercial contract (NO real client data);
 *  - its DocumentMembers;
 *  - 5 mock DiffProposals across 3 agent runs, including a 3-hunk run, a
 *    verified-citation hunk (Indian Contract Act, 1872, s. 73) and a
 *    deliberately BROKEN-citation hunk to exercise the blocked path.
 *
 * Anchors are real serialized Yjs relative positions. The canonical Y.Doc is
 * built on the shared docStore so Postgres persists the same content the WS
 * server serves. Confidentiality: only the synthetic clause text I authored is
 * ever logged — never client data (claude.md invariant #7).
 */

const prisma = new PrismaClient();

// Stable ids so re-running the seed upserts instead of duplicating.
const DOC_ID = "seed-doc-msa-nradia";
const USER_PRIYA = "seed-user-priya";
const USER_ARJUN = "seed-user-arjun";
const USER_MEERA = "seed-user-meera";

const RUN_A = "seed-run-a-terms";
const RUN_B = "seed-run-b-indemnity";
const RUN_C = "seed-run-c-jurisdiction";

const ORG_ID = "seed-org-default";

const SEED_USERS = [
  { id: USER_PRIYA, email: "priya@docket.test", name: "Priya Nair", color: "#4f46e5" },
  { id: USER_ARJUN, email: "arjun@docket.test", name: "Arjun Mehta", color: "#0891b2" },
  { id: USER_MEERA, email: "meera@docket.test", name: "Meera Rao", color: "#db2777" },
];

/** Synthetic contract body. Each string becomes a Tiptap paragraph block. */
const CONTRACT: string[] = [
  "MASTER SERVICES AGREEMENT",
  'This Master Services Agreement ("Agreement") is entered into at Bengaluru, Karnataka, by and between Nradia Technologies Private Limited, a company incorporated under the Companies Act, 2013 ("Service Provider"), and Korefield Analytics LLP ("Client").',
  "1. Term. This Agreement shall commence on the Effective Date and shall remain in force for a period of twelve (12) months, unless terminated earlier in accordance with Clause 6.",
  "2. Consideration. The Client shall pay the Service Provider the fees set out in Schedule A within thirty (30) days of receipt of a valid invoice. Delay in payment shall attract interest at the rate of eighteen percent (18%) per annum.",
  "3. Confidentiality. Each party shall keep confidential all proprietary information disclosed by the other party and shall not use such information for any purpose other than performance under this Agreement.",
  "4. Indemnity. The Service Provider shall indemnify the Client against direct losses arising from a breach of its obligations, subject to the limitations set out in this Clause.",
  "5. Governing Law. This Agreement shall be governed by and construed in accordance with the laws of India, and the courts at Bengaluru shall have exclusive jurisdiction.",
];

type SeedCitation = {
  label: string;
  statute: string;
  section?: string;
  verified: boolean | null;
  verificationNote?: string;
};

interface HunkSpec {
  id: string;
  agentRunId: string;
  hunkIndex: number;
  oldText: string;
  newText: string;
  contextBefore: string;
  contextAfter: string;
  reasoning: string;
  citations: SeedCitation[];
  status: string;
}

const HUNKS: HunkSpec[] = [
  // ---- Run A: a 3-hunk agent run (multi-clause, independent hunks) ----
  {
    id: "seed-prop-a0",
    agentRunId: RUN_A,
    hunkIndex: 0,
    oldText: "for a period of twelve (12) months",
    newText: "for an initial period of twenty-four (24) months",
    contextBefore: "in force ",
    contextAfter: ", unless",
    reasoning: "Client requested a longer committed term; extends the initial period to 24 months.",
    citations: [],
    status: "staged",
  },
  {
    id: "seed-prop-a1",
    agentRunId: RUN_A,
    hunkIndex: 1,
    oldText: "eighteen percent (18%) per annum",
    newText: "twelve percent (12%) per annum",
    contextBefore: "interest at the rate of ",
    contextAfter: ".",
    reasoning:
      "Interest on delayed payment should reflect reasonable compensation for loss rather than a rate a court may read as a penalty.",
    citations: [
      {
        label: "Indian Contract Act, 1872, s. 73",
        statute: "Indian Contract Act, 1872",
        section: "73",
        verified: true,
      },
    ],
    status: "staged",
  },
  {
    id: "seed-prop-a2",
    agentRunId: RUN_A,
    hunkIndex: 2,
    oldText: "for any purpose other than performance under this Agreement",
    newText:
      "for any purpose other than the performance of its obligations under this Agreement, and shall continue to hold such information in confidence for three (3) years following termination",
    contextBefore: "such information ",
    contextAfter: ".",
    reasoning: "Adds a survival period so confidentiality obligations outlast the term.",
    citations: [],
    status: "staged",
  },
  // ---- Run B: single hunk with a BROKEN citation (blocked path) ----
  {
    id: "seed-prop-b0",
    agentRunId: RUN_B,
    hunkIndex: 0,
    oldText: "direct losses arising from a breach of its obligations",
    newText:
      "direct and indirect losses, including consequential and special damages, arising from a breach of its obligations",
    contextBefore: "against ",
    contextAfter: ", subject",
    reasoning:
      "Widens the indemnity to cover consequential damages. Flagged because the supporting citation failed verification.",
    citations: [
      {
        label: "Companies Act, 2013, s. 420",
        statute: "Companies Act, 2013",
        section: "420",
        verified: false,
        verificationNote:
          "Section 420 is a provision of the Indian Penal Code, 1860 (cheating), not the Companies Act, 2013 — the citation could not be verified. Accept is blocked pending a corrected reference.",
      },
    ],
    status: "staged",
  },
  // ---- Run C: single plain-wording hunk, no citation ----
  {
    id: "seed-prop-c0",
    agentRunId: RUN_C,
    hunkIndex: 0,
    oldText: "shall have exclusive jurisdiction",
    newText: "shall have sole and exclusive jurisdiction",
    contextBefore: "at Bengaluru ",
    contextAfter: ".",
    reasoning: "Minor wording tightening for the jurisdiction clause.",
    citations: [],
    status: "staged",
  },
];

async function main(): Promise<void> {
  console.log("[seed] starting Docket v2 seed…");

  // --- 0. Default organization (bootstrap: no databaseUrlEnc, so its tenant
  //        data lives on this SAME database — see schema.prisma's header). ---
  await prisma.organization.upsert({
    where: { id: ORG_ID },
    update: {},
    create: { id: ORG_ID, name: "Docket Seed Firm", slug: "docket-seed-firm" },
  });

  // --- 1. Users (with presence colors for CollaborationCursor) ---
  for (const [i, u] of SEED_USERS.entries()) {
    await prisma.user.upsert({
      where: { id: u.id },
      update: {},
      // Priya (first seed user) is this org's admin; the rest are members.
      // Modeled as a `commenter` document role for Meera: roles.ts gives
      // `viewer` no capabilities, but the pilot needs a reviewer who can
      // comment yet cannot touch hunks — that's a per-document role below,
      // distinct from this org-level admin/member role.
      create: { id: u.id, email: u.email, name: u.name, color: u.color, organizationId: ORG_ID, orgRole: i === 0 ? "admin" : "member" },
    });
  }
  console.log("[seed] users ready: Priya (owner), Arjun (editor), Meera (commenter)");

  // --- 2. Document + members ---
  await prisma.document.upsert({
    where: { id: DOC_ID },
    update: {},
    create: {
      id: DOC_ID,
      title: "Master Services Agreement — Nradia Technologies & Korefield Analytics",
      kind: "contract",
      ownerId: USER_PRIYA,
    },
  });

  const memberRoles: Record<string, string> = {
    [USER_PRIYA]: "owner",
    [USER_ARJUN]: "editor",
    [USER_MEERA]: "commenter",
  };
  for (const u of SEED_USERS) {
    const role = memberRoles[u.id]!;
    await prisma.documentMember.upsert({
      where: { documentId_userId: { documentId: DOC_ID, userId: u.id } },
      update: { role },
      create: { documentId: DOC_ID, userId: u.id, userName: u.name, userEmail: u.email, userColor: u.color, role },
    });
  }
  console.log("[seed] document + 3 members ready");

  // --- 3. Build the canonical Y.Doc on the shared docStore so Postgres
  //        persists the SAME content the WS server will serve. ---
  const doc = await whenLoaded(prisma, DOC_ID);
  const frag = getFragment(doc);
  // Check actual TEXT length, not frag.length (child-node count) — a doc can
  // have paragraph element shells with no text inside them (e.g. left behind
  // by a rollback/edit during dev testing), which frag.length alone can't see.
  const hasRealText = snapshotText(doc).trim().length > 0;
  if (!hasRealText) {
    doc.transact(() => {
      if (frag.length > 0) frag.delete(0, frag.length); // clear empty shells first
      for (const p of CONTRACT) {
        const el = new Y.XmlElement("paragraph");
        frag.insert(frag.length, [el]);
        const leaf = new Y.XmlText();
        el.insert(0, [leaf]);
        leaf.insert(0, p);
      }
    }, "seed");
    console.log(`[seed] built contract Y.Doc (${CONTRACT.length} paragraphs)`);
  } else {
    console.log("[seed] Y.Doc already has content — reusing existing fragment");
  }

  // Flatten AFTER building; anchors are derived from the current content.
  const flat = flattenFragment(frag);

  // --- 4. DiffProposals with real serialized relative anchors ---
  let created = 0;
  for (const h of HUNKS) {
    const loc = locateText(flat.text, h.oldText, h.contextBefore, h.contextAfter);
    if (!loc) throw new Error(`[seed] could not locate clause for ${h.id}: "${h.oldText.slice(0, 32)}…"`);
    const anchorStart = anchorAtOffset(flat, loc.start, 1);
    const anchorEnd = anchorAtOffset(flat, loc.end, -1);
    if (!anchorStart || !anchorEnd) throw new Error(`[seed] anchoring failed for ${h.id}`);

    await prisma.diffProposal.upsert({
      where: { id: h.id },
      update: {},
      create: {
        id: h.id,
        documentId: DOC_ID,
        agentRunId: h.agentRunId,
        anchorStart,
        anchorEnd,
        oldText: h.oldText,
        newText: h.newText,
        reasoning: h.reasoning,
        citations: h.citations as unknown as Prisma.InputJsonValue,
        status: h.status,
        hunkIndex: h.hunkIndex,
      },
    });
    created += 1;
  }
  console.log(`[seed] ${created} DiffProposals ready (run A: 3 hunks, run B: broken-citation, run C: 1 hunk)`);

  // --- 5. A few append-only AuditEvents (non-privileged metadata only) ---
  const auditRows: Array<{
    id: string;
    type: string;
    userId?: string;
    userName?: string;
    agentRunId?: string;
    proposalId?: string;
    detail: Prisma.InputJsonValue;
  }> = [
    {
      id: "seed-audit-a-started",
      type: "agent_run_started",
      userId: USER_ARJUN,
      userName: "Arjun Mehta",
      agentRunId: RUN_A,
      detail: { scope: "document", instruction: "tighten term, interest and confidentiality" },
    },
    {
      id: "seed-audit-a-completed",
      type: "agent_run_completed",
      userId: USER_ARJUN,
      userName: "Arjun Mehta",
      agentRunId: RUN_A,
      detail: { hunks: 3 },
    },
    {
      id: "seed-audit-b-blocked",
      type: "citation_blocked",
      agentRunId: RUN_B,
      proposalId: "seed-prop-b0",
      detail: { statute: "Companies Act, 2013", section: "420", verified: false },
    },
  ];
  for (const a of auditRows) {
    await prisma.auditEvent.upsert({
      where: { id: a.id },
      update: {},
      create: {
        id: a.id,
        documentId: DOC_ID,
        type: a.type,
        userId: a.userId ?? null,
        userName: a.userName ?? null,
        agentRunId: a.agentRunId ?? null,
        proposalId: a.proposalId ?? null,
        detail: a.detail,
      },
    });
  }
  console.log(`[seed] ${auditRows.length} audit events ready`);

  // --- 6. A baseline Version snapshot (gc:false doc → snapshot is valid) ---
  const snapshot = Buffer.from(Y.encodeSnapshotV2(Y.snapshot(doc)));
  await prisma.version.upsert({
    where: { id: "seed-version-baseline" },
    update: {},
    create: {
      id: "seed-version-baseline",
      documentId: DOC_ID,
      name: "Baseline (seed)",
      auto: true,
      snapshot,
      createdByUserId: USER_PRIYA,
      createdByName: "Priya Nair",
    },
  });
  console.log("[seed] baseline version snapshot stored");

  // --- 7. Durably persist the Y.Doc so the WS server serves it after seeding ---
  // (pgPersistence's attachPersistence listener, wired up inside whenLoaded
  // above, already streams every update as it happens — this is just an
  // explicit final write to be certain the full state is captured even if
  // no update event fired during seeding.)
  await appendUpdate(prisma, DOC_ID, Y.encodeStateAsUpdate(doc));
  console.log("[seed] Y.Doc persisted to Postgres");

  // --- 8. Builtin (global) template library ---
  for (const t of BUILTIN_TEMPLATES) {
    await prisma.template.upsert({
      where: { id: t.id },
      update: {
        title: t.title,
        category: t.category,
        kind: t.kind,
        description: t.description,
        bodyHtml: t.bodyHtml,
        variables: t.variables as unknown as Prisma.InputJsonValue,
      },
      create: {
        id: t.id,
        ownerId: null,
        source: "builtin",
        title: t.title,
        category: t.category,
        kind: t.kind,
        description: t.description,
        bodyHtml: t.bodyHtml,
        variables: t.variables as unknown as Prisma.InputJsonValue,
      },
    });
  }
  console.log(`[seed] ${BUILTIN_TEMPLATES.length} builtin templates upserted`);

  console.log("[seed] done.");
}

main()
  .catch((err) => {
    console.error("[seed] failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
