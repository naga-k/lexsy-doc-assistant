import type { ExtractedTemplate, Placeholder } from "@/lib/types";
import { getPlaceholderDisplayName } from "./placeholder-label";

export interface PlaceholderDescription {
  key: string;
  label: string;
  required: boolean;
  value: string | null;
  description?: string | null;
}

export function buildPlaceholderSummary(template: ExtractedTemplate): string {
  return template.placeholders
    .map((placeholder) => {
      const label = getPlaceholderDisplayName(placeholder);
      const status = placeholder.value
        ? `✅ ${placeholder.value}`
        : placeholder.required
          ? "⚠️ Missing"
          : "Optional";
      return `${label} (key: ${placeholder.key}): ${status}`;
    })
    .join("\n");
}

export function getOutstandingPlaceholders(template: ExtractedTemplate): Placeholder[] {
  return template.placeholders.filter((placeholder) => !placeholder.value);
}

export function describePlaceholder(
  placeholder: Placeholder,
  includeDescription = false
): PlaceholderDescription {
  return {
    key: placeholder.key,
    label: getPlaceholderDisplayName(placeholder),
    required: Boolean(placeholder.required),
    value: placeholder.value ?? null,
    description: includeDescription ? placeholder.description || null : undefined,
  };
}
