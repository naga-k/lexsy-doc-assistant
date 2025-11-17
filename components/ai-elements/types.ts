import type { ToolUIPart } from "ai"

/**
 * Some AI SDK higher-level components (e.g., @ai-elements) emit additional
 * intermediate approval states that are not yet part of the base ToolUIPart
 * union. We extend the union locally so our UI components can stay typed.
 */
export type ExtendedToolUIState =
  | ToolUIPart["state"]
  | "approval-requested"
  | "approval-responded"
  | "output-denied"
