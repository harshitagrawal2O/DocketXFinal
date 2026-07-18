import { prisma } from "../db.js";
import { decryptSecret } from "../util/crypto.js";

/**
 * One organization, one Anthropic key: every LLM call in the app resolves
 * its API key through here. An org with its own key (set via the admin
 * portal) uses it — its usage is billed to that key, not shared with any
 * other org. An org without one yet (the bootstrap/default org, or any org
 * that hasn't configured one) falls back to the platform's own
 * ANTHROPIC_API_KEY so the app keeps working out of the box.
 */
export async function resolveAnthropicApiKey(organizationId?: string | null): Promise<string> {
  if (organizationId) {
    try {
      const org = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: { anthropicApiKeyEnc: true },
      });
      if (org?.anthropicApiKeyEnc) return decryptSecret(org.anthropicApiKeyEnc);
    } catch (err) {
      console.warn("[llm] failed to resolve org API key, falling back to the platform key:", (err as Error).message);
    }
  }
  const fallback = process.env.ANTHROPIC_API_KEY;
  if (!fallback) throw new Error("ANTHROPIC_API_KEY is not set");
  return fallback;
}
