import type { ExtractedTemplate, Placeholder } from "./types";

export function getMissingPlaceholders(template: ExtractedTemplate): Placeholder[] {
  return template.placeholders.filter((ph) => ph.required && !ph.value);
}

export function isTemplateComplete(template: ExtractedTemplate): boolean {
  return template.placeholders.every((ph) => ph.required ? Boolean(ph.value) : true);
}

export function applyPlaceholderUpdates(
  template: ExtractedTemplate,
  updates: Record<string, string | null | undefined>
): ExtractedTemplate {
  const updatedPlaceholders = template.placeholders.map((placeholder) => {
    const update = updates[placeholder.key];
    if (typeof update === "undefined" || update === null || update === "") {
      return placeholder;
    }
    return {
      ...placeholder,
      value: update,
    };
  });

  return {
    ...template,
    placeholders: updatedPlaceholders,
  };
}

export function placeholderMap(template: ExtractedTemplate): Record<string, Placeholder> {
  return template.placeholders.reduce<Record<string, Placeholder>>((map, placeholder) => {
    map[placeholder.key] = placeholder;
    return map;
  }, {});
}

export function getTemplateCompletionRatio(template: ExtractedTemplate | null | undefined): number {
  if (!template) {
    return 0;
  }

  const requiredPlaceholders = template.placeholders.filter((placeholder) => placeholder.required);
  if (requiredPlaceholders.length === 0) {
    return 0;
  }

  const filled = requiredPlaceholders.filter((placeholder) => Boolean(placeholder.value)).length;
  const ratio = Math.round((filled / requiredPlaceholders.length) * 100);

  return Math.max(0, Math.min(100, ratio));
}
