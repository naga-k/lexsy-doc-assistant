import { z } from "zod";

export const placeholderValueTypeSchema = z.enum([
  "STRING",
  "NUMBER",
  "DATE",
  "PERCENT",
  "MONEY",
  "UNKNOWN",
]);

export type PlaceholderValueType = z.infer<typeof placeholderValueTypeSchema>;

const rawTextNodeSchema = z.object({
  type: z.literal("text"),
  content: z.string().optional(),
  text: z.string().optional(),
});

const placeholderContextSchema = z.object({
  index: z.number().optional(),
  chunk_index: z.number().optional(),
  paragraph_index: z.number().optional(),
  surrounding_text: z.string().optional(),
  original_raw: z.string().optional(),
});

const rawPlaceholderNodeSchema = z.object({
  type: z.literal("placeholder"),
  key: z.string(),
  raw: z.string().optional(),
  instance_id: z.string().optional(),
  context: placeholderContextSchema.optional(),
});

export const rawDocAstNodeSchema = z.union([rawTextNodeSchema, rawPlaceholderNodeSchema]);

export type PlaceholderContext = z.infer<typeof placeholderContextSchema>;

export type DocAstNode =
  | {
      type: "text";
      content: string;
    }
  | {
      type: "placeholder";
      key: string;
      raw: string;
      instance_id?: string | null;
      context?: PlaceholderContext | null;
    };

const rawPlaceholderSchema = z.object({
  key: z.string(),
  raw: z.string().optional(),
  description: z.string().optional(),
  type: placeholderValueTypeSchema,
  required: z.boolean().optional(),
  value: z.string().nullable().optional(),
  instance_id: z.string().optional(),
  context: placeholderContextSchema.optional(),
});

export type Placeholder = {
  key: string;
  raw: string;
  description: string;
  type: PlaceholderValueType;
  required: boolean;
  value?: string | null;
  instance_id?: string;
  context?: PlaceholderContext | null;
};

export const extractedTemplateSchema = z.object({
  docAst: z.array(rawDocAstNodeSchema),
  placeholders: z.array(rawPlaceholderSchema),
});

export type RawExtractedTemplate = z.infer<typeof extractedTemplateSchema>;

export interface ExtractedTemplate {
  docAst: DocAstNode[];
  placeholders: Placeholder[];
}

export function normalizeExtractedTemplate(raw: RawExtractedTemplate): ExtractedTemplate {
  return {
    docAst: raw.docAst.map((node) => {
      if (node.type === "text") {
        return {
          type: "text" as const,
          content: sanitizeDocString(node.content ?? node.text ?? ""),
        };
      }
      return {
        type: "placeholder" as const,
        key: node.key,
        raw: sanitizeDocString(node.raw ?? node.key),
      instance_id: node.instance_id ?? undefined,
      context: node.context ?? undefined,
      };
    }),
    placeholders: raw.placeholders.map((placeholder) => ({
      key: placeholder.key,
      raw: sanitizeDocString(placeholder.raw ?? placeholder.key),
      description: sanitizeDescription(placeholder.description ?? ""),
      type: placeholder.type,
      required: placeholder.required ?? true,
      value: placeholder.value ? sanitizeDocString(placeholder.value) : null,
      instance_id: placeholder.instance_id ?? undefined,
      context: placeholder.context ?? undefined,
    })),
  };
}

function sanitizeDocString(value: string): string {
  return value.replace(/\u0000/g, "");
}

function sanitizeDescription(value: string): string {
  const sanitized = sanitizeDocString(value).trim();
  if (!sanitized) {
    return "";
  }
  return sanitized.length > 30 ? sanitized.slice(0, 30) : sanitized;
}

export type DocumentProcessingStatus = "pending" | "processing" | "ready" | "failed";

export interface DocumentRecord {
  id: string;
  filename: string;
  mime_type: string;
  original_blob_url: string;
  filled_blob_url: string | null;
  template_json: ExtractedTemplate;
  created_at: string;
  processing_status: DocumentProcessingStatus;
  processing_progress: number;
  processing_total_chunks: number;
  processing_next_chunk: number;
  processing_error: string | null;
}

export interface InternalDocumentRecord extends DocumentRecord {
  plain_text: string | null;
}

export const INITIAL_CHAT_INSTRUCTIONS =
  "You are Lexsy, an assistant who helps fill legal document placeholders accurately and concisely.";
