import { openai } from "@ai-sdk/openai";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { NextResponse } from "next/server";
import { getDocumentById, updateTemplateJson } from "@/lib/documents";
import { inferAssignmentsFromMessage } from "@/lib/chat-helpers";
import { applyPlaceholderUpdates } from "@/lib/templates";
import { INITIAL_CHAT_INSTRUCTIONS } from "@/lib/types";

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

  const lastUserMessage = [...messages].reverse().find((message) => message.role === "user");
  const lastUserText = extractTextContent(lastUserMessage);
  const inferredAssignments = await inferAssignmentsFromMessage(
    document.template_json,
    lastUserText
  );

  let updatedTemplate = document.template_json;
  const hasUpdates = Object.keys(inferredAssignments).length > 0;
  if (hasUpdates) {
    updatedTemplate = applyPlaceholderUpdates(document.template_json, inferredAssignments);
    await updateTemplateJson(document.id, updatedTemplate);
  }

  const placeholderSummary = updatedTemplate.placeholders
    .map((placeholder) => {
      const status = placeholder.value ? `✅ ${placeholder.value}` : placeholder.required ? "⚠️ Missing" : "Optional";
      return `${placeholder.key} (${placeholder.raw}): ${status}`;
    })
    .join("\n");

  const outstandingPlaceholders = updatedTemplate.placeholders.filter((placeholder) => !placeholder.value);
  const nextPlaceholder = outstandingPlaceholders[0];
  const nextPlaceholderPrompt = nextPlaceholder
    ? `Next field to focus on: ${nextPlaceholder.key} (${nextPlaceholder.raw}). Ask specific follow-up questions until you have the exact value.`
    : "All placeholders appear filled. Double-check the values and confirm the document is ready.";

  const stream = await streamText({
    model: openai("gpt-5-mini"),
    system: `${INITIAL_CHAT_INSTRUCTIONS}

You are acting as a calm legal co-pilot for founders, investors, and counsel. Guide the user field-by-field: surface what is still missing, ask targeted questions, and only update the document when you have a precise value. Reference clause names and hint at why each detail matters.

${nextPlaceholderPrompt}

Document placeholder status:
${placeholderSummary}

When you still need information, ask one concise follow-up question. After a field is captured, restate what you filled. When everything is filled, let the user know the document is ready and suggest reviewing the preview.`,
    messages: modelMessages,
  });

  return stream.toUIMessageStreamResponse({
    headers: {
      "x-template-updated": hasUpdates ? "1" : "0",
    },
  });
}

function extractTextContent(message: UIMessage | undefined): string | undefined {
  if (!message || !message.parts) {
    return undefined;
  }
  const text = message.parts
    .map((part) => {
      if (part.type === "text" || part.type === "reasoning") {
        return part.text;
      }
      return "";
    })
    .join(" ")
    .trim();
  return text || undefined;
}
