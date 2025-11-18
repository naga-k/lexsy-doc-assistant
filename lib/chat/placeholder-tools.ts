import { tool } from "ai";
import { z } from "zod";
import { applyPlaceholderUpdates } from "@/lib/templates";
import { updateTemplateJson } from "@/lib/documents";
import type { DocumentRecord } from "@/lib/types";
import { regenerateDocumentPreview } from "@/lib/document-preview";
import {
  buildPlaceholderSummary,
  describePlaceholder,
  getOutstandingPlaceholders,
  type PlaceholderDescription,
} from "@/lib/chat/template-utils";

interface CreatePlaceholderToolsOptions {
  document: DocumentRecord;
}

interface UpdateResult {
  status: "updated" | "noop" | "error";
  message?: string;
  placeholder?: PlaceholderDescription;
  outstandingCount?: number;
  summary?: string;
  reason?: string;
  key?: string;
}

export function createPlaceholderTools({ document }: CreatePlaceholderToolsOptions) {
  let currentDocument = document;
  let currentTemplate = document.template_json;
  let templateUpdated = false;

  const inspect_placeholder = tool({
    description: "Look up placeholders, their status, and any outstanding work before editing.",
    inputSchema: z.object({
      key: z.string().min(1).describe("Exact placeholder key to inspect").optional(),
      includeDescription: z
        .boolean()
        .default(false)
        .describe("Include the short placeholder description when true."),
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
    execute: async ({ key, includeDescription, outstandingOnly, limit }) => {
      const placeholderPool = outstandingOnly
        ? getOutstandingPlaceholders(currentTemplate)
        : currentTemplate.placeholders;
      const outstandingCount = getOutstandingPlaceholders(currentTemplate).length;

      if (key) {
        const placeholder = currentTemplate.placeholders.find((item) => item.key === key);
        if (!placeholder) {
          return {
            status: "not-found" as const,
            message: `No placeholder exists for key ${key}. Use inspect_placeholder without a key to see available options.`,
            knownKeys: currentTemplate.placeholders.map((item) => item.key),
          };
        }

        return {
          status: "single" as const,
          placeholder: describePlaceholder(placeholder, includeDescription),
          outstandingCount,
        };
      }

      const selection = placeholderPool.slice(0, limit ?? 5);
      return {
        status: "list" as const,
        placeholders: selection.map((item) => describePlaceholder(item, includeDescription)),
        outstandingCount,
      };
    },
  });

  const update_placeholder = tool({
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
    execute: async ({ key, value, reason }): Promise<UpdateResult> => {
      const trimmedValue = value.trim();
      if (!trimmedValue) {
        return {
          status: "error",
          message: "Value must contain meaningful text before saving.",
          key,
        };
      }

      const placeholder = currentTemplate.placeholders.find((item) => item.key === key);
      if (!placeholder) {
        return {
          status: "error",
          message: `Unknown placeholder key: ${key}. Call inspect_placeholder to review valid keys before updating.`,
          key,
        };
      }

      if (placeholder.value === trimmedValue) {
        return {
          status: "noop",
          message: "Placeholder already contains this value. No change saved.",
          placeholder: describePlaceholder(placeholder, true),
          outstandingCount: getOutstandingPlaceholders(currentTemplate).length,
        };
      }

      currentTemplate = applyPlaceholderUpdates(currentTemplate, { [key]: trimmedValue });
      await updateTemplateJson(currentDocument.id, currentTemplate);
      try {
        const refreshed = await regenerateDocumentPreview(currentDocument, currentTemplate);
        if (refreshed) {
          currentDocument = refreshed;
        }
      } catch (previewError) {
        console.error("Failed to refresh SuperDoc preview", previewError);
      }
      templateUpdated = true;

      const refreshed = currentTemplate.placeholders.find((item) => item.key === key)!;
      return {
        status: "updated",
        placeholder: describePlaceholder(refreshed, true),
        outstandingCount: getOutstandingPlaceholders(currentTemplate).length,
        summary: buildPlaceholderSummary(currentTemplate),
        reason,
      };
    },
  });

  return {
    tools: {
      inspect_placeholder,
      update_placeholder,
    },
    hasTemplateUpdates: () => templateUpdated,
    getCurrentTemplate: () => currentTemplate,
  } as const;
}
