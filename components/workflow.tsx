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
import { Suggestions, Suggestion } from "@/components/ai-elements/suggestion";
import type { DocumentRecord, ExtractedTemplate } from "@/lib/types";

export interface UploadCardProps {
  document: DocumentRecord | null;
  uploading: boolean;
  error: string | null;
  onFileSelected: (file: File | null) => void;
  variant?: "default" | "hero";
}

export function UploadCard({ document, uploading, error, onFileSelected, variant = "default" }: UploadCardProps) {
  const isHero = variant === "hero";
  const containerClasses = clsx(
    "flex flex-col gap-5 p-6",
    isHero
      ? "rounded-3xl border border-white/20 bg-linear-to-br from-white/10 via-white/0 to-white/10 text-white shadow-[0_25px_70px_rgba(2,6,23,0.65)] backdrop-blur"
      : "rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-sm"
  );
  const headingClass = isHero ? "text-white" : "text-slate-900";
  const bodyClass = isHero ? "text-slate-200" : "text-slate-500";
  const badgeClass = isHero
    ? "rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold text-white/80"
    : "rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700";
  const dropzoneClasses = clsx(
    "flex flex-col gap-3 rounded-2xl border border-dashed p-5 text-sm",
    isHero ? "border-white/30 bg-white/5 text-slate-100" : "border-slate-300 bg-slate-50 text-slate-600"
  );
  const helperTextClass = isHero ? "text-xs text-slate-200/80" : "text-xs text-slate-500";
  const uploadingTextClass = isHero ? "text-sm text-indigo-200" : "text-sm text-indigo-600";
  const errorTextClass = isHero ? "text-sm text-rose-200" : "text-sm text-rose-600";

  return (
    <section className={containerClasses}>
      <div className="space-y-2">
        <p className={clsx("text-[11px] uppercase tracking-[0.4em]", isHero ? "text-indigo-200" : "text-indigo-500")}>Secure upload</p>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1">
            <h2 className={clsx("text-xl font-semibold", headingClass)}>Upload template</h2>
            <p className={clsx("text-sm", bodyClass)}>
              We store the original Word file privately, keep formatting intact, and hand you back a docId link.
            </p>
          </div>
          {document ? <span className={badgeClass}>{document.filename}</span> : null}
        </div>
      </div>
      <div className={dropzoneClasses}>
        <p>
          Drag & drop a .docx file or{" "}
          <label
            className={clsx(
              "cursor-pointer font-semibold",
              isHero ? "text-white hover:text-indigo-200" : "text-indigo-600 hover:text-indigo-500"
            )}
          >
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
        </p>
        <p className={helperTextClass}>
          Supported format: Microsoft Word .docx. Files land in encrypted Vercel Blob storage used by lexsy.ai.
        </p>
        {uploading ? <p className={uploadingTextClass}>Uploading and extracting placeholders…</p> : null}
        {error ? <p className={errorTextClass}>{error}</p> : null}
      </div>
      {document ? (
        <div
          className={clsx(
            "rounded-2xl border p-4 text-xs uppercase tracking-[0.3em]",
            isHero ? "border-white/20 bg-white/5 text-slate-200" : "border-slate-200 bg-slate-50 text-slate-500"
          )}
        >
          <p>Active docId</p>
          <p className={clsx("mt-2 break-all text-base font-semibold tracking-normal", headingClass)}>{document.id}</p>
        </div>
      ) : (
        <p className={clsx("text-sm", bodyClass)}>
          No file yet—drop the real template you use in production so the following screens feel identical to lexsy.ai.
        </p>
      )}
    </section>
  );
}

export interface ChatPanelProps {
  document: DocumentRecord | null;
  onTemplateUpdated: () => void;
  showHeader?: boolean;
}

