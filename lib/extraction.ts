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
const EXTRACTION_SYSTEM_PROMPT =
  "You are Lexsy's legal template parser. Extract placeholders faithfully, produce the exact JSON required by the schema, never invent tokens, and keep every description under 30 characters.";

const EXTRACTION_OUTPUT_EXAMPLE = `{
  "docAst": [
    { "type": "text", "content": "The Company " },
    { "type": "placeholder", "key": "company_name", "raw": "[Company Name]" }
  ],
  "placeholders": [
    {
      "key": "company_name",
      "raw": "[Company Name]",
      "description": "Issuer name",
      "type": "STRING",
      "required": true,
      "value": null
    }
  ]
}`;
const EXTRACTION_MAX_ATTEMPTS = Math.max(
  1,
  Number(process.env.LEXSY_EXTRACTION_MAX_ATTEMPTS ?? process.env.LEXSY_EXTRACTION_RETRIES ?? "3")
);
const EXTRACTION_RETRY_DELAY_MS = Math.max(
  0,
  Number(process.env.LEXSY_EXTRACTION_RETRY_DELAY_MS ?? "1500")
);

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
    chunks.map((chunk, index) =>
      extractChunkTemplate(chunk, index, chunks.length).then((raw) =>
        attachOriginalRawTokens(normalizeExtractedTemplate(raw), chunk)
      )
    )
  );
  const mergedTemplate = mergeTemplates(chunkTemplates);
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
      extractChunkTemplate(chunk, startIndex + sliceIndex, chunks.length).then((raw) =>
        attachOriginalRawTokens(normalizeExtractedTemplate(raw), chunk)
      )
    )
  );
  const mergedTemplate = mergeTemplates(chunkTemplates);
  return ensureUniquePlaceholderKeys(mergedTemplate, options?.usageMap);
}

export async function extractTemplateChunk(
  chunks: string[],
  chunkIndex: number,
  options?: { usageMap?: Map<string, number> }
): Promise<ExtractedTemplate | null> {
  if (chunks.length === 0 || chunkIndex >= chunks.length || chunkIndex < 0) {
    return null;
  }
  const chunk = chunks[chunkIndex];
  const raw = await extractChunkTemplate(chunk, chunkIndex, chunks.length);
  const normalized = normalizeExtractedTemplate(raw);
  const enriched = attachOriginalRawTokens(normalized, chunk);
  return ensureUniquePlaceholderKeys(enriched, options?.usageMap);
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
  const attemptExtraction = () =>
    generateObject({
      model: openai("gpt-5"),
      schema: extractedTemplateSchema,
      system: EXTRACTION_SYSTEM_PROMPT,
      prompt: buildExtractionPrompt(header, chunk, chunkIndex),
    });
  const { object } = await runExtractionWithRetry(attemptExtraction, chunkIndex, totalChunks);
  return object;
}

function buildExtractionPrompt(header: string, chunk: string, chunkIndex: number): string {
  const chunkLabel = `CHUNK_${chunkIndex + 1}`;
  const placeholderTypes = placeholderValueTypeSchema.options.join(", ");
  return [
    `${header}`,
    "## Document chunk",
    "\"\"\"",
    chunk,
    "\"\"\"",
    "## Task",
    "1. Walk the text sequentially to build docAst nodes (either plain text or placeholder).",
    "2. Whenever a placeholder token appears (e.g. [Company Name], $[_____], {{value}}), add a placeholder node and a matching entry in placeholders.",
    "3. For each placeholder capture: key, raw token, <=30 character human-readable description, data type, required flag, and set value=null.",
    `4. Replace placeholder text in docAst with a unique label following this format: [${chunkLabel}_<slug>_<running_number>].`,
    `   - <slug> should be a concise snake_case summary (e.g. company_name, purchase_amount).`,
    `   - Use a 1-based <running_number> scoped per slug within this chunk.`,
    `   - The placeholder entry's "raw" field must match the exact label inserted into docAst.`,
    "## Output rules",
    "- Keep keys snake_cased with no spaces.",
    "- Description must be concise (<30 chars) and reflect the field purpose.",
    "- If no placeholders exist in this chunk, return docAst with text nodes only and an empty placeholders array.",
    "- Never invent sample values or placeholders not present in the text.",
    `- Valid data types: ${placeholderTypes}.`,
    "## Example output",
    EXTRACTION_OUTPUT_EXAMPLE,
  ].join("\n");
}

