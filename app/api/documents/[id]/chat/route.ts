import { openai } from "@ai-sdk/openai";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { NextResponse } from "next/server";
import { getDocumentById } from "@/lib/documents";
import { INITIAL_CHAT_INSTRUCTIONS } from "@/lib/types";
import { buildPlaceholderSummary, getOutstandingPlaceholders } from "@/lib/chat/template-utils";
import { buildNextPlaceholderPrompt, buildSystemPrompt } from "@/lib/chat/prompt-builder";
import { createPlaceholderTools } from "@/lib/chat/placeholder-tools";

export const maxDuration = 60;

interface ChatRequest {
  messages: UIMessage[];
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = (await request.json()) as ChatRequest;
  const messages = body.messages ?? [];
  const modelMessages = convertToModelMessages(
    messages.map(({ id: _discarded, ...rest }) => {
      void _discarded;
      return rest;
    })
  );
  const document = await getDocumentById(id);

  if (!document) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  const placeholderSummary = buildPlaceholderSummary(document.template_json);
  const outstandingPlaceholders = getOutstandingPlaceholders(document.template_json);
  const nextPlaceholder = outstandingPlaceholders[0];
  const nextPlaceholderPrompt = buildNextPlaceholderPrompt(nextPlaceholder);
  const { tools, hasTemplateUpdates } = createPlaceholderTools({
    documentId: document.id,
    template: document.template_json,
  });
  const systemPrompt = buildSystemPrompt({
    baseInstructions: INITIAL_CHAT_INSTRUCTIONS,
    nextPlaceholderPrompt,
    placeholderSummary,
  });

  const stream = await streamText({
    model: openai("gpt-5-mini"),
    system: systemPrompt,
    messages: modelMessages,
    tools,
  });

  return stream.toUIMessageStreamResponse({
    headers: {
      "x-template-updated": hasTemplateUpdates() ? "1" : "0",
    },
    sendReasoning: true,
  });
}
