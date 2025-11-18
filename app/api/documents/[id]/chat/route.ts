import { openai } from "@ai-sdk/openai";
import { convertToModelMessages, streamText, tool, type UIMessage } from "ai";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDocumentById, updateTemplateJson } from "@/lib/documents";
import { applyPlaceholderUpdates } from "@/lib/templates";
import { INITIAL_CHAT_INSTRUCTIONS, type ExtractedTemplate, type Placeholder } from "@/lib/types";

export const maxDuration = 60;

interface ChatRequest {
  messages: UIMessage[];
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = (await request.json()) as ChatRequest;
  const messages = body.messages ?? [];
  const modelMessages = convertToModelMessages(
    messages.map(({ id: _discarded, ...rest }) => {
      void _discarded;
      return rest;
    })
  );
  const document = await getDocumentById(id);

  if (!document) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  let updatedTemplate = document.template_json;
  let templateUpdated = false;

  const placeholderSummary = buildPlaceholderSummary(updatedTemplate);
  const outstandingPlaceholders = getOutstandingPlaceholders(updatedTemplate);
  const nextPlaceholder = outstandingPlaceholders[0];
  const nextPlaceholderPrompt = nextPlaceholder
    ? `Next field to focus on: ${nextPlaceholder.key} (${nextPlaceholder.raw}). Ask specific follow-up questions until you have the exact value.`
    : "All placeholders appear filled. Double-check the values and confirm the document is ready.";

  const tools = {
    inspect_placeholder: tool({
      description: "Look up placeholders, their status, and any outstanding work before editing.",
      inputSchema: z.object({
        key: z.string().min(1).describe("Exact placeholder key to inspect").optional(),
        includeExample: z.boolean().default(false).describe("Return the example context when true"),
        outstandingOnly: z
          .boolean()
          .default(true)
          .describe("If true, list only placeholders that still need values."),
        limit: z
          .number()
          .int()
          .min(1)
          .max(10)
          .default(5)
          .describe("Maximum number of placeholders to list at once."),
      }),
      execute: async ({ key, includeExample, outstandingOnly, limit }) => {
        if (key) {
          const placeholder = updatedTemplate.placeholders.find((item) => item.key === key);
          if (!placeholder) {
            return {
              status: "not-found" as const,
              message: `No placeholder exists for key ${key}. Use inspect_placeholder without a key to see available options.`,
              knownKeys: updatedTemplate.placeholders.map((item) => item.key),
            };
          }
          return {
            status: "single" as const,
            placeholder: describePlaceholder(placeholder, includeExample),
            outstandingCount: getOutstandingPlaceholders(updatedTemplate).length,
          };
        }

        const pool = outstandingOnly
          ? getOutstandingPlaceholders(updatedTemplate)
          : updatedTemplate.placeholders;
        const selection = pool.slice(0, limit ?? 5);
        return {
          status: "list" as const,
          placeholders: selection.map((item) => describePlaceholder(item, includeExample)),
          outstandingCount: getOutstandingPlaceholders(updatedTemplate).length,
        };
      },
    }),
    update_placeholder: tool({
      description:
        "Persist an exact placeholder value once the user has confirmed it. Never guess—always confirm before calling.",
      inputSchema: z.object({
        key: z.string().min(1).describe("Existing placeholder key to update."),
        value: z.string().min(1).describe("Final wording to save for the placeholder."),
        reason: z
          .string()
          .optional()
          .describe("Brief reminder of how the value was derived (shared back to the assistant)."),
      }),
      execute: async ({ key, value, reason }) => {
        const trimmedValue = value.trim();
        if (!trimmedValue) {
          return {
            status: "error" as const,
            message: "Value must contain meaningful text before saving.",
            key,
          };
        }

        const placeholder = updatedTemplate.placeholders.find((item) => item.key === key);
        if (!placeholder) {
          return {
            status: "error" as const,
            message: `Unknown placeholder key: ${key}. Call inspect_placeholder to review valid keys before updating.`,
            key,
          };
        }

        if (placeholder.value === trimmedValue) {
          return {
            status: "noop" as const,
            message: "Placeholder already contains this value. No change saved.",
            placeholder: describePlaceholder(placeholder, true),
            outstandingCount: getOutstandingPlaceholders(updatedTemplate).length,
          };
        }

        updatedTemplate = applyPlaceholderUpdates(updatedTemplate, { [key]: trimmedValue });
        await updateTemplateJson(document.id, updatedTemplate);
        templateUpdated = true;

        const refreshed = updatedTemplate.placeholders.find((item) => item.key === key)!;
        return {
          status: "updated" as const,
          placeholder: describePlaceholder(refreshed, true),
          outstandingCount: getOutstandingPlaceholders(updatedTemplate).length,
          summary: buildPlaceholderSummary(updatedTemplate),
          reason,
        };
      },
    }),
  };

  const stream = await streamText({
    model: openai("gpt-5-mini"),
    system: `${INITIAL_CHAT_INSTRUCTIONS}

You are acting as a calm legal co-pilot for founders, investors, and counsel. Guide the user field-by-field: surface what is still missing, ask targeted questions, and only update the document when you have a precise value. Reference clause names and hint at why each detail matters.

Use the provided tools to double-check placeholder details and to persist values. Do not fabricate updates—always call update_placeholder once the user has confirmed the exact wording.

${nextPlaceholderPrompt}

Document placeholder status:
${placeholderSummary}

When you still need information, ask one concise follow-up question. After a field is captured, restate what you filled. When everything is filled, let the user know the document is ready and suggest reviewing the preview.`,
    messages: modelMessages,
    tools,
  });

  return stream.toUIMessageStreamResponse({
    headers: {
      "x-template-updated": templateUpdated ? "1" : "0",
    },
  });
}

function buildPlaceholderSummary(template: ExtractedTemplate): string {
  return template.placeholders
    .map((placeholder) => {
      const status = placeholder.value
        ? `✅ ${placeholder.value}`
        : placeholder.required
          ? "⚠️ Missing"
          : "Optional";
      return `${placeholder.key} (${placeholder.raw}): ${status}`;
    })
    .join("\n");
}

function getOutstandingPlaceholders(template: ExtractedTemplate): Placeholder[] {
  return template.placeholders.filter((placeholder) => !placeholder.value);
}

function describePlaceholder(placeholder: Placeholder, includeExample = false) {
  return {
    key: placeholder.key,
    label: placeholder.raw ?? placeholder.key,
    required: Boolean(placeholder.required),
    value: placeholder.value ?? null,
    example: includeExample ? placeholder.exampleContext || null : undefined,
  };
}
