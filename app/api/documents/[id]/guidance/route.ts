import { NextResponse } from "next/server";
import { openai } from "@ai-sdk/openai";
import { streamText } from "ai";
import { getDocumentById } from "@/lib/documents";
import type { Placeholder } from "@/lib/types";

export const maxDuration = 30;

const GUIDANCE_LOG_PREFIX = "[guidance]";

const INTRO_SYSTEM_PROMPT = joinPrompt([
  "You are Lexsy, a concise legal drafting co-pilot.",
  "Respond with exactly two short sentences (≤18 words each).",
  "Sentence 1 should greet the user and mention the document title.",
  "Sentence 2 should suggest a field or offer help without mentioning counts or promising to handle anything else.",
]);

const PLACEHOLDER_SYSTEM_PROMPT = joinPrompt([
  "You are Lexsy, a precise legal drafting assistant.",
  "Respond with two short sentences (≤18 words each).",
  "Sentence 1 should request the value using the natural field label and mention if it is required.",
  "Sentence 2 may suggest the expected format or ask for clarification.",
  "Never mention placeholder keys, hashes, progress counts, or say you'll handle the rest.",
]);

type GuidanceVariant = "intro" | "placeholder";

interface GuidanceRequest {
  variant: GuidanceVariant;
  placeholderKey?: string;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = (await request.json()) as GuidanceRequest;
  if (!body || !body.variant) {
    return NextResponse.json({ error: "Missing variant" }, { status: 400 });
  }

  const document = await getDocumentById(id);
  if (!document) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  const template = document.template_json;
  if (!template) {
    return NextResponse.json({ error: "Template not ready" }, { status: 400 });
  }
  const outstandingPlaceholders = template.placeholders.filter((placeholder) => !placeholder.value);

  logGuidanceEvent("request", {
    docId: id,
    variant: body.variant,
    placeholderKey: body.placeholderKey,
    outstandingCount: outstandingPlaceholders.length,
  });

  try {
    if (body.variant === "intro") {
      const stream = await streamIntroText({
        docId: id,
        filename: document.filename,
        outstandingPlaceholders,
      });
      const text = (await stream.text).trim();
      logGuidanceEvent("response", {
        docId: id,
        variant: body.variant,
        text,
        length: text.length,
      });
      return NextResponse.json({ text });
    }

    const placeholder = template.placeholders.find((item) => item.key === body.placeholderKey);
    if (!placeholder) {
      return NextResponse.json({ error: "Placeholder not found" }, { status: 404 });
    }

    const stream = await streamPlaceholderText({
      docId: id,
      filename: document.filename,
      placeholder,
    });
    const text = (await stream.text).trim();
    logGuidanceEvent("response", {
      docId: id,
      variant: body.variant,
      placeholderKey: body.placeholderKey,
      text,
      length: text.length,
    });
    return NextResponse.json({ text });
  } catch (error) {
    console.error("Guidance generation failed", error);
    return NextResponse.json({ error: "Unable to generate guidance" }, { status: 500 });
  }
}

interface IntroPromptConfig {
  docId: string;
  filename: string;
  outstandingPlaceholders: Placeholder[];
}

async function streamIntroText({
  docId,
  filename,
  outstandingPlaceholders,
}: IntroPromptConfig) {
  const cleanedTitle = normalizeFilename(filename);
  const outstandingLabels = outstandingPlaceholders
    .slice(0, 3)
    .map((placeholder) => `- ${sanitizeLabel(placeholder.raw ?? placeholder.key)}`)
    .join("\n") || "- None";

  const prompt = joinPrompt([
    `Document title: ${cleanedTitle}`,
    "Focus fields:",
    outstandingLabels,
    "Response checklist:",
    "- Sentence 1: greet the user and reference the document title.",
    "- Sentence 2: suggest tackling one of the focus fields or offer an alternative next step. Avoid counts or promises like 'I'll handle the rest'.",
  ]);

  logGuidanceEvent("prompt", {
    docId,
    variant: "intro",
    prompt,
    systemPrompt: INTRO_SYSTEM_PROMPT,
  });

  return streamText({
    model: openai("gpt-5-mini"),
    system: INTRO_SYSTEM_PROMPT,
    prompt,
  });
}

interface PlaceholderPromptConfig {
  docId: string;
  filename: string;
  placeholder: Placeholder;
}

async function streamPlaceholderText({
  docId,
  filename,
  placeholder,
}: PlaceholderPromptConfig) {
  const cleanedTitle = normalizeFilename(filename);
  const label = sanitizeLabel(placeholder.raw ?? placeholder.key);
  const context = placeholder.description?.trim();
  const prompt = joinPrompt([
    `Document title: ${cleanedTitle}`,
    `Display label: ${label}`,
    `Short description: ${context ?? "No description"}`,
    `Required: ${placeholder.required ? "Yes" : "No"}`,
    "Response checklist:",
    "- Sentence 1: ask for the specific value with the display label.",
    "- Sentence 2: provide a formatting hint or quick clarification. Do not mention remaining work or say you'll handle it.",
  ]);

  logGuidanceEvent("prompt", {
    docId,
    variant: "placeholder",
    placeholderKey: placeholder.key,
    prompt,
    systemPrompt: PLACEHOLDER_SYSTEM_PROMPT,
    placeholderLabel: label,
    placeholderDescription: placeholder.description ?? null,
    required: placeholder.required ?? false,
  });

  return streamText({
    model: openai("gpt-5-mini"),
    system: PLACEHOLDER_SYSTEM_PROMPT,
    prompt,
  });
}

function normalizeFilename(filename: string): string {
  const withoutExt = filename.replace(/\.[^.]+$/, "");
  const cleaned = withoutExt.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  const tokens = cleaned.split(" ").filter((token) => {
    if (!token) return false;
    // Drop hex/hash-like tokens to avoid overwhelming the UI.
    if (/^[a-f0-9]{16,}$/i.test(token)) {
      return false;
    }
    return true;
  });
  return tokens.join(" ").trim();
}

function sanitizeLabel(value: string | undefined): string {
  if (!value) {
    return "this field";
  }
  return value.replace(/[\[\]{}<>]/g, "").trim();
}

function joinPrompt(lines: ReadonlyArray<string>): string {
  return lines.map((line) => line.trim()).filter(Boolean).join("\n");
}

function logGuidanceEvent(event: string, payload: Record<string, unknown>) {
  console.info(`${GUIDANCE_LOG_PREFIX} ${event}`, payload);
}
