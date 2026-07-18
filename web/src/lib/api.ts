import type {
  AddCreditsRequest,
  AdminUsageSummary,
  AgentTurnDTO,
  AnalyzeTemplateRequest,
  AuditPage,
  CreateInviteRequest,
  InviteDTO,
  OrganizationDTO,
  OrgMemberDTO,
  SetApiKeyRequest,
  SetDatabaseRequest,
  UpdateMemberRoleRequest,
  UpdateOrgProfileRequest,
  DiffProposal,
  DocumentSummary,
  DraftTemplateRequest,
  GenerateBatchRequest,
  GenerateBatchResult,
  GenerateFromTemplateRequest,
  GenerateResult,
  BatchStatus,
  IntakeStartResponse,
  ProposalActionResult,
  Role,
  SessionUser,
  StartAgentRunRequest,
  StartAgentRunResponse,
  TemplateDTO,
  TemplateSummary,
  UpsertTemplateRequest,
  UsageSummary,
  VersionSummary,
} from "@docket/shared";

export const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

/**
 * Dev shortcut: the contract accepts an `x-user-id` header in addition to the
 * session cookie. We surface it via localStorage so a tester can impersonate
 * without a running auth service. Never carries document content.
 */
function devHeaders(): Record<string, string> {
  const id =
    typeof localStorage !== "undefined" ? localStorage.getItem("docket_dev_user_id") : null;
  return id ? { "x-user-id": id } : {};
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    credentials: "include",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...devHeaders(),
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    let message = `${res.status} ${res.statusText}`;
    try {
      const body = (await res.json()) as { error?: string; message?: string };
      message = body.error ?? body.message ?? message;
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(res.status, message);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// ---- Auth ----
export const authApi = {
  me: () => req<SessionUser>("/api/auth/me"),
  login: (email: string, password: string) =>
    req<SessionUser>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  register: (email: string, name: string, password: string, inviteToken?: string) =>
    req<SessionUser>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, name, password, inviteToken }),
    }),
  logout: () => req<{ ok: true }>("/api/auth/logout", { method: "POST" }),
};

// ---- Documents ----
export const docsApi = {
  list: () => req<DocumentSummary[]>("/api/documents"),
  create: (title: string, kind: DocumentSummary["kind"]) =>
    req<DocumentSummary>("/api/documents", {
      method: "POST",
      body: JSON.stringify({ title, kind }),
    }),
  get: (id: string) =>
    req<{
      summary: DocumentSummary;
      members: { userId: string; name: string; email: string; color: string; role: Role }[];
      /** Non-null for template-generated docs awaiting client-side seeding. */
      initialHtml: string | null;
    }>(`/api/documents/${id}`),
  addMember: (id: string, email: string, role: Role) =>
    req<{ userId: string; name: string; role: Role }>(`/api/documents/${id}/members`, {
      method: "POST",
      body: JSON.stringify({ email, role }),
    }),
  updateMemberRole: (id: string, userId: string, role: Role) =>
    req<{ userId: string; name: string; role: Role }>(`/api/documents/${id}/members/${userId}`, {
      method: "PATCH",
      body: JSON.stringify({ role }),
    }),
  removeMember: (id: string, userId: string) =>
    req<{ ok: true }>(`/api/documents/${id}/members/${userId}`, { method: "DELETE" }),
};

// ---- Proposals ----
export const proposalsApi = {
  list: (docId: string) => req<DiffProposal[]>(`/api/documents/${docId}/proposals`),
  accept: (pid: string) =>
    req<ProposalActionResult>(`/api/proposals/${pid}/accept`, { method: "POST" }),
  reject: (pid: string) =>
    req<ProposalActionResult>(`/api/proposals/${pid}/reject`, { method: "POST" }),
  editAccept: (pid: string, editedText: string) =>
    req<ProposalActionResult>(`/api/proposals/${pid}/edit-accept`, {
      method: "POST",
      body: JSON.stringify({ editedText }),
    }),
  markOutdated: (docId: string, proposalIds: string[]) =>
    req<DiffProposal[]>(`/api/documents/${docId}/mark-outdated`, {
      method: "POST",
      body: JSON.stringify({ proposalIds }),
    }),
};