export function ChatPanel({ document, onTemplateUpdated, showHeader = true }: ChatPanelProps) {
  return (
    <section className="flex min-h-[480px] flex-col rounded-3xl border border-white/15 bg-white/5 p-6 text-white shadow-[0_30px_80px_rgba(2,6,23,0.65)] backdrop-blur">
      {showHeader ? (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-indigo-200">Lexsy workspace</p>
            <h2 className="mt-1 text-xl font-semibold text-white">Fill via chat</h2>
            <p className="text-sm text-slate-300">
              Chat with Lexsy to complete placeholders. Every send updates the structured schema powering Preview.
            </p>
          </div>
          <span className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-[10px] uppercase tracking-[0.35em] text-slate-200">
            AI + team
          </span>
        </div>
      ) : (
        <div className="mb-4">
          <p className="text-xs uppercase tracking-[0.4em] text-indigo-200">Live chat</p>
          <h3 className="text-base font-semibold text-white">Answer once, sync everywhere</h3>
          <p className="text-sm text-slate-400">Lexsy updates placeholder values as soon as you reply.</p>
        </div>
      )}
      {!document ? (
        <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-white/20 bg-white/5 px-5 py-6 text-center text-sm text-slate-200">
          Upload the real .docx to unlock this chat. We only show this interface when a document is active in Lexsy.
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

  const suggestionPresets = useMemo(
    () => ["Fill the missing share price", "Summarize investor terms", "What's left before download?"],
    []
  );

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

  const handleSuggestion = useCallback(
    (suggestion: string) => {
      void sendMessage({ text: suggestion });
    },
    [sendMessage]
  );

  const isBusy = status === "submitted" || status === "streaming";

  return (
    <div className="flex flex-1 flex-col gap-4 text-white">
      <div className="relative flex-1 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
        <Conversation className="h-full">
          {messages.length === 0 ? (
            <ConversationEmptyState
              className="text-slate-200"
              title="Upload to start chatting"
              description="Use production data—Lexsy mirrors the live workspace here."
            />
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
      <Suggestions className="px-2">
        {suggestionPresets.map((suggestion) => (
          <Suggestion
            key={suggestion}
            suggestion={suggestion}
            onClick={handleSuggestion}
            variant="ghost"
            className="border border-white/15 text-white/80 hover:border-white/40 hover:text-white"
          />
        ))}
      </Suggestions>
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
            ) : (
              <span className="text-xs text-slate-300">
                Structured values only—Lexsy never stores your transcript.
              </span>
            )}
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
    <section className="rounded-3xl border border-white/10 bg-white/5 p-5 text-sm text-slate-100 shadow-[0_30px_80px_rgba(2,6,23,0.45)]">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-indigo-200">Live document</p>
          <p className="text-xs text-slate-400">Mirrors the lexsy.ai preview pane</p>
        </div>
        {template ? (
          <span className="text-xs text-slate-300">{template.placeholders.length} placeholders</span>
        ) : null}
      </div>
      <div className="max-h-80 overflow-y-auto rounded-2xl border border-white/10 bg-slate-950/30 p-4 leading-relaxed">
        {!template ? (
          <p className="text-slate-300">
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
    <section className="rounded-3xl border border-white/15 bg-white/5 p-6 text-white shadow-[0_35px_90px_rgba(2,6,23,0.65)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-indigo-200">Lexsy export</p>
          <h2 className="mt-1 text-2xl font-semibold text-white">Preview & export</h2>
          <p className="text-sm text-slate-200">
            Replace placeholders inline and download a production-ready .docx with one click.
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-[0.4em] text-indigo-200">Completion</p>
          <p className="text-3xl font-semibold text-white">{completionRatio}%</p>
          <div className="mt-2 h-2 w-36 rounded-full bg-white/15">
            <div className="h-2 rounded-full bg-emerald-300 transition-all" style={{ width: `${completionRatio}%` }} />
          </div>
          <p className="mt-1 text-xs text-slate-300">
            {templateReady ? "Ready to export" : "Finish required placeholders"}
          </p>
        </div>
      </div>

      <div className="mt-5 max-h-80 overflow-y-auto rounded-2xl border border-white/10 bg-slate-950/30 p-4 text-sm leading-relaxed text-slate-100">
        {!template ? (
          <p className="text-slate-300">
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
          className="rounded-full bg-emerald-400/90 px-5 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:bg-slate-400 disabled:text-slate-700"
        >
          {isGenerating ? "Generating..." : "Generate filled .docx"}
        </button>
        <a
          href={document?.filled_blob_url ? `/api/documents/${document.id}/download` : undefined}
          aria-disabled={!document?.filled_blob_url}
          className={clsx(
            "rounded-full border border-white/20 px-5 py-2 text-sm font-semibold text-white/80 transition hover:border-white/40 hover:text-white",
            !document?.filled_blob_url && "pointer-events-none opacity-50"
          )}
        >
          Download latest file
        </a>
        {generateError ? <p className="text-sm text-rose-300">{generateError}</p> : null}
      </div>
    </section>
  );
}

export function PlaceholderTable({ template }: { template: ExtractedTemplate | null }) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-6 text-white shadow-[0_30px_80px_rgba(2,6,23,0.45)]">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-indigo-200">Placeholder tracker</p>
          <h3 className="mt-1 text-base font-semibold text-white">Everything Lexsy detected</h3>
          <p className="text-sm text-slate-300">Matches the checklist from the live product.</p>
        </div>
        {template ? (
          <span className="rounded-full border border-white/20 px-3 py-1 text-xs text-white/80">
            {template.placeholders.length} fields
          </span>
        ) : null}
      </div>
      {!template ? (
        <p className="rounded-2xl border border-dashed border-white/20 bg-white/5 p-4 text-center text-sm text-slate-200">
          Upload a document to see detected placeholders.
        </p>
      ) : (
        <div className="max-h-72 overflow-y-auto">
          <table className="w-full text-sm text-slate-100">
            <thead className="text-left text-xs uppercase text-slate-300">
              <tr>
                <th className="py-2 pr-3 font-normal">Field</th>
                <th className="py-2 pr-3 font-normal">Original token</th>
                <th className="py-2 pr-3 font-normal">Status</th>
                <th className="py-2 font-normal">Type</th>
              </tr>
            </thead>
            <tbody>
              {template.placeholders.map((placeholder) => {
                const filled = Boolean(placeholder.value);
                return (
                  <tr key={placeholder.key} className="border-b border-white/5 last:border-none">
                    <td className="py-3 pr-3 font-medium text-white">{placeholder.key}</td>
                    <td className="py-3 pr-3 text-slate-300">{placeholder.raw}</td>
                    <td className="py-3 pr-3">
                      <span
                        className={clsx(
                          "rounded-full px-2 py-0.5 text-xs font-medium",
                          filled ? "bg-emerald-100/90 text-emerald-900" : "bg-amber-100 text-amber-900"
                        )}
                      >
                        {filled ? "Filled" : placeholder.required ? "Missing" : "Optional"}
                      </span>
                    </td>
                    <td className="py-3 text-xs uppercase tracking-wide text-slate-300">{placeholder.type}</td>
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
