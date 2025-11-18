"use client";

import { Fragment, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import clsx from "clsx";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { ArrowUpRightIcon } from "lucide-react";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message as ChatMessage,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import { Loader } from "@/components/ai-elements/loader";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputSubmit,
  type PromptInputMessage,
} from "@/components/ai-elements/prompt-input";
import type { DocumentRecord, ExtractedTemplate, Placeholder } from "@/lib/types";
import { updateDocumentPlaceholders } from "@/lib/client-documents";
import { SuperDocViewer } from "@/components/superdoc/document-viewer";

export interface UploadCardProps {
  document: DocumentRecord | null;
  uploading: boolean;
  error: string | null;
  onFileSelected: (file: File | null) => void;
  variant?: "default" | "hero";
  showDetails?: boolean;
}

export function UploadCard({
  document,
  uploading,
  error,
  onFileSelected,
  variant = "default",
  showDetails = true,
}: UploadCardProps) {
  const isHero = variant === "hero";
  const containerClasses = clsx(
    isHero
      ? showDetails
        ? "rounded-3xl border border-white/20 bg-gradient-to-br from-white/5 via-white/0 to-white/5 p-6 shadow-[0_25px_60px_rgba(2,6,23,0.65)] backdrop-blur"
        : "p-0"
      : "rounded-2xl border border-slate-200 bg-white p-6 text-slate-900 shadow-sm"
  );
  const headingClass = isHero ? "text-white" : "text-slate-900";
  const bodyClass = isHero ? "text-slate-200" : "text-slate-500";
  const badgeClass = isHero
    ? "rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/80"
    : "rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700";
  const dropzoneClasses = clsx(
    "flex flex-col items-center gap-3 rounded-xl border border-dashed p-5 text-center text-sm",
    showDetails ? "mt-5" : "",
    isHero
      ? "border-white/40 bg-transparent text-slate-200"
      : "border-slate-300 bg-slate-50/60 text-slate-600"
  );
  const browseLabelClasses = clsx(
    "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] transition",
    isHero
      ? "border-white/40 bg-white/10 text-white hover:border-white/70 hover:bg-white/15"
      : "border-slate-400 bg-white text-slate-900 hover:border-slate-500"
  );
  const helperTextClass = isHero ? "text-xs text-slate-300" : "text-xs text-slate-500";
  const uploadingTextClass = isHero ? "text-sm text-indigo-200" : "text-sm text-indigo-600";
  const errorTextClass = isHero ? "text-sm text-rose-200" : "text-sm text-rose-600";

  return (
    <section className={containerClasses}>
      {showDetails ? (
        <div className="flex items-center justify-between">
          <div>
            <h2 className={clsx("text-lg font-semibold", headingClass)}>Upload template</h2>
            <p className={clsx("text-sm", bodyClass)}>
              We store the original template privately and keep formatting intact.
            </p>
          </div>
          {document ? <span className={badgeClass}>{document.filename}</span> : null}
        </div>
      ) : null}
      <div className={dropzoneClasses}>
        <div className="space-y-2">
          <p>Drag & drop a .docx file or</p>
          <label className={browseLabelClasses}>
            browse
            <input
              type="file"
              accept=".docx"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                onFileSelected(file);
                event.target.value = "";
              }}
            />
          </label>
        </div>
        <p className={helperTextClass}>
          Supported format: Microsoft Word .docx.
        </p>
        {uploading ? <p className={uploadingTextClass}>Uploading and extracting placeholders…</p> : null}
        {error ? <p className={errorTextClass}>{error}</p> : null}
      </div>
    </section>
  );
}

export interface ChatPanelProps {
  document: DocumentRecord | null;
  onTemplateUpdated: () => void;
  className?: string;
}

