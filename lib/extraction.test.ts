import { describe, it, expect } from "vitest";
import { deduplicatePlaceholderKeys } from "./extraction";
import type { ExtractedTemplate, Placeholder } from "./types";

function createPlaceholder(key: string, instanceId?: string): Placeholder {
  return {
    key,
    raw: `[${key.toUpperCase()}]`,
    description: `Test ${key}`,
    type: "STRING",
    required: true,
    value: null,
    instance_id: instanceId ?? `inst_${key}`,
  };
}

function createTemplate(keys: string[]): ExtractedTemplate {
  const placeholders = keys.map((key, i) => createPlaceholder(key, `inst_${i}`));
  const docAst = keys.flatMap((key, i) => [
    { type: "text" as const, content: `Text before ${key} ` },
    {
      type: "placeholder" as const,
      key,
      raw: `[${key.toUpperCase()}]`,
      instance_id: `inst_${i}`,
    },
  ]);
  return { placeholders, docAst };
}

describe("deduplicatePlaceholderKeys", () => {
  it("should not modify template with unique keys", () => {
    const template = createTemplate(["company_name", "investor_name", "amount"]);

    const result = deduplicatePlaceholderKeys(template);

    expect(result.placeholders.map((p) => p.key)).toEqual([
      "company_name",
      "investor_name",
      "amount",
    ]);
  });

  it("should rename second occurrence of duplicate key", () => {
    const template = createTemplate(["company_name", "investor_name", "company_name"]);

    const result = deduplicatePlaceholderKeys(template);

    expect(result.placeholders.map((p) => p.key)).toEqual([
      "company_name",
      "investor_name",
      "company_name_2",
    ]);
  });

  it("should rename multiple occurrences with incrementing suffixes", () => {
    const template = createTemplate([
      "company_name",
      "company_name",
      "company_name",
      "company_name",
    ]);

    const result = deduplicatePlaceholderKeys(template);

    expect(result.placeholders.map((p) => p.key)).toEqual([
      "company_name",
      "company_name_2",
      "company_name_3",
      "company_name_4",
    ]);
  });

  it("should handle keys that already have numeric suffixes", () => {
    // This is the actual bug case - parallel processing creates duplicates like company_name_2
    const template = createTemplate([
      "company_name_2",
      "investor_name",
      "company_name_2",
    ]);

    const result = deduplicatePlaceholderKeys(template);

    expect(result.placeholders.map((p) => p.key)).toEqual([
      "company_name_2",
      "investor_name",
      "company_name_2_2",
    ]);
  });

  it("should update docAst nodes to match renamed placeholders", () => {
    const template = createTemplate(["company_name", "company_name"]);

    const result = deduplicatePlaceholderKeys(template);

    const placeholderNodes = result.docAst.filter((n) => n.type === "placeholder");
    expect(placeholderNodes.map((n) => n.key)).toEqual(["company_name", "company_name_2"]);
  });

  it("should update raw tokens to match renamed keys", () => {
    const template = createTemplate(["company_name", "company_name"]);

    const result = deduplicatePlaceholderKeys(template);

    expect(result.placeholders[1].raw).toBe("[COMPANY_NAME_2]");

    const placeholderNodes = result.docAst.filter((n) => n.type === "placeholder");
    expect(placeholderNodes[1].raw).toBe("[COMPANY_NAME_2]");
  });
});
