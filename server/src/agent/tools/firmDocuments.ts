import { prisma } from "../../db.js";
import { whenLoaded } from "../../yjs/docStore.js";
import { flattenFragment } from "../../yjs/anchors.js";
import { getFragment } from "../../yjs/mutations.js";

/**
 * Lets Viki look at the user's OTHER documents — e.g. "match the indemnity
 * clause we used in the Acme NDA". Scoped strictly to documents this same
 * user already has access to (DocumentMember); there is no firm/workspace
 * concept in this schema, so "other documents in the firm" means "other
 * documents this user can already open," which is the correct access
 * boundary until a real multi-tenant model exists.
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

async function safeText(documentId: string): Promise<string> {
  // whenLoaded (not getDoc) — a cross-document read may be this document's
  // FIRST access in this process, and getDoc alone can race the async
  // leveldb load and return an empty doc (the same bug fixed for the
  // primary document in this run; see docStore.ts).
  const doc = await whenLoaded(documentId);
  return flattenFragment(getFragment(doc)).text;
}

export async function searchFirmDocuments(userId: string, excludeDocumentId: string, query: string): Promise<DocSearchHit[]> {
  const memberships = await prisma.documentMember.findMany({
    where: { userId, documentId: { not: excludeDocumentId } },
    include: { document: true },
    orderBy: { document: { updatedAt: "desc" } },
    take: 50,
  });

  const q = query.trim().toLowerCase();
  const candidates = memberships.map((m) => m.document);
  const matched = q ? candidates.filter((d) => d.title.toLowerCase().includes(q) || d.kind.toLowerCase().includes(q)) : candidates;
  const pool = (matched.length > 0 ? matched : candidates).slice(0, MAX_RESULTS);

  const hits: DocSearchHit[] = [];
  for (const d of pool) {
    const text = await safeText(d.id);
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

/** Returns null if the document doesn't exist or this user has no access to it. */
export async function readFirmDocument(userId: string, documentId: string): Promise<DocReadResult | null> {
  const member = await prisma.documentMember.findUnique({
    where: { documentId_userId: { documentId, userId } },
    include: { document: true },
  });
  if (!member) return null;

  const full = await safeText(documentId);
  const truncated = full.length > MAX_READ_CHARS;
  return {
    title: member.document.title,
    text: truncated ? full.slice(0, MAX_READ_CHARS) : full,
    truncated,
  };
}
