/**
 * Interactive document intake: a chat-first flow where Viki asks what document
 * the firm needs, matches it against the template library, asks clarifying
 * questions conversationally, and then drafts the full case-personalised
 * document — dropping it into the review pipeline.
 */

export type IntakeState = "thinking" | "searching" | "drafting" | "awaiting_user" | "done";

export type IntakeSSEEvent =
  | { type: "state"; state: IntakeState }
  /** A token of Viki's current message. */
  | { type: "assistant_delta"; text: string }
  /** Viki's completed message; the flow now awaits the user's reply. */
  | { type: "assistant_message"; text: string }
  /** Templates Viki considered relevant (surfaced as suggestion chips). */
  | { type: "template_matches"; templates: IntakeTemplateMatch[] }
  /** A document was drafted and is ready to open in the editor/review pipeline. */
  | {
      type: "document_ready";
      documentId: string;
      title: string;
      personalizationNotes: string[];
      unresolved: string[];
    }
  | { type: "error"; message: string };

export interface IntakeTemplateMatch {
  id: string;
  title: string;
  description: string;
}

export interface IntakeStartResponse {
  sessionId: string;
  /** Viki's opening greeting (canned, no model call). */
  greeting: string;
}

export interface IntakeMessageRequest {
  message: string;
}
