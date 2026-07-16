import type { Response, NextFunction } from "express";
import { prisma } from "../db.js";
import { can, type Capability, type Role } from "@docket/shared";
import type { AuthedRequest } from "./session.js";

export async function getRole(documentId: string, userId: string): Promise<Role | null> {
  const member = await prisma.documentMember.findUnique({
    where: { documentId_userId: { documentId, userId } },
  });
  return (member?.role as Role) ?? null;
}

/**
 * Enforce a capability server-side (PRD §4.1). Viewers/Commenters cannot
 * accept/reject or run the agent; only Owners manage sharing. `documentId` is
 * read from req.params.id or a resolver.
 */
export function requireCap(cap: Capability, resolveDocId?: (req: AuthedRequest) => Promise<string | undefined> | string | undefined) {
  return async (req: AuthedRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    const documentId = resolveDocId ? await resolveDocId(req) : req.params.id;
    if (!documentId) {
      res.status(400).json({ error: "Missing document id" });
      return;
    }
    const role = await getRole(documentId, req.user.id);
    if (!role) {
      res.status(403).json({ error: "Not a member of this document" });
      return;
    }
    if (!can(role, cap)) {
      res.status(403).json({ error: `Your role (${role}) cannot ${cap}` });
      return;
    }
    (req as AuthedRequest & { role?: Role; documentId?: string }).role = role;
    (req as AuthedRequest & { documentId?: string }).documentId = documentId;
    next();
  };
}
