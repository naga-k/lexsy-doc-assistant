import type { Placeholder } from "@/lib/types";

interface BuildSystemPromptOptions {
  baseInstructions: string;
  nextPlaceholderPrompt: string;
  placeholderSummary: string;
}

const CHAT_BEHAVIOR_INSTRUCTIONS = `You are a calm legal co-pilot. Speak plainly, stay under two short sentences, and ask one direct question at a time. Use natural labels instead of placeholder keys or hashes. Only mention why a field matters if the user is unsure.

Use the provided tools to double-check placeholder details and to persist values. Never invent data—call update_placeholder only after the user confirms the exact wording.`;

const FOLLOW_UP_INSTRUCTIONS = `If a value is missing, respond with a single question (<15 words). After saving a value, acknowledge it in one short sentence and move on. When every field is filled, say the document is ready and offer the preview link.`;

export function buildSystemPrompt({
  baseInstructions,
  nextPlaceholderPrompt,
  placeholderSummary,
}: BuildSystemPromptOptions): string {
  return `${baseInstructions}

${CHAT_BEHAVIOR_INSTRUCTIONS}

${nextPlaceholderPrompt}

Document placeholder status:
${placeholderSummary}

${FOLLOW_UP_INSTRUCTIONS}`;
}

export function buildNextPlaceholderPrompt(placeholder: Placeholder | undefined): string {
  if (!placeholder) {
    return "All placeholders appear filled. Double-check the values and confirm the document is ready.";
  }

  const label = placeholder.raw || placeholder.description || placeholder.key;
  return `Next field to focus on: ${label}. Ask exactly one simple question to capture the value.`;
}
