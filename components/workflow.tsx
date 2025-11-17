'use client';

import { useCallback, useMemo } from "react";
import clsx from "clsx";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
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
import {
  PromptInput,
  PromptInputBody,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputTools,
  PromptInputSubmit,
  type PromptInputMessage,
} from "@/components/ai-elements/prompt-input";
import type { DocumentRecord, ExtractedTemplate } from "@/lib/types";

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
}

export function ChatPanel({ document, onTemplateUpdated }: ChatPanelProps) {
  return (
    <section className="flex min-h-[460px] flex-col rounded-3xl border border-white/15 bg-slate-950/60 p-6 text-white shadow-[0_25px_60px_rgba(2,6,23,0.65)] backdrop-blur">
      {!document ? (
        <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-white/20 bg-slate-900/60 px-5 py-4 text-center text-sm text-slate-300">
          Upload a .docx template to unlock the chat experience.
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

  const { messages, sendMessage, status, error, clearError } = useChat({
    id: document.id,
    transport,
    onFinish: () => {
      onTemplateUpdated();
    },
  });

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

  return (
    <div className="flex flex-1 flex-col gap-4 text-white">
      <div className="relative flex-1 overflow-hidden rounded-2xl border border-white/10 bg-slate-900/60">
        <Conversation className="h-full">
          {messages.length === 0 ? (
            <ConversationEmptyState>
              <div className="space-y-1 text-center">
                <h2 className="text-lg font-semibold text-white">Fill via chat</h2>
                <p className="text-sm text-slate-300">
                  Lexsy guides missing fields and syncs placeholders while you chat with our AI and legal team.
                </p>
              </div>
            </ConversationEmptyState>
          ) : (
            <ConversationContent>
              {messages.map((message, index) => (
                <ChatMessage key={message.id ?? `${message.role}-${index}`} from={message.role}>
                  <MessageContent className="bg-transparent text-sm text-slate-50">
                    <MessageResponse>{renderMessageText(message)}</MessageResponse>
                  </MessageContent>
                </ChatMessage>
              ))}
            </ConversationContent>
          )}
          <ConversationScrollButton className="bg-white/10 text-white hover:bg-white/20" />
        </Conversation>
      </div>
      <PromptInput
        onSubmit={handlePromptSubmit}
        className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur"
      >
        <PromptInputBody>
          <PromptInputTextarea
            placeholder="Answer Lexsy here..."
            className="border-none bg-transparent text-sm text-white placeholder:text-slate-400"
          />
        </PromptInputBody>
        <PromptInputFooter className="items-center">
          <PromptInputTools>
            {error ? (
              <span className="text-xs text-rose-200">{error.message}</span>
            ) : null}
          </PromptInputTools>
          <PromptInputSubmit
            status={status}
            className="rounded-full bg-indigo-500 px-5 text-sm font-semibold text-white hover:bg-indigo-400"
            disabled={isBusy}
          >
            {isBusy ? "Sending" : "Send"}
          </PromptInputSubmit>
        </PromptInputFooter>
      </PromptInput>
    </div>
  );
}

function renderMessageText(message: UIMessage): string {
  if (!message.parts || message.parts.length === 0) {
    return "";
  }

  return message.parts
    .map((part) => {
      switch (part.type) {
        case "text":
        case "reasoning":
          return part.text;
        case "source-url":
          return part.title ?? part.url ?? part.sourceId;
        case "source-document":
          return part.title ?? part.sourceId;
        default:
          return `[${part.type}]`;
      }
    })
    .join(" ");
}

export function DocumentPreviewWindow({ template }: { template: ExtractedTemplate | null }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-sm text-slate-100">
      <div className="max-h-72 overflow-y-auto rounded-xl border border-white/10 bg-slate-900/60 p-4 leading-relaxed">
        {!template ? (
          <p className="text-slate-400">
            Upload a template to see a live preview. Lexsy keeps the AST representation visible while you fill fields.
          </p>
        ) : (
          <PreviewBody template={template} />
        )}
      </div>
    </section>
  );
}

export interface PreviewCardProps {
  document: DocumentRecord | null;
  template: ExtractedTemplate | null;
  completionRatio: number;
  templateReady: boolean;
  isGenerating: boolean;
  generateError: string | null;
  onGenerate: () => void;
}

export function PreviewCard({
  document,
  template,
  completionRatio,
  templateReady,
  isGenerating,
  generateError,
  onGenerate,
}: PreviewCardProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Preview & export</h2>
          <p className="text-sm text-slate-500">Replace placeholders inline and download an identical .docx copy.</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-medium text-slate-700">{completionRatio}% complete</p>
          <div className="mt-1 h-2 w-36 rounded-full bg-slate-100">
            <div className="h-2 rounded-full bg-indigo-600 transition-all" style={{ width: `${completionRatio}%` }} />
          </div>
        </div>
      </div>

      <div className="mt-5 max-h-80 overflow-y-auto rounded-xl border border-slate-100 bg-slate-50/60 p-4 text-sm leading-relaxed text-slate-800">
        {!template ? (
          <p className="text-slate-500">
            Upload a template to see its structure here. We render the doc inserting your latest answers so you never lose formatting context.
          </p>
        ) : (
          <PreviewBody template={template} />
        )}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onGenerate}
          disabled={!document || !templateReady || isGenerating}
          className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {isGenerating ? "Generating..." : "Generate filled .docx"}
        </button>
        <a
          href={document?.filled_blob_url ? `/api/documents/${document.id}/download` : undefined}
          aria-disabled={!document?.filled_blob_url}
          className={clsx(
            "rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-400 hover:text-slate-800",
            !document?.filled_blob_url && "pointer-events-none opacity-50"
          )}
        >
          Download latest file
        </a>
        {generateError ? <p className="text-sm text-rose-600">{generateError}</p> : null}
      </div>
    </section>
  );
}