export function ChatPanel({ document, onTemplateUpdated, className }: ChatPanelProps) {
  return (
    <section
      className={clsx(
        "flex min-h-0 flex-col overflow-hidden rounded-4xl border border-white/10 bg-linear-to-b from-slate-950/80 via-slate-950/60 to-slate-950/80 text-white shadow-[0_35px_80px_rgba(2,6,23,0.65)] backdrop-blur-lg",
        className
      )}
    >
      {!document ? (
        <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-white/20 bg-slate-900/60 px-6 py-5 text-center text-sm text-slate-300">
          Upload a .docx template to unlock live chat with Lexsy&apos;s legal assistant.
        </div>
      ) : document.processing_status !== "ready" ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-white/20 bg-slate-900/60 px-6 py-5 text-center">
          <Loader size={20} className="text-indigo-200" />
          <p className="text-sm text-slate-200">Preparing your template&hellip;</p>
          <p className="text-xs text-white/60">Chat will unlock once extraction finishes.</p>
        </div>
      ) : (
        <ActiveChatPanel document={document} onTemplateUpdated={onTemplateUpdated} />
      )}
    </section>
  );
}

interface ActiveChatPanelProps {
  document: DocumentRecord;
  onTemplateUpdated: () => void;
}

function ActiveChatPanel({ document, onTemplateUpdated }: ActiveChatPanelProps) {
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: `/api/documents/${document.id}/chat`,
        fetch: async (input, init) => {
          const response = await fetch(input, init);
          if (response.headers?.get("x-template-updated") === "1") {
            onTemplateUpdated();
          }
          return response;
        },
      }),
    [document.id, onTemplateUpdated]
  );

  const { messages, sendMessage, status, error, clearError, setMessages } = useChat({
    id: document.id,
    transport,
    onFinish: () => {
      onTemplateUpdated();
    },
  });

  const storageKey = useMemo(() => `lexsy-chat-${document.id}`, [document.id]);
  const [hasHydratedMessages, setHasHydratedMessages] = useState(false);
  const [hasSeededIntro, setHasSeededIntro] = useState(false);

  useEffect(() => {
    setHasHydratedMessages(false);
    setHasSeededIntro(false);
  }, [storageKey]);

  useEffect(() => {
    if (hasHydratedMessages) return;
    if (typeof window === "undefined") return;
    try {
      const stored = window.sessionStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setMessages(parsed);
        }
      }
    } catch (storageError) {
      console.warn("Unable to hydrate chat history", storageError);
    } finally {
      setHasHydratedMessages(true);
    }
  }, [hasHydratedMessages, setMessages, storageKey]);

  useEffect(() => {
    if (!hasHydratedMessages) return;
    if (typeof window === "undefined") return;
    try {
      window.sessionStorage.setItem(storageKey, JSON.stringify(messages));
    } catch (storageError) {
      console.warn("Unable to persist chat history", storageError);
    }
  }, [hasHydratedMessages, messages, storageKey]);

  const handlePromptSubmit = useCallback(
    async ({ text }: PromptInputMessage) => {
      const value = text.trim();
      if (!value) return;
      try {
        await sendMessage({ text: value });
        clearError();
      } catch (submitError) {
        console.error(submitError);
      }
    },
    [sendMessage, clearError]
  );

  const isBusy = status === "submitted" || status === "streaming";
  const lastAssistantMessageId = useMemo(() => getLastAssistantMessageId(messages), [messages]);
  const placeholderStats = useMemo(() => {
    const placeholders = document.template_json?.placeholders ?? [];
    let filled = 0;
    let next: (typeof placeholders)[number] | null = null;

    for (const placeholder of placeholders) {
      if (placeholder.value) {
        filled += 1;
      } else if (!next) {
        next = placeholder;
      }
    }

    return {
      total: placeholders.length,
      filled,
      next,
    };
  }, [document.template_json]);

  const outstandingCount = Math.max(placeholderStats.total - placeholderStats.filled, 0);
  const nextPlaceholder = placeholderStats.next;

  const fetchGuidanceText = useCallback(
    async (variant: "intro" | "placeholder", placeholderKey?: string) => {
      try {
        const response = await fetch(`/api/documents/${document.id}/guidance`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ variant, placeholderKey }),
        });
        if (!response.ok) {
          throw new Error(`Failed to fetch ${variant} guidance`);
        }
        const data = (await response.json()) as { text?: string };
        const text = data.text?.trim();
        return text && text.length > 0 ? text : undefined;
      } catch (guidanceError) {
        console.warn("Unable to fetch guidance text", guidanceError);
        return undefined;
      }
    },
    [document.id]
  );

  useEffect(() => {
    if (!hasHydratedMessages || hasSeededIntro) return;
    let cancelled = false;

    const seedIntro = async () => {
      setHasSeededIntro(true);
      if (messages.length > 0) {
        return;
      }
      const remoteText = await fetchGuidanceText("intro");
      if (cancelled) return;
      const introMessage = remoteText
        ? buildAssistantMessage(INTRO_MESSAGE_ID, remoteText)
        : buildIntroMessage({
            documentTitle: document.filename,
            outstandingCount,
          });
      setMessages([introMessage]);
    };

    seedIntro();

    return () => {
      cancelled = true;
    };
  }, [
    document.filename,
    hasHydratedMessages,
    hasSeededIntro,
    fetchGuidanceText,
    messages.length,
    outstandingCount,
    setMessages,
  ]);

  useEffect(() => {
    if (!hasHydratedMessages) return;
    if (!nextPlaceholder) return;
    if (isBusy) return;

    const guidanceKey = nextPlaceholder.key;
    if (hasGuidanceForKey(messages, guidanceKey)) {
      return;
    }

    let cancelled = false;

    const seedGuidance = async () => {
      const remoteText = guidanceKey ? await fetchGuidanceText("placeholder", guidanceKey) : undefined;
      if (cancelled) return;

      const resolvedGuidanceId =
        getGuidanceMessageId(guidanceKey) ??
        `guidance-${
          nextPlaceholder.key ?? nextPlaceholder.raw ?? nextPlaceholder.description ?? "placeholder"
        }`;

      const guidanceMessage = remoteText
        ? buildAssistantMessage(resolvedGuidanceId, remoteText)
        : buildGuidanceMessage({
            documentTitle: document.filename,
            placeholder: nextPlaceholder,
            outstandingCount,
          });

      setMessages((prev) => {
        if (hasGuidanceForKey(prev, guidanceKey)) {
          return prev;
        }
        return prev.concat(guidanceMessage);
      });
    };

    seedGuidance();

    return () => {
      cancelled = true;
    };
  }, [
    document.filename,
    fetchGuidanceText,
    hasHydratedMessages,
    isBusy,
    messages,
    nextPlaceholder,
    outstandingCount,
    setMessages,
  ]);

  return (
    <div className="flex flex-1 min-h-0 flex-col text-white">
      <div className="relative flex min-h-0 flex-1 flex-col rounded-4xl border border-white/10 bg-slate-950/40">
        <div className="relative flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
          {isBusy ? (
            <div className="pointer-events-none absolute left-1/2 top-4 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/10 bg-slate-950/90 px-3 py-1 text-xs font-medium text-white/80 shadow-xl">
              <Loader size={14} className="text-indigo-200" />
              <span>Lexsy is drafting</span>
            </div>
          ) : null}
          <Conversation className="flex flex-1 flex-col overflow-x-hidden">
            {messages.length === 0 ? (
              <ConversationEmptyState className="px-8 text-white/80">
                <div className="space-y-2 text-center">
                  <h2 className="text-lg font-semibold text-white">Lexsy is getting oriented</h2>
                  <p className="text-sm text-slate-200">
                    I’ll open with guidance based on your template and keep everything synced automatically.
                  </p>
                </div>
              </ConversationEmptyState>
            ) : (
              <ConversationContent className="gap-5 p-5 sm:p-7">
                {messages.map((message, index) => {
                  const parts = renderMessageParts({
                    message,
                    status,
                    lastAssistantMessageId,
                  });
                  if (!parts || parts.length === 0) {
                    return null;
                  }

                  return (
                    <ChatMessage key={message.id ?? `${message.role}-${index}`} from={message.role}>
                      <MessageContent>{parts}</MessageContent>
                    </ChatMessage>
                  );
                })}
              </ConversationContent>
            )}
            <ConversationScrollButton className="bg-white/10 text-white shadow-lg hover:bg-white/20" />
          </Conversation>
        </div>
        <div className="relative border-t border-white/10 bg-slate-950/60 px-0 py-0 rounded-b-4xl">
          <PromptInput
            onSubmit={handlePromptSubmit}
            className="lexsy-chat-input-group rounded-b-4xl relative z-10"
          >
            <PromptInputTextarea
              placeholder="Send a message to Lexsy…"
              className="lexsy-chat-textarea h-11 flex-1 border-none bg-transparent text-left text-sm text-white placeholder:text-white/60"
            />
            <PromptInputSubmit
              status={status}
              className="flex size-11 items-center justify-center rounded-full bg-indigo-500 text-white transition hover:bg-indigo-400 disabled:opacity-70"
              disabled={isBusy}
              size="icon-sm"
            >
              {isBusy ? (
                <Loader size={14} className="text-white" />
              ) : (
                <ArrowUpRightIcon className="size-4" />
              )}
            </PromptInputSubmit>
          </PromptInput>
          {error ? <p className="mt-2 text-xs text-rose-200">{error.message}</p> : null}
        </div>
      </div>
    </div>
  );
}