// ---- Agent runs ----
export const agentApi = {
  start: (docId: string, body: StartAgentRunRequest) =>
    req<StartAgentRunResponse>(`/api/documents/${docId}/agent-runs`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  stop: (runId: string) =>
    req<{ ok: true }>(`/api/agent-runs/${runId}/stop`, { method: "POST" }),
  /** Persistent conversation history for this document (spans separate runs). */
  turns: (docId: string) => req<AgentTurnDTO[]>(`/api/documents/${docId}/agent-turns`),
};

// ---- Versions ----
export const versionsApi = {
  list: (docId: string) => req<VersionSummary[]>(`/api/documents/${docId}/versions`),
  save: (docId: string, name: string) =>
    req<VersionSummary>(`/api/documents/${docId}/versions`, {
      method: "POST",
      body: JSON.stringify({ name }),
    }),
  text: (docId: string, vid: string) =>
    req<{ text: string }>(`/api/documents/${docId}/versions/${vid}/text`),
  diff: (docId: string, from: string, to: string) =>
    req<{ fromText: string; toText: string }>(
      `/api/documents/${docId}/versions/diff?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    ),
  rollback: (docId: string, vid: string) =>
    req<VersionSummary>(`/api/documents/${docId}/versions/${vid}/rollback`, {
      method: "POST",
    }),
};

// ---- Audit ----
export const auditApi = {
  list: (docId: string, opts: { cursor?: string; type?: string } = {}) => {
    const params = new URLSearchParams();
    if (opts.cursor) params.set("cursor", opts.cursor);
    if (opts.type) params.set("type", opts.type);
    const qs = params.toString();
    return req<AuditPage>(`/api/documents/${docId}/audit${qs ? `?${qs}` : ""}`);
  },
};

// ---- Templates (library + generation) ----
export const templatesApi = {
  list: () => req<TemplateSummary[]>("/api/templates"),
  get: (id: string) => req<TemplateDTO>(`/api/templates/${id}`),
  create: (body: UpsertTemplateRequest) =>
    req<TemplateDTO>("/api/templates", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  update: (id: string, body: UpsertTemplateRequest) =>
    req<TemplateDTO>(`/api/templates/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  remove: (id: string) =>
    req<{ ok: true }>(`/api/templates/${id}`, { method: "DELETE" }),
  clone: (id: string) =>
    req<TemplateDTO>(`/api/templates/${id}/clone`, { method: "POST" }),
  analyze: (body: AnalyzeTemplateRequest) =>
    req<TemplateDTO>("/api/templates/analyze", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  /**
   * Real file upload (PDF/DOCX/TXT/MD) — multipart, not JSON, so this bypasses
   * `req()`'s Content-Type: application/json header (the browser sets the
   * correct multipart boundary automatically when body is a FormData).
   */
  analyzeFile: async (file: File, title?: string): Promise<TemplateDTO> => {
    const form = new FormData();
    form.append("file", file);
    if (title) form.append("title", title);
    const res = await fetch(`${API_URL}/api/templates/analyze-file`, {
      method: "POST",
      credentials: "include",
      headers: devHeaders(),
      body: form,
    });
    if (!res.ok) {
      let message = `${res.status} ${res.statusText}`;
      try {
        const body = (await res.json()) as { error?: string; message?: string };
        message = body.error ?? body.message ?? message;
      } catch {
        /* non-JSON error body */
      }
      throw new ApiError(res.status, message);
    }
    return (await res.json()) as TemplateDTO;
  },
  draft: (body: DraftTemplateRequest) =>
    req<TemplateDTO>("/api/templates/draft", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  generate: (id: string, body: GenerateFromTemplateRequest) =>
    req<GenerateResult>(`/api/templates/${id}/generate`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  generateBatch: (id: string, body: GenerateBatchRequest) =>
    req<GenerateBatchResult | { batchId: string }>(`/api/templates/${id}/generate-batch`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
};

// ---- Batches (durable queue — briefs[] generation) ----
export const batchesApi = {
  get: (batchId: string) => req<BatchStatus>(`/api/batches/${batchId}`),
};

// ---- Usage & billing ----
export const usageApi = {
  summary: (days = 30) => req<UsageSummary>(`/api/usage/summary?days=${days}`),
};

// ---- Admin portal (org-admin only) ----
export const adminApi = {
  organization: () => req<OrganizationDTO>("/api/admin/organization"),
  updateOrganization: (body: UpdateOrgProfileRequest) =>
    req<OrganizationDTO>("/api/admin/organization", { method: "PATCH", body: JSON.stringify(body) }),
  setApiKey: (body: SetApiKeyRequest) =>
    req<OrganizationDTO>("/api/admin/organization/api-key", { method: "PUT", body: JSON.stringify(body) }),
  clearApiKey: () => req<OrganizationDTO>("/api/admin/organization/api-key", { method: "DELETE" }),
  setDatabase: (body: SetDatabaseRequest) =>
    req<OrganizationDTO>("/api/admin/organization/database", { method: "PUT", body: JSON.stringify(body) }),
  clearDatabase: () => req<OrganizationDTO>("/api/admin/organization/database", { method: "DELETE" }),
  members: () => req<OrgMemberDTO[]>("/api/admin/members"),
  updateMemberRole: (userId: string, body: UpdateMemberRoleRequest) =>
    req<OrgMemberDTO>(`/api/admin/members/${userId}`, { method: "PATCH", body: JSON.stringify(body) }),
  removeMember: (userId: string) => req<{ ok: true }>(`/api/admin/members/${userId}`, { method: "DELETE" }),
  invites: () => req<InviteDTO[]>("/api/admin/invites"),
  createInvite: (body: CreateInviteRequest) => req<InviteDTO>("/api/admin/invites", { method: "POST", body: JSON.stringify(body) }),
  revokeInvite: (id: string) => req<{ ok: true }>(`/api/admin/invites/${id}`, { method: "DELETE" }),
  addCredits: (body: AddCreditsRequest) => req<OrganizationDTO>("/api/admin/credits", { method: "PUT", body: JSON.stringify(body) }),
  usage: (days = 30) => req<AdminUsageSummary>(`/api/admin/usage?days=${days}`),
};

// ---- Interactive intake (chat-first document creation) ----
export const intakeApi = {
  /** Open a session; returns the id to stream and Viki's canned greeting. */
  start: () => req<IntakeStartResponse>("/api/intake", { method: "POST" }),
  /**
   * Send the user's turn. Viki replies asynchronously over the SSE stream, so
   * this resolves to `{ ok: true }` once accepted — a 409 means Viki is still
   * responding to the previous message.
   */
  sendMessage: (id: string, message: string) =>
    req<{ ok: true }>(`/api/intake/${id}/message`, {
      method: "POST",
      body: JSON.stringify({ message }),
    }),
};

// ---- Export ----
/**
 * Serialize-and-download path: the client posts the live Tiptap HTML and gets
 * back a `.docx` binary. Uses raw fetch (not `req`) because the response is a
 * Blob, not JSON — same base URL + credentials + dev header as the JSON client.
 */
export async function exportDocx(docId: string, html: string, title: string): Promise<Blob> {
  const res = await fetch(`${API_URL}/api/documents/${docId}/export/docx`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...devHeaders(),
    },
    body: JSON.stringify({ html, title }),
  });
  if (!res.ok) {
    let message = `${res.status} ${res.statusText}`;
    try {
      const body = (await res.json()) as { error?: string; message?: string };
      message = body.error ?? body.message ?? message;
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(res.status, message);
  }
  return res.blob();
}

export { devHeaders };
