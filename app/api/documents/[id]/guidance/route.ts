import { NextResponse } from "next/server";
import { openai } from "@ai-sdk/openai";
import { streamText } from "ai";
import { getDocumentById } from "@/lib/documents";
import type { Placeholder } from "@/lib/types";

export const maxDuration = 30;

const INTRO_SYSTEM_PROMPT =
  "You are Lexsy, a concise legal drafting co-pilot. Use exactly two sentences, reference the document title, report remaining placeholders, and invite the user to pick the next field.";

const PLACEHOLDER_SYSTEM_PROMPT =
  "You are Lexsy, a precise legal drafting assistant. Use two sentences: first, request the value with context; second, reassure the user about remaining work. Always mention whether the field is required.";

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
  const outstandingCount = outstandingPlaceholders.length;

  try {
    if (body.variant === "intro") {
      const stream = await streamIntroText({
        filename: document.filename,
        outstandingCount,
        outstandingPlaceholders,
      });
      const text = (await stream.text).trim();
      return NextResponse.json({ text });
    }

    const placeholder = template.placeholders.find((item) => item.key === body.placeholderKey);
    if (!placeholder) {
      return NextResponse.json({ error: "Placeholder not found" }, { status: 404 });
    }

    const stream = await streamPlaceholderText({
      filename: document.filename,
      outstandingCount,
      placeholder,
    });
    const text = (await stream.text).trim();
    return NextResponse.json({ text });
  } catch (error) {
    console.error("Guidance generation failed", error);
    return NextResponse.json({ error: "Unable to generate guidance" }, { status: 500 });
  }
}

interface IntroPromptConfig {
  filename: string;
  outstandingCount: number;
  outstandingPlaceholders: Placeholder[];
}

async function streamIntroText({
  filename,
  outstandingCount,
  outstandingPlaceholders,
}: IntroPromptConfig) {
  const cleanedTitle = normalizeFilename(filename);
  const outstandingLabels = outstandingPlaceholders
    .slice(0, 3)
    .map((placeholder) => `- ${sanitizeLabel(placeholder.raw ?? placeholder.key)}`)
    .join("\n") || "- None";

  const prompt = [
    `Document title: ${cleanedTitle}`,
    `Outstanding placeholders: ${outstandingCount}`,
    "Focus fields:",
    outstandingLabels,
    "Response checklist:",
    "- Sentence 1: greet the user, reference the document title, and mention progress.",
    "- Sentence 2: suggest tackling one of the focus fields or offer an alternative next step.",
  ].join("\n");

  return streamText({
    model: openai("gpt-5-mini"),
    system: INTRO_SYSTEM_PROMPT,
    prompt,
  });
}

interface PlaceholderPromptConfig {
  filename: string;
  outstandingCount: number;
  placeholder: Placeholder;
}

async function streamPlaceholderText({
  filename,
  outstandingCount,
  placeholder,
}: PlaceholderPromptConfig) {
  const cleanedTitle = normalizeFilename(filename);
  const label = sanitizeLabel(placeholder.raw ?? placeholder.key);
  const context = placeholder.description?.trim();
  const remainingAfter = Math.max(outstandingCount - 1, 0);
  const remainingText =
    remainingAfter > 0 ? `${remainingAfter} field${remainingAfter === 1 ? "" : "s"} left once this is done.` : "This is the last outstanding field.";

  const prompt = [
    `Document title: ${cleanedTitle}`,
    `Placeholder key: ${placeholder.key}`,
    `Display label: ${label}`,
    `Short description: ${context ?? "No description"}`,
    `Required: ${placeholder.required ? "Yes" : "No"}`,
    `Remaining after completion: ${remainingText}`,
    "Response checklist:",
    "- Sentence 1: ask for the specific value, referencing why the description/field matters.",
    "- Sentence 2: acknowledge the remaining workload and reassure the user you'll handle the next steps.",
  ].join("\n");

  return streamText({
    model: openai("gpt-5-mini"),
    system: PLACEHOLDER_SYSTEM_PROMPT,
    prompt,
  });
}

function normalizeFilename(filename: string): string {
  const withoutExt = filename.replace(/\.[^.]+$/, "");
  return withoutExt.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
}

function sanitizeLabel(value: string | undefined): string {
  if (!value) {
    return "this field";
  }
  return value.replace(/[\[\]{}<>]/g, "").trim();
}
