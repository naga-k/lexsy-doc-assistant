import type { Placeholder } from "@/lib/types";

export function getPlaceholderDisplayName(placeholder: Placeholder | null | undefined): string {
  if (!placeholder) {
    return "this field";
  }
  const source = placeholder.description?.trim() || placeholder.key?.trim() || placeholder.raw?.trim();
  return formatPlaceholderLabel(source);
}

export function formatPlaceholderLabel(value?: string | null): string {
  if (!value) {
    return "this field";
  }
  const cleaned = value
    .replace(/[\[\]{}<>]/g, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) {
    return "this field";
  }
  return cleaned
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

export function getPlaceholderQuestionLabel(placeholder: Placeholder | null | undefined): string {
  const label = getPlaceholderDisplayName(placeholder);
  const stripped = label.replace(/\b\d+\b$/, "").trim();
  if (stripped.length > 0) {
    return stripped;
  }
  return label;
}
