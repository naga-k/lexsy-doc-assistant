import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import {
  ExtractedTemplate,
  Placeholder,
  RawExtractedTemplate,
  extractedTemplateSchema,
  placeholderValueTypeSchema,
  normalizeExtractedTemplate,
} from "./types";

export const MAX_CHUNK_LENGTH = 5000;

export async function extractTemplateFromText(text: string): Promise<ExtractedTemplate> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required for template extraction.");
  }

  const start = Date.now();
  const normalizedText = text.replace(/\r\n/g, "\n").trim();
  if (!normalizedText) {
    console.info("[extractTemplateFromText] Skipped empty document");
    return { docAst: [], placeholders: [] };
  }

  const chunks = chunkDocumentText(normalizedText, MAX_CHUNK_LENGTH);
  console.info(
    `[extractTemplateFromText] Processing ${chunks.length} chunk${chunks.length === 1 ? "" : "s"}`
  );
  const chunkTemplates = await Promise.all(
    chunks.map((chunk, index) => extractChunkTemplate(chunk, index, chunks.length))
  );
  const mergedTemplate = mergeTemplates(chunkTemplates.map(normalizeExtractedTemplate));
  const result = ensureUniquePlaceholderKeys(mergedTemplate);
  const durationMs = Date.now() - start;
  console.info(
    `[extractTemplateFromText] Finished extracting ${result.placeholders.length} placeholder(s) in ${durationMs}ms`
  );
  return result;
}

export async function extractTemplateChunkRange(
  chunks: string[],
  startIndex: number,
  count: number,
  options?: { usageMap?: Map<string, number> }
): Promise<ExtractedTemplate> {
  if (chunks.length === 0) {
    return { docAst: [], placeholders: [] };
  }
  if (startIndex >= chunks.length || count <= 0) {
    return { docAst: [], placeholders: [] };
  }
  const slice = chunks.slice(startIndex, startIndex + count);
  const chunkTemplates = await Promise.all(
    slice.map((chunk, sliceIndex) =>
      extractChunkTemplate(chunk, startIndex + sliceIndex, chunks.length)
    )
  );
  const mergedTemplate = mergeTemplates(chunkTemplates.map(normalizeExtractedTemplate));
  return ensureUniquePlaceholderKeys(mergedTemplate, options?.usageMap);
}

export async function extractTemplateChunksIndividually(
  chunks: string[],
  startIndex: number,
  count: number,
  options?: { usageMap?: Map<string, number> }
): Promise<ExtractedTemplate[]> {
  if (chunks.length === 0 || startIndex >= chunks.length || count <= 0) {
    return [];
  }
  const slice = chunks.slice(startIndex, startIndex + count);
  const chunkTemplates = await Promise.all(
    slice.map((chunk, sliceIndex) =>
      extractChunkTemplate(chunk, startIndex + sliceIndex, chunks.length)
    )
  );
  const normalized = chunkTemplates.map(normalizeExtractedTemplate);
  const usageMap = options?.usageMap;
  return normalized.map((template) => ensureUniquePlaceholderKeys(template, usageMap));
}

export function buildPlaceholderKeyUsage(placeholders: Placeholder[]): Map<string, number> {
  const usage = new Map<string, number>();
  for (const placeholder of placeholders) {
    const key = normalizeKeyCandidate(placeholder.key) || placeholder.key;
    if (!key) continue;
    const current = usage.get(key) ?? 0;
    usage.set(key, current + 1);
  }
  return usage;
}

async function extractChunkTemplate(
  chunk: string,
  chunkIndex: number,
  totalChunks: number
): Promise<RawExtractedTemplate> {
  const header =
    totalChunks > 1 ? `DOCUMENT CHUNK (${chunkIndex + 1}/${totalChunks})` : "DOCUMENT TEXT";
  const { object } = await generateObject({
    model: openai("gpt-5-mini"),
    schema: extractedTemplateSchema,
    system:
      "You transform raw legal template text into structured placeholder metadata used for auto-filling documents. " +
      "Only return valid JSON for the schema provided. Keep keys snake_cased without spaces.",
    prompt: `${header}:
"""
${chunk}
"""

Identify placeholder tokens such as [Company Name], $[_____], {{value}} etc that appear in this chunk. Build docAst as ordered nodes using either plain text or placeholder references.
For each placeholder infer key, original raw token, example context in <=160 chars, data type (${placeholderValueTypeSchema.options.join(
      ", "
    )}), and if the field is required. Include value=null.`,
  });

  return object;
}

export function chunkDocumentText(text: string, chunkSize: number): string[] {
  if (text.length <= chunkSize) {
    return [text];
  }
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + chunkSize, text.length);
    if (end < text.length) {
      const paragraphBreak = text.lastIndexOf("\n\n", end);
      if (paragraphBreak > start + chunkSize / 2) {
        end = paragraphBreak + 2;
      } else {
        const lineBreak = text.lastIndexOf("\n", end);
        if (lineBreak > start + chunkSize / 2) {
          end = lineBreak + 1;
        }
      }
    }
    const chunk = text.slice(start, end);
    if (chunk.trim()) {
      chunks.push(chunk);
    }
    start = end;
  }
  return chunks.length > 0 ? chunks : [text];
}

function mergeTemplates(templates: ExtractedTemplate[]): ExtractedTemplate {
  if (templates.length === 0) {
    return { docAst: [], placeholders: [] };
  }
  if (templates.length === 1) {
    return templates[0];
  }
  return {
    docAst: templates.flatMap((template) => template.docAst),
    placeholders: templates.flatMap((template) => template.placeholders),
  };
}

function ensureUniquePlaceholderKeys(
  template: ExtractedTemplate,
  seedUsage?: Map<string, number>
): ExtractedTemplate {
  const keyUsage = seedUsage ?? new Map<string, number>();
  const keyMap = new Map<string, string>();

  const placeholders = template.placeholders.map((placeholder, index) => {
    const baseKey = buildPlaceholderKey(placeholder, index);
    const uniqueKey = getUniqueKey(baseKey, keyUsage);
    keyMap.set(placeholder.key, uniqueKey);
    return {
      ...placeholder,
      key: uniqueKey,
    };
  });

  const docAst = template.docAst.map((node) => {
    if (node.type !== "placeholder") {
      return node;
    }
    const nextKey = keyMap.get(node.key) ?? node.key;
    return {
      ...node,
      key: nextKey,
    };
  });

  return {
    ...template,
    placeholders,
    docAst,
  };
}

function buildPlaceholderKey(placeholder: Placeholder, index: number): string {
  if (isAnonymousRaw(placeholder.raw)) {
    return `placeholder_${index + 1}`;
  }
  const fromKey = normalizeKeyCandidate(placeholder.key);
  if (fromKey) {
    return fromKey;
  }
  const fromRaw = normalizeKeyCandidate(placeholder.raw);
  if (fromRaw) {
    return fromRaw;
  }
  return `placeholder_${index + 1}`;
}

function normalizeKeyCandidate(value?: string | null): string {
  if (!value) {
    return "";
  }
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return slug;
}

function getUniqueKey(baseKey: string, usage: Map<string, number>): string {
  const current = usage.get(baseKey) ?? 0;
  if (current === 0) {
    usage.set(baseKey, 1);
    return baseKey;
  }
  const next = current + 1;
  usage.set(baseKey, next);
  return `${baseKey}_${next}`;
}

function isAnonymousRaw(raw: string): boolean {
  return /^\s*[\[\(\{«“]?[_\s.-]{2,}[\]\)\}»”]?\s*$/.test(raw);
}