const INTRO_MESSAGE_ID = "lexsy-intro";

interface IntroMessageConfig {
  documentTitle: string;
  outstandingCount: number;
}

function buildAssistantMessage(id: string, text: string): UIMessage {
  return {
    id,
    role: "assistant",
    parts: [
      {
        type: "text",
        text,
      },
    ],
  } as UIMessage;
}

function buildIntroMessage({
  documentTitle,
  outstandingCount,
}: IntroMessageConfig): UIMessage {
  const remainingCopy =
    outstandingCount > 0
      ? `We still have ${outstandingCount} placeholder${outstandingCount === 1 ? "" : "s"} to lock down.`
      : "All placeholders are filled, so we can focus on polish, risk review, or summaries.";
  return buildAssistantMessage(
    INTRO_MESSAGE_ID,
    `Hi, I'm Lexsy, your legal drafting copilot. I'll lead this working session for ${documentTitle}. ${remainingCopy} Tell me what you'd like to tackle first and I'll take the next step.`
  );
}

function getPlaceholderDisplayName(placeholder: Placeholder | null | undefined): string {
  if (!placeholder) {
    return "this field";
  }
  const source =
    placeholder.description?.trim() || placeholder.key?.trim() || placeholder.raw?.trim();
  return formatPlaceholderLabel(source);
}