export function PlaceholderTable({ template }: { template: ExtractedTemplate | null }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Placeholder tracker</h3>
          <p className="text-sm text-slate-500">Everything the document expects, in one checklist.</p>
        </div>
        {template ? (
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
            {template.placeholders.length} fields
          </span>
        ) : null}
      </div>
      {!template ? (
        <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-center text-sm text-slate-500">
          Upload a document to see detected placeholders.
        </p>
      ) : (
        <div className="max-h-72 overflow-y-auto">
          <table className="w-full text-sm text-slate-600">
            <thead className="text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="py-2 pr-3">Field</th>
                <th className="py-2 pr-3">Original token</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2">Type</th>
              </tr>
            </thead>
            <tbody>
              {template.placeholders.map((placeholder) => {
                const filled = Boolean(placeholder.value);
                return (
                  <tr key={placeholder.key} className="border-b border-slate-100 last:border-none">
                    <td className="py-3 pr-3 font-medium text-slate-900">{placeholder.key}</td>
                    <td className="py-3 pr-3 text-slate-500">{placeholder.raw}</td>
                    <td className="py-3 pr-3">
                      <span
                        className={clsx(
                          "rounded-full px-2 py-0.5 text-xs font-medium",
                          filled ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                        )}
                      >
                        {filled ? "Filled" : placeholder.required ? "Missing" : "Optional"}
                      </span>
                    </td>
                    <td className="py-3 text-xs uppercase tracking-wide text-slate-500">{placeholder.type}</td>
                  </tr>
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
      <p className="text-sm text-slate-500">
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
        return (
          <span
            key={`placeholder-${node.key}-${index}`}
            className={clsx(
              "mx-1 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
              value ? "bg-emerald-100 text-emerald-900" : "bg-amber-100 text-amber-900"
            )}
            title={placeholder?.raw}
          >
            {value ?? placeholder?.raw ?? node.raw}
          </span>
        );
      })}
    </div>
  );
}