async function runExtractionWithRetry<T>(
  task: () => Promise<{ object: T }>,
  chunkIndex: number,
  totalChunks: number
): Promise<{ object: T }> {
  let attempt = 0;
  let lastError: unknown;
  while (attempt < EXTRACTION_MAX_ATTEMPTS) {
    attempt += 1;
    try {
      return await task();
    } catch (error) {
      lastError = error;
      if (attempt < EXTRACTION_MAX_ATTEMPTS) {
        console.warn("[extractTemplateChunk] Retrying chunk", {
          chunkPosition: `${chunkIndex + 1}/${totalChunks}`,
          attempt,
          maxAttempts: EXTRACTION_MAX_ATTEMPTS,
          error: error instanceof Error ? error.message : String(error),
        });
        if (EXTRACTION_RETRY_DELAY_MS > 0) {
          await delay(EXTRACTION_RETRY_DELAY_MS);
        }
      }
    }
  }
  const errorMessage =
    lastError instanceof Error ? lastError.message : "Template extraction failed after retries";
  throw new Error(errorMessage);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

const PLACEHOLDER_TOKEN_PATTERNS: RegExp[] = [
  /\$\[[^\[\]\r\n]{2,}\]/g,
  /\[[^\[\]\r\n]{2,}\]/g,
  /\{\{[^{}\r\n]{2,}\}\}/g,
  /<<[^<>\r\n]{2,}>>/g,
  /_{3,}/g,
];

function attachOriginalRawTokens(template: ExtractedTemplate, chunkText: string): ExtractedTemplate {
  if (!chunkText || template.placeholders.length === 0) {
    return template;
  }
  const candidates = extractOriginalPlaceholderTokens(chunkText);
  if (candidates.length === 0) {
    return template;
  }

  let candidateIndex = 0;
  const placeholders = template.placeholders.map((placeholder) => {
    const existing = placeholder.context?.original_raw;
    if (existing && existing.trim().length > 0) {
      return placeholder;
    }
    const nextToken = candidates[candidateIndex];
    if (!nextToken) {
      return placeholder;
    }
    candidateIndex += 1;
    return {
      ...placeholder,
      context: {
        ...(placeholder.context ?? {}),
        original_raw: nextToken,
      },
    };
  });

  return {
    ...template,
    placeholders,
  };
}

function extractOriginalPlaceholderTokens(text: string): string[] {
  const matches: Array<{ value: string; start: number; end: number }> = [];
  for (const pattern of PLACEHOLDER_TOKEN_PATTERNS) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      const start = match.index ?? text.indexOf(match[0]);
      const end = start + match[0].length;
      matches.push({ value: match[0], start, end });
    }
  }
  if (matches.length === 0) {
    return [];
  }
  matches.sort((a, b) => a.start - b.start);
  const occupied: Array<{ start: number; end: number }> = [];
  const tokens: string[] = [];
  for (const entry of matches) {
    const overlaps = occupied.some((range) => entry.start < range.end && entry.end > range.start);
    if (overlaps) {
      continue;
    }
    occupied.push({ start: entry.start, end: entry.end });
    const cleaned = entry.value.trim();
    if (cleaned.length > 0) {
      tokens.push(cleaned);
    }
  }
  return tokens;
}

function ensureUniquePlaceholderKeys(
  template: ExtractedTemplate,
  seedUsage?: Map<string, number>
): ExtractedTemplate {
  const keyUsage = seedUsage ?? new Map<string, number>();
  const keyMap = new Map<string, string>();
  const placeholderMeta = new Map<
    string,
    { instanceId: string; context: Placeholder["context"]; rawToken: string }
  >();
  let occurrence = 0;

  const placeholders = template.placeholders.map((placeholder, index) => {
    const baseKey = buildPlaceholderKey(placeholder, index);
    const uniqueKey = getUniqueKey(baseKey, keyUsage);
    keyMap.set(placeholder.key, uniqueKey);
    occurrence += 1;
    const instanceId =
      placeholder.instance_id?.trim() ||
      `placeholder_${occurrence.toString().padStart(4, "0")}`;
    const context = {
      ...(placeholder.context ?? {}),
      index: placeholder.context?.index ?? occurrence,
      original_raw: placeholder.context?.original_raw ?? placeholder.raw ?? "",
    };
    const rawToken = `[${uniqueKey.toUpperCase()}]`;
    placeholderMeta.set(uniqueKey, { instanceId, context, rawToken });
    return {
      ...placeholder,
      key: uniqueKey,
      raw: rawToken,
      instance_id: instanceId,
      context,
    };
  });

  const docAst = template.docAst.map((node) => {
    if (node.type !== "placeholder") {
      return node;
    }
    const nextKey = keyMap.get(node.key) ?? node.key;
    const meta = placeholderMeta.get(nextKey);
    return {
      ...node,
      key: nextKey,
      raw: meta?.rawToken ?? `[${nextKey}]`,
      instance_id: meta?.instanceId ?? node.instance_id ?? undefined,
      context: meta?.context ?? node.context ?? undefined,
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