function formatPlaceholderLabel(value: string | undefined): string {
  if (!value) {
    return "this field";
  }
  const cleaned = value
    .replace(/[\[\]{}<>]/g, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) {
    return "this field";
  }
  return cleaned
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function hasGuidanceForKey(messages: UIMessage[], placeholderKey: string | null | undefined): boolean {
  const guidanceId = getGuidanceMessageId(placeholderKey);
  if (!guidanceId) {
    return false;
  }
  return messages.some((message) => message.id === guidanceId);
}

function getGuidanceMessageId(placeholderKey: string | null | undefined): string | undefined {
  if (!placeholderKey) {
    return undefined;
  }
  return `guidance-${placeholderKey}`;
}

interface GuidanceMessageConfig {
  documentTitle: string;
  placeholder: Placeholder;
  outstandingCount: number;
}

function buildGuidanceMessage({
  documentTitle,
  placeholder,
  outstandingCount,
}: GuidanceMessageConfig): UIMessage {
  const label = getPlaceholderDisplayName(placeholder);
  const context = placeholder.description?.trim();
  const placeholderKey = placeholder.key ?? label;
  const remaining = outstandingCount > 1 ? `${outstandingCount - 1} more after this` : "this is the final field";
  const intro = `Let's capture ${label} for ${documentTitle}.`;
  const contextLine = context ? `I see it references ${context}.` : "Give me the exact wording you'd use.";
  const wrapUp = `Once we lock this in, ${remaining}.`;

  return buildAssistantMessage(`guidance-${placeholderKey}`, `${intro} ${contextLine} ${wrapUp}`);
}

type ChatStatus = ReturnType<typeof useChat>["status"];

function renderMessageParts({
  message,
  status,
  lastAssistantMessageId,
}: {
  message: UIMessage;
  status: ChatStatus;
  lastAssistantMessageId?: string;
}): ReactNode[] | null {
  const fallbackContent = renderMessageText(message).trim();
  const hasStructuredParts = Boolean(message.parts && message.parts.length > 0);
  if (!hasStructuredParts) {
    if (!fallbackContent) {
      return null;
    }
    return [
      <MessageResponse key={`${message.id ?? "message"}-text`}>
        {fallbackContent}
      </MessageResponse>,
    ];
  }

  const isLatestAssistantMessage =
    message.role === "assistant" &&
    Boolean(message.id) &&
    Boolean(lastAssistantMessageId) &&
    message.id === lastAssistantMessageId;

  const textBlocks: string[] = [];
  const hintBlocks: ReactNode[] = [];

  message.parts!.forEach((part, index) => {
    if (part.type === "text") {
      const text = part.text?.trim();
      if (text) {
        textBlocks.push(text);
      }
      return;
    }

    if (part.type === "source-url" || part.type === "source-document") {
      const label = part.title ?? ("url" in part ? part.url : undefined) ?? part.sourceId;
      if (label) {
        textBlocks.push(label);
      }
      return;
    }

    if (part.type === "reasoning") {
      const isStreamingPart =
        status === "streaming" &&
        isLatestAssistantMessage &&
        index === message.parts!.length - 1;
      if (!isStreamingPart) {
        return;
      }
      hintBlocks.push(
        <ReasoningHint key={`${message.id ?? "message"}-reasoning-${index}`} />
      );
      return;
    }

    if (isToolUIPart(part)) {
      const hint = buildToolHint({
        part,
        messageId: message.id,
        partIndex: index,
      });
      if (hint) {
        hintBlocks.push(hint);
      }
    }
  });

  const content: ReactNode[] = [];
  const combinedText = textBlocks.join("\n\n").trim();
  if (combinedText) {
    content.push(
      <MessageResponse key={`${message.id ?? "message"}-text`}>
        {combinedText}
      </MessageResponse>
    );
  }

  if (hintBlocks.length > 0) {
    content.push(...hintBlocks);
  }

  if (content.length === 0 && fallbackContent) {
    return [
      <MessageResponse key={`${message.id ?? "message"}-text-fallback`}>
        {fallbackContent}
      </MessageResponse>,
    ];
  }

  return content.length > 0 ? content : null;
}

function renderMessageText(message: UIMessage): string {
  if (!message.parts || message.parts.length === 0) {
    return "";
  }

  return message.parts
    .map((part) => {
      switch (part.type) {
        case "text":
          return part.text;
        case "source-url":
          return part.title ?? part.url ?? part.sourceId;
        case "source-document":
          return part.title ?? part.sourceId;
        default:
          return "";
      }
    })
    .join(" ");
}

type ToolUIPart = UIMessage["parts"][number] & {
  type: string;
  state?: string;
  toolName?: string;
  errorText?: string;
};

function ReasoningHint() {
  return (
    <div className="inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1 text-xs text-white/70">
      <Loader size={10} className="text-indigo-200" />
      Thinking through the next step…
    </div>
  );
}

function isToolUIPart(part: UIMessage["parts"][number]): part is ToolUIPart {
  if (!part || typeof part !== "object") {
    return false;
  }
  if (typeof part.type !== "string") {
    return false;
  }
  return (
    part.type === "tool-call" ||
    part.type === "tool-result" ||
    part.type === "dynamic-tool" ||
    part.type.startsWith("tool-")
  );
}

function buildToolHint({
  part,
  messageId,
  partIndex,
}: {
  part: ToolUIPart;
  messageId?: string;
  partIndex: number;
}): ReactNode | null {
  const toolState = formatToolHint(part.state);
  if (!toolState) {
    return null;
  }

  const key = `${messageId ?? "message"}-tool-${partIndex}`;
  const toneClasses =
    toolState.variant === "error"
      ? "text-rose-200"
      : "text-white/70";

  return (
    <div
      key={key}
      className="inline-flex flex-wrap items-center gap-2 rounded-full bg-white/5 px-3 py-1 text-xs"
    >
      {toolState.showSpinner ? <Loader size={10} className="text-indigo-200" /> : null}
      <span className={clsx("font-semibold", toneClasses)}>
        {formatToolDisplayName(part.toolName ?? part.type)}
      </span>
      <span className={toneClasses}>{toolState.label}</span>
      {toolState.variant === "error" && part.errorText ? (
        <span className="text-rose-300">{part.errorText}</span>
      ) : null}
    </div>
  );
}

function formatToolDisplayName(value: string | undefined): string {
  if (!value) {
    return "Tool";
  }
  const cleaned = value.replace(/^tool-/, "");
  return cleaned
    .split(/[-_]/g)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function formatToolHint(state?: string):
  | {
      label: string;
      variant: "neutral" | "error";
      showSpinner: boolean;
    }
  | null {
  switch (state) {
    case "input-streaming":
      return { label: "gathering info", variant: "neutral", showSpinner: true };
    case "input-available":
      return { label: "queued", variant: "neutral", showSpinner: true };
    case "output-error":
      return { label: "needs another try", variant: "error", showSpinner: false };
    case "output-available":
      return null; // already done; no need to surface
    default:
      return { label: "working", variant: "neutral", showSpinner: true };
  }
}

function getLastAssistantMessageId(messages: UIMessage[]): string | undefined {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const candidate = messages[index];
    if (candidate.role === "assistant" && candidate.id) {
      return candidate.id;
    }
  }
  return undefined;
}

export function DocumentPreviewWindow({
  template,
  document,
}: {
  template: ExtractedTemplate | null;
  document: DocumentRecord | null;
}) {
  return (
    <SuperDocViewer
      document={document}
      variant="live"
      className="h-full"
      fallback={
        !template ? (
          <p className="text-slate-300">
            Upload a template to see a live Microsoft Word preview with comments and pagination.
          </p>
        ) : (
          <div className="flex flex-col gap-2 text-sm text-slate-100">
            <p className="text-slate-300">
              Waiting for the rendered DOCX? Here&apos;s the structured view while we sync the real document.
            </p>
            <PreviewBody template={template} />
          </div>
        )
      }
    />
  );
}

export function PlaceholderTable({
  template,
  document,
  onDocumentUpdated,
}: {
  template: ExtractedTemplate | null;
  document: DocumentRecord | null;
  onDocumentUpdated?: (next: DocumentRecord) => void;
}) {
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [draftValue, setDraftValue] = useState("");
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  const beginEditing = useCallback((placeholder: Placeholder) => {
    setEditingKey(placeholder.key);
    setDraftValue(placeholder.value ?? "");
    setRowError(null);
  }, []);

  const cancelEditing = useCallback(() => {
    setEditingKey(null);
    setDraftValue("");
    setRowError(null);
  }, []);

  const handleSave = useCallback(async () => {
    if (!editingKey) return;
    if (!document) {
      setRowError("Load a document before saving edits.");
      return;
    }
    const trimmed = draftValue.trim();
    if (!trimmed) {
      setRowError("Enter a value before saving.");
      return;
    }
    setSavingKey(editingKey);
    setRowError(null);
    try {
      const updated = await updateDocumentPlaceholders(document.id, { [editingKey]: trimmed });
      onDocumentUpdated?.(updated);
      setEditingKey(null);
      setDraftValue("");
    } catch (error) {
      setRowError((error as Error).message ?? "Unable to save placeholder value.");
    } finally {
      setSavingKey(null);
    }
  }, [document, draftValue, editingKey, onDocumentUpdated]);

  return (
    <section className="flex h-full flex-col rounded-3xl border border-white/15 bg-slate-950/60 p-4 text-white shadow-[0_25px_60px_rgba(2,6,23,0.65)] backdrop-blur sm:p-5">
      {!template ? (
          <p className="rounded-xl border border-dashed border-white/20 bg-white/5 p-4 text-center text-sm text-white/70">
          Upload a document to see detected placeholders.
        </p>
      ) : (
        <div className="flex-1 overflow-y-auto">
            <table className="w-full text-sm text-white/80">
            <thead className="text-left text-xs uppercase text-white/60">
              <tr>
                <th className="py-2 pr-3">Field</th>
                <th className="py-2 pr-3">Original entry</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2">Type</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {template.placeholders.map((placeholder) => {
                const formattedValue = (() => {
                  if (typeof placeholder.value === "string") {
                    return placeholder.value.trim();
                  }
                  if (placeholder.value === null || placeholder.value === undefined) {
                    return "";
                  }
                  return String(placeholder.value).trim();
                })();
                const filled = formattedValue !== "";
                const fieldLabel = getPlaceholderDisplayName(placeholder);
                const currentValue = filled ? formattedValue : "";
                const displayValue = currentValue ? truncateValue(currentValue) : "";
                const statusText = filled
                  ? displayValue || "Provided"
                  : placeholder.required
                    ? "Missing"
                    : "Optional";
                const originalEntry = placeholder.raw ?? placeholder.description ?? "—";
                const statusClasses = clsx(
                  "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-wide",
                  filled
                    ? "bg-indigo-500 text-white shadow-[0_0_0_1px_rgba(99,102,241,0.35)]"
                    : placeholder.required
                      ? "bg-rose-600 text-white shadow-[0_0_0_1px_rgba(225,29,72,0.4)]"
                      : "bg-slate-700 text-slate-100 shadow-[0_0_0_1px_rgba(148,163,184,0.35)]"
                );
                const isEditing = editingKey === placeholder.key;
                return (
                  <Fragment key={placeholder.key}>
                    <tr className="border-b border-white/10 last:border-none">
                      <td className="py-3 pr-3">
                        <div className="font-medium text-white">{fieldLabel}</div>
                        <p className="text-xs text-white/60">{placeholder.key}</p>
                      </td>
                      <td className="py-3 pr-3 text-white/70">{originalEntry}</td>
                      <td className="py-3 pr-3">
                        <span className={statusClasses} title={filled ? currentValue : undefined}>
                          {statusText}
                        </span>
                      </td>
                      <td className="py-3 text-xs uppercase tracking-wide text-white/50">{placeholder.type}</td>
                      <td className="py-3">
                        <button
                          type="button"
                          onClick={() => (isEditing ? cancelEditing() : beginEditing(placeholder))}
                          className="rounded-full border border-white/25 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/80 transition hover:border-white/50 hover:text-white"
                        >
                          {isEditing ? "Close" : filled ? "Edit" : "Fill"}
                        </button>
                      </td>
                    </tr>
                    {isEditing ? (
                      <tr className="border-b border-white/10 last:border-none">
                        <td colSpan={5} className="bg-white/5 px-4 py-3">
                          <div className="space-y-3">
                            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
                              Placeholder value
                            </label>
                            <textarea
                              value={draftValue}
                              onChange={(event) => setDraftValue(event.target.value)}
                              className="w-full rounded-2xl border border-white/20 bg-slate-950/60 p-3 text-sm text-white outline-none transition focus:border-white/50"
                              rows={4}
                            />
                            {rowError ? <p className="text-xs text-rose-300">{rowError}</p> : null}
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={handleSave}
                                disabled={savingKey === placeholder.key}
                                className="inline-flex items-center gap-2 rounded-full bg-indigo-500 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:bg-indigo-500/40"
                              >
                                {savingKey === placeholder.key ? (
                                  <Loader size={14} className="text-white" />
                                ) : null}
                                Save value
                              </button>
                              <button
                                type="button"
                                onClick={cancelEditing}
                                className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/80 transition hover:border-white/40 hover:text-white"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function PreviewBody({ template }: { template: ExtractedTemplate }) {
  const placeholderLookup = useMemo(() => {
    const map = new Map<string, (typeof template.placeholders)[number]>();
    for (const placeholder of template.placeholders) {
      map.set(placeholder.key, placeholder);
    }
    return map;
  }, [template]);

  if (!template.docAst || template.docAst.length === 0) {
    return (
      <p className="text-sm text-slate-300">
        The LLM could not reconstruct the AST. Placeholder values will still sync below.
      </p>
    );
  }

  return (
    <div className="whitespace-pre-wrap">
      {template.docAst.map((node, index) => {
        if (node.type === "text") {
          return <span key={`text-${index}`}>{node.content}</span>;
        }
        const placeholder = placeholderLookup.get(node.key);
        const value = placeholder?.value;
        const displayValue = typeof value === "string" ? truncateValue(value, 80) : value;
        const tooltipText = typeof value === "string" && value.trim() !== "" ? value : placeholder?.raw;
        return (
          <span
            key={`placeholder-${node.key}-${index}`}
            className={clsx(
              "mx-1 inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
              value
                ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-100"
                : "border-amber-400/30 bg-amber-400/10 text-amber-100"
            )}
            title={tooltipText}
          >
            {displayValue ?? placeholder?.raw ?? node.raw}
          </span>
        );
      })}
    </div>
  );
}

function truncateValue(value: string, maxLength = 40): string {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength - 1)}…`;
}
