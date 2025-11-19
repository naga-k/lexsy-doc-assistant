import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import type { ExtractedTemplate } from "./types";

const assignmentsSchema = z.object({
  assignments: z
    .array(
      z.object({
        key: z.string(),
        value: z.string(),
      })
    )
    .default([]),
});

export async function inferAssignmentsFromMessage(
  template: ExtractedTemplate,
  message: string | undefined
): Promise<Record<string, string>> {
  if (!message || !message.trim()) {
    return {};
  }

  const placeholderCatalog = template.placeholders.map((placeholder) => ({
    key: placeholder.key,
    raw: placeholder.raw,
    required: placeholder.required,
    type: placeholder.type,
  }));
  const allowedKeys = new Set(placeholderCatalog.map((item) => item.key));

  const { object } = await generateObject({
    model: openai("gpt-5"),
    schema: assignmentsSchema,
    system:
      "You extract structured placeholder assignments from a user message. " +
      "Return only placeholder keys from the provided list, using concise yet complete values.",
    prompt: `PLACEHOLDERS:
${JSON.stringify(placeholderCatalog, null, 2)}

USER MESSAGE:
${message}

Return assignments only when certain.`,
  });

  const updates: Record<string, string> = {};
  for (const assignment of object.assignments) {
    if (!assignment.key || !allowedKeys.has(assignment.key)) {
      continue;
    }
    const trimmed = assignment.value.trim();
    if (!trimmed) continue;
    updates[assignment.key] = trimmed;
  }
  return updates;
}
