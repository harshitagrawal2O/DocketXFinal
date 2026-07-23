import type { PrismaClient } from "@prisma/client";
import { whenLoaded } from "../../yjs/docStore.js";
import { flattenFragment } from "../../yjs/anchors.js";
import { getFragment } from "../../yjs/mutations.js";

/**
 * Lets Viki look at the firm's OTHER documents — e.g. "match the indemnity
 * clause we used in the Acme NDA". Scoped to documents where SOME member of
 * the caller's organization is a DocumentMember.
 *
 * This does NOT simply query every Document row in `tenantDb` — organizations
 * that haven't set up their own dedicated database (see tenantDb.ts) share
 * the platform's default database, so an unscoped query would return OTHER
 * organizations' documents too. `orgUserIds` (the calling org's own member
 * ids, from auth/org.ts's getOrgUserIds) is what keeps this correctly scoped
 * to "this firm" regardless of physical database layout.
 */

const MAX_RESULTS = 8;
const MAX_READ_CHARS = 8000;
const SNIPPET_CHARS = 280;

export interface DocSearchHit {
  id: string;
  title: string;
  kind: string;
  updatedAt: string;
  snippet: string;
}

async function safeText(tenantDb: PrismaClient, documentId: string): Promise<string> {
  // whenLoaded (not getDoc) — a cross-document read may be this document's
  // FIRST access in this process, and getDoc alone can race the async
  // persistence load and return an empty doc (the same bug fixed for the
  // primary document in this run; see docStore.ts).
  const doc = await whenLoaded(tenantDb, documentId);
  return flattenFragment(getFragment(doc)).text;
}

export async function searchFirmDocuments(
  tenantDb: PrismaClient,
  orgUserIds: string[],
  excludeDocumentId: string,
  query: string,
): Promise<DocSearchHit[]> {
  const memberships = await tenantDb.documentMember.findMany({
    where: { userId: { in: orgUserIds }, documentId: { not: excludeDocumentId } },
    select: { documentId: true },
    distinct: ["documentId"],
  });
  const docIds = memberships.map((m) => m.documentId);
  if (docIds.length === 0) return [];

  const candidates = await tenantDb.document.findMany({
    where: { id: { in: docIds } },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });

  const q = query.trim().toLowerCase();
  const matched = q ? candidates.filter((d) => d.title.toLowerCase().includes(q) || d.kind.toLowerCase().includes(q)) : candidates;
  const pool = (matched.length > 0 ? matched : candidates).slice(0, MAX_RESULTS);

  const hits: DocSearchHit[] = [];
  for (const d of pool) {
    const text = await safeText(tenantDb, d.id);
    hits.push({
      id: d.id,
      title: d.title,
      kind: d.kind,
      updatedAt: d.updatedAt.toISOString(),
      snippet: text.trim().slice(0, SNIPPET_CHARS),
    });
  }
  return hits;
}

export interface DocReadResult {
  title: string;
  text: string;
  truncated: boolean;
}

/** Returns null if the document doesn't exist, or no one in this organization is a member of it. */
export async function readFirmDocument(tenantDb: PrismaClient, orgUserIds: string[], documentId: string): Promise<DocReadResult | null> {
  const membership = await tenantDb.documentMember.findFirst({
    where: { documentId, userId: { in: orgUserIds } },
  });
  if (!membership) return null;
  const doc = await tenantDb.document.findUnique({ where: { id: documentId } });
  if (!doc) return null;

  const full = await safeText(tenantDb, documentId);
  const truncated = full.length > MAX_READ_CHARS;
  return {
    title: doc.title,
    text: truncated ? full.slice(0, MAX_READ_CHARS) : full,
    truncated,
  };
}
