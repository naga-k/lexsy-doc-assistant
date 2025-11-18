import type { Placeholder } from "@/lib/types";

interface BuildSystemPromptOptions {
  baseInstructions: string;
  nextPlaceholderPrompt: string;
  placeholderSummary: string;
}

const CHAT_BEHAVIOR_INSTRUCTIONS = `You are acting as a calm legal co-pilot for founders, investors, and counsel. Guide the user field-by-field: surface what is still missing, ask targeted questions, and only update the document when you have a precise value. Reference clause names and hint at why each detail matters.

Use the provided tools to double-check placeholder details and to persist values. Do not fabricate updates—always call update_placeholder once the user has confirmed the exact wording.`;

const FOLLOW_UP_INSTRUCTIONS = `When you still need information, ask one concise follow-up question. After a field is captured, restate what you filled. When everything is filled, let the user know the document is ready and suggest reviewing the preview.`;

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

  return `Next field to focus on: ${placeholder.key} (${placeholder.raw}). Ask specific follow-up questions until you have the exact value.`;
}
