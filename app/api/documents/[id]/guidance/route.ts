import { NextResponse } from "next/server";
import { openai } from "@ai-sdk/openai";
import { streamText } from "ai";
import { getDocumentById } from "@/lib/documents";
import type { Placeholder } from "@/lib/types";

export const maxDuration = 30;

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
  const outstandingLabels = outstandingPlaceholders.slice(0, 3).map((placeholder) => sanitizeLabel(placeholder.raw ?? placeholder.key));
  const outstandingSummary =
    outstandingLabels.length > 0
      ? `Remaining priority fields: ${outstandingLabels.join(", ")}.`
      : "All placeholders look filled. Offer to review or tighten language.";

  return streamText({
    model: openai("gpt-5-mini"),
    system:
      "You are Lexsy, a concise legal drafting co-pilot. Greet the user warmly, mention the document you are helping with, summarize how many placeholders remain, and invite them to pick the next field. Keep it to 2 sentences.",
    prompt: `Document title: ${cleanedTitle}
Remaining placeholders: ${outstandingCount}
${outstandingSummary}`,
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
  const context = placeholder.exampleContext?.trim();
  const remainingAfter = Math.max(outstandingCount - 1, 0);
  const remainingText =
    remainingAfter > 0 ? `${remainingAfter} field${remainingAfter === 1 ? "" : "s"} left once this is done.` : "This is the last outstanding field.";

  return streamText({
    model: openai("gpt-5-mini"),
    system:
      "You are Lexsy, a focused legal drafting assistant. Encourage the user to provide the requested value, reference why it matters, and end with reassurance about the remaining workload. Use 2 sentences max.",
    prompt: `Document: ${cleanedTitle}
Placeholder: ${label}
Required: ${placeholder.required ? "Yes" : "No"}
Context excerpt: ${context ?? "N/A"}
${remainingText}`,
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
