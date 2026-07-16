/** Aggregated LLM usage for the "Usage & billing" screen. Never carries prompt/document content. */
export interface UsageDayPoint {
  date: string; // YYYY-MM-DD
  inputTokens: number;
  outputTokens: number;
  calls: number;
}

export interface UsageByKind {
  kind: string;
  calls: number;
  inputTokens: number;
  outputTokens: number;
}

export interface UsageByUser {
  userId: string;
  userName: string;
  calls: number;
  inputTokens: number;
  outputTokens: number;
}

export interface UsageSummary {
  rangeDays: number;
  totals: { calls: number; inputTokens: number; outputTokens: number };
  byDay: UsageDayPoint[];
  byKind: UsageByKind[];
  byUser: UsageByUser[];
  documentsCreated: number;
  agentRuns: number;
}
