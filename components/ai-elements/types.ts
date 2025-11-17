import type { ToolUIPart } from "ai";

// Extend the upstream tool state with approval-specific phases emitted at runtime.
export type ToolState =
  | ToolUIPart["state"]
  | "approval-requested"
  | "approval-responded"
  | "output-denied";
