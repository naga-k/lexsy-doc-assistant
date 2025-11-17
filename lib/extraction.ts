import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import {
  ExtractedTemplate,
  extractedTemplateSchema,
  placeholderValueTypeSchema,
  normalizeExtractedTemplate,
} from "./types";

export async function extractTemplateFromText(text: string): Promise<ExtractedTemplate> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required for template extraction.");
  }

  const clippedText = text.length > 12000 ? `${text.slice(0, 12000)}\n[...]` : text;

  const { object } = await generateObject({
    model: openai("gpt-5-mini"),
    schema: extractedTemplateSchema,
    system:
      "You transform raw legal template text into structured placeholder metadata used for auto-filling documents. " +
      "Only return valid JSON for the schema provided. Keep keys snake_cased without spaces.",
    prompt: `DOCUMENT TEXT:
"""
${clippedText}
"""

Identify placeholder tokens such as [Company Name], $[_____], {{value}} etc. Build docAst as ordered nodes using either plain text or placeholder references.
For each placeholder infer key, original raw token, example context in <=160 chars, data type (${placeholderValueTypeSchema.options.join(
      ", "
    )}), and if the field is required. Include value=null.`,
  });

  return normalizeExtractedTemplate(object);
}
