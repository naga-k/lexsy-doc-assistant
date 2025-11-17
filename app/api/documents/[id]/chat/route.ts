import { openai } from "@ai-sdk/openai";
import { convertToCoreMessages, streamText, type UIMessage } from "ai";
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

  const stream = await streamText({
    model: openai("gpt-5-mini"),
    system: `${INITIAL_CHAT_INSTRUCTIONS}

Document placeholder status:
${placeholderSummary}

When you still need information, ask one concise follow-up question. When everything is filled, let the user know the document is ready.`,
    messages: convertToCoreMessages(messages),
  });

  return stream.toTextStreamResponse({
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
