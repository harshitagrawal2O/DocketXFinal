import type { UsageByKind, UsageByUser, UsageDayPoint } from "./usage.js";

/** Org-level role — distinct from the per-document Role in roles.ts. */
export type OrgRole = "admin" | "member";

/**
 * 1 credit = 1000 LLM tokens (input+output combined) — see
 * server/src/agent/usage.ts's recordUsage, which deducts raw tokens from
 * Organization.creditBalanceTokens. This DTO exposes both units: `credits`
 * for the admin-facing UI, `creditBalanceTokens` for anyone who wants the
 * precise raw figure.
 */
export interface OrganizationDTO {
  id: string;
  name: string;
  slug: string;
  hasOwnApiKey: boolean;
  apiKeyHint: string | null;
  hasOwnDatabase: boolean;
  databaseHint: string | null;
  credits: number;
  creditBalanceTokens: number;
}

export interface OrgMemberDTO {
  userId: string;
  name: string;
  email: string;
  color: string;
  orgRole: OrgRole;
}

export interface InviteDTO {
  id: string;
  email: string;
  role: OrgRole;
  token: string;
  acceptedAt: string | null;
  expiresAt: string;
  createdAt: string;
}

export interface CreateInviteRequest {
  email: string;
  role: OrgRole;
}

export interface UpdateOrgProfileRequest {
  name: string;
}

export interface SetApiKeyRequest {
  apiKey: string;
}

export interface SetDatabaseRequest {
  databaseUrl: string;
}

export interface AddCreditsRequest {
  /** In credit units (1 credit = 1000 tokens) — added to the current balance. */
  credits: number;
}

export interface UpdateMemberRoleRequest {
  orgRole: OrgRole;
}

export interface AdminUsageSummary {
  rangeDays: number;
  credits: number;
  creditBalanceTokens: number;
  totals: { calls: number; inputTokens: number; outputTokens: number };
  byDay: UsageDayPoint[];
  byKind: UsageByKind[];
  byUser: UsageByUser[];
}
