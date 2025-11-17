'use client';

import type { ChangeEvent } from "react";
import { useCallback, useMemo, useRef, useState } from "react";
import Image from "next/image";
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
import { isTemplateComplete } from "@/lib/templates";

type DocumentResponse = { document: DocumentRecord; error?: string };

export default function HomePage() {
  const [document, setDocument] = useState<DocumentRecord | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const heroFileInputRef = useRef<HTMLInputElement | null>(null);

  const heroStats = useMemo(
    () => [
      { label: "Avg extraction", value: "18s" },
      { label: "Placeholders synced", value: "38" },
      { label: "Ready-to-sign", value: "1 click" },
    ],
    []
  );

  const refreshDocument = useCallback(async (id: string) => {
    try {
      const next = await fetchDocument(id);
      setDocument(next);
    } catch (error) {
      console.error(error);
    }
  }, []);

  const handleTemplateRefresh = useCallback(() => {
    if (document) {
      refreshDocument(document.id);
    }
  }, [document, refreshDocument]);

  const handleFileUpload = useCallback(
    async (file: File | null) => {
      if (!file) return;
      setUploading(true);
      setUploadError(null);
      setGenerateError(null);
      try {
        const formData = new FormData();
        formData.append("file", file);
        const response = await fetch("/api/documents", {
          method: "POST",
          body: formData,
        });

        const raw = await response.text();
        const payload = safeJson<DocumentResponse>(raw);
        if (!response.ok || !payload?.document) {
          if (response.ok && !payload?.document) {
            throw new Error("Server response missing document payload.");
          }
          throw new Error(payload?.error ?? "Unable to upload file.");
        }
        setDocument(payload.document);
      } catch (error) {
        setUploadError((error as Error).message);
      } finally {
        setUploading(false);
      }
    },
    []
  );

  const triggerHeroUpload = useCallback(() => {
    heroFileInputRef.current?.click();
  }, []);

  const handleHeroFileChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0] ?? null;
      if (file) {
        void handleFileUpload(file);
      }
      event.target.value = "";
    },
    [handleFileUpload]
  );

  const handleGenerate = useCallback(async () => {
    if (!document) return;
    setIsGenerating(true);
    setGenerateError(null);
    try {
      const response = await fetch(`/api/documents/${document.id}/generate`, {
        method: "POST",
      });
      const raw = await response.text();
      const payload = safeJson<DocumentResponse>(raw);
      if (!response.ok || !payload?.document) {
        if (response.ok && !payload?.document) {
          throw new Error("Server response missing document payload.");
        }
        throw new Error(payload?.error ?? "Unable to generate document.");
      }
      setDocument(payload.document);
    } catch (error) {
      setGenerateError((error as Error).message);
    } finally {
      setIsGenerating(false);
    }
  }, [document]);

  const template = document?.template_json ?? null;
  const requiredPlaceholders = template?.placeholders.filter((ph) => ph.required) ?? [];
  const filledRequired = requiredPlaceholders.filter((ph) => Boolean(ph.value)).length;
  const completionRatio =
    requiredPlaceholders.length === 0
      ? 0
      : Math.round((filledRequired / requiredPlaceholders.length) * 100);
  const templateReady = template ? isTemplateComplete(template) : false;

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-12 lg:py-16">
        <div className="grid gap-12 lg:grid-cols-[1.05fr,0.95fr]">
          <div className="space-y-8">
            <div className="space-y-4">
              <p className="text-xs uppercase tracking-[0.4em] text-indigo-200">Screen one · Elegant upload</p>
              <h1 className="text-4xl font-semibold leading-tight text-white sm:text-5xl">
                Start with a luxurious upload, finish with a lawyer-ready draft.
              </h1>
              <p className="text-base text-slate-300">
                Lexsy mirrors your mock flow: drop a template, watch the preview update in real time,
                and chat with an AI co-pilot that knows every placeholder.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={triggerHeroUpload}
                className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:-translate-y-0.5"
              >
                Upload a .docx
              </button>
              <a
                href="#workflow"
                className="rounded-full border border-white/30 px-5 py-3 text-sm font-semibold text-white/80 transition hover:text-white"
              >
                See the Lexsy flow
              </a>
              <input
                ref={heroFileInputRef}
                type="file"
                accept=".docx"
                className="hidden"
                onChange={handleHeroFileChange}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              {heroStats.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300"
                >
                  <p className="text-xs uppercase tracking-[0.4em] text-indigo-200">{stat.label}</p>
                  <p className="mt-2 text-2xl font-semibold text-white">{stat.value}</p>
                </div>
              ))}
            </div>
            <UploadCard
              document={document}
              uploading={uploading}
              error={uploadError}
              onFileSelected={handleFileUpload}
              variant="hero"
            />
          </div>
          <FlowScreens />
        </div>
      </section>

      <section id="workflow" className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 pb-16">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-indigo-200">Screens two & three</p>
            <h2 className="text-3xl font-semibold text-white">Upload → Context → Download, on one surface</h2>
          </div>
          <p className="max-w-xl text-sm text-slate-400">
            Three live cards mirror your storyboard: the left column preserves the original, the middle
            pairs it with chat, and the right exports a polished version.
          </p>
        </div>
        <div className="grid gap-6 lg:grid-cols-[1fr_auto_1.35fr_auto_1fr] lg:items-start">
          <UploadCard
            document={document}
            uploading={uploading}
            error={uploadError}
            onFileSelected={handleFileUpload}
          />
          <FlowArrow />
          <FillStepCard
            document={document}
            template={template}
            onTemplateUpdated={handleTemplateRefresh}
          />
          <FlowArrow />
          <PreviewCard
            document={document}
            template={template}
            completionRatio={completionRatio}
            templateReady={templateReady}
            onGenerate={handleGenerate}
            generateError={generateError}
            isGenerating={isGenerating}
          />
        </div>
      </section>
    </main>
  );
}

function FlowArrow() {
  return (
    <div className="flex items-center justify-center text-slate-500" aria-hidden="true">
      <span className="hidden text-3xl lg:block">→</span>
      <span className="text-3xl lg:hidden">↓</span>
    </div>
  );
}

function FlowScreens() {
  const frames = [
    {
      title: "Upload",
      caption: "Lexsy ingests the .docx and locates placeholders automatically.",
      image: "/flow-upload.svg",
    },
    {
      title: "Realtime context",
      caption: "Keep the original doc visible while you answer in chat.",
      image: "/flow-context.svg",
    },
    {
      title: "Review & export",
      caption: "One click to render a filled copy that mirrors the master.",
      image: "/flow-complete.svg",
    },
  ];

  return (
    <div className="grid gap-6">
      {frames.map((frame, index) => (
        <div
          key={frame.title}
          className="rounded-3xl border border-white/10 bg-white/5 [@supports(backdrop-filter:blur(0px))]:backdrop-blur"
        >
          <div className="flex items-center justify-between px-4 pt-4 text-xs uppercase tracking-[0.4em] text-indigo-200">
            <span>
              {index + 1 < 10 ? `0${index + 1}` : index + 1}. {frame.title}
            </span>
            <span>Real-time</span>
          </div>
          <div className="px-4 pb-4">
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900/70">
              <Image
                src={frame.image}
                alt={`${frame.title} frame`}
                width={640}
                height={400}
                priority={index === 0}
                className="h-auto w-full"
              />
            </div>
            <p className="mt-3 text-sm text-slate-200">{frame.caption}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

interface FillStepCardProps {
  document: DocumentRecord | null;
  template: ExtractedTemplate | null;
  onTemplateUpdated: () => void;
}

function FillStepCard({ document, template, onTemplateUpdated }: FillStepCardProps) {
  const showEmptyState = !document;

  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-lg shadow-black/30">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-indigo-200">Step 2</p>
          <h2 className="text-2xl font-semibold text-white">Fill placeholders in context</h2>
          <p className="text-sm text-slate-300">
            The live doc stays on the left while Lexsy’s chat updates placeholder values on the right.
          </p>
        </div>
        <span className="rounded-full border border-white/30 px-3 py-1 text-[10px] uppercase tracking-[0.3em] text-slate-300">
          AI + human
        </span>
      </div>
      {showEmptyState ? (
        <div className="mt-6 rounded-2xl border border-dashed border-white/20 bg-slate-900/40 p-6 text-sm text-slate-300">
          Upload a .docx template to compare the original document with the chat assistant.
        </div>
      ) : (
        <div className="mt-6 grid gap-4 lg:grid-cols-[1.1fr,0.9fr]">
          <DocumentPreviewWindow template={template} />
          <ChatPanel document={document} onTemplateUpdated={onTemplateUpdated} showHeader={false} />
        </div>
      )}
      <div className="mt-6">
        <PlaceholderTable template={template} />
      </div>
    </section>
  );
}

async function fetchDocument(id: string): Promise<DocumentRecord> {
  const response = await fetch(`/api/documents/${id}`, {
    method: "GET",
    cache: "no-store",
  });
  const raw = await response.text();
  const payload = safeJson<DocumentResponse>(raw);
  if (!response.ok || !payload?.document) {
    throw new Error(payload?.error ?? "Unable to load document.");
  }
  return payload.document;
}

function safeJson<T>(input: string): T | null {
  try {
    return JSON.parse(input) as T;
  } catch {
    return null;
  }
}

interface UploadCardProps {
  document: DocumentRecord | null;
  uploading: boolean;
  error: string | null;
  onFileSelected: (file: File | null) => void;
  variant?: "default" | "hero";
}

function UploadCard({ document, uploading, error, onFileSelected, variant = "default" }: UploadCardProps) {
  const isHero = variant === "hero";
  const containerClasses = clsx(
    "p-6",
    isHero
      ? "rounded-3xl border border-white/20 bg-gradient-to-br from-white/5 via-white/0 to-white/5 shadow-[0_25px_60px_rgba(2,6,23,0.65)] backdrop-blur"
      : "rounded-2xl border border-slate-200 bg-white shadow-sm"
  );
  const headingClass = isHero ? "text-white" : "text-slate-900";
  const bodyClass = isHero ? "text-slate-200" : "text-slate-500";
  const badgeClass = isHero
    ? "rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/80"
    : "rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700";
  const dropzoneClasses = clsx(
    "mt-5 flex flex-col gap-3 rounded-xl border border-dashed p-5 text-sm",
    isHero
      ? "border-white/30 bg-white/5 text-slate-200"
      : "border-slate-300 bg-slate-50/60 text-slate-600"
  );
  const helperTextClass = isHero ? "text-xs text-slate-300" : "text-xs text-slate-500";
  const uploadingTextClass = isHero ? "text-sm text-indigo-200" : "text-sm text-indigo-600";
  const errorTextClass = isHero ? "text-sm text-rose-200" : "text-sm text-rose-600";

  return (
    <section id="upload-template" className={containerClasses}>
      <div className="flex items-center justify-between">
        <div>
          <h2 className={clsx("text-lg font-semibold", headingClass)}>1. Upload template</h2>
          <p className={clsx("text-sm", bodyClass)}>
            We store the original template privately and keep formatting intact.
          </p>
        </div>
        {document ? <span className={badgeClass}>{document.filename}</span> : null}
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
          Supported format: Microsoft Word .docx. Files are uploaded to Vercel Blob storage.
        </p>
        {uploading ? <p className={uploadingTextClass}>Uploading and extracting placeholders…</p> : null}
        {error ? <p className={errorTextClass}>{error}</p> : null}
      </div>
    </section>
  );
}

interface ChatPanelProps {
  document: DocumentRecord | null;
  onTemplateUpdated: () => void;
  showHeader?: boolean;
}

function ChatPanel({ document, onTemplateUpdated, showHeader = true }: ChatPanelProps) {
  return (
    <section className="flex min-h-[460px] flex-col rounded-3xl border border-white/15 bg-slate-950/60 p-6 text-white shadow-[0_25px_60px_rgba(2,6,23,0.65)] backdrop-blur">
      {showHeader ? (
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">2. Fill via chat</h2>
            <p className="text-sm text-slate-300">
              Lexsy guides missing fields and syncs placeholders while you chat with our AI and legal team.
            </p>
          </div>
          <span className="rounded-full border border-white/30 px-3 py-1 text-[10px] uppercase tracking-[0.3em] text-slate-300">
            AI + human
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

  const suggestionPresets = useMemo(
    () => [
      "Fill the missing share price",
      "Summarize investor terms",
      "What's left before download?",
    ],
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
      <div className="relative flex-1 overflow-hidden rounded-2xl border border-white/10 bg-slate-900/60">
        <Conversation className="h-full">
          {messages.length === 0 ? (
            <ConversationEmptyState
              className="text-slate-300"
              title="Upload to start chatting"
              description="Tell Lexsy about investors, caps, or dates and watch placeholders fill themselves."
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
        </Conversation>
        <ConversationScrollButton className="bg-white/10 text-white hover:bg-white/20" />
      </div>
      <Suggestions className="px-2">
        {suggestionPresets.map((suggestion) => (
          <Suggestion
            key={suggestion}
            suggestion={suggestion}
            onClick={handleSuggestion}
            variant="ghost"
            className="border border-white/15 text-white/80 hover:text-white"
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

interface PreviewCardProps {
  document: DocumentRecord | null;
  template: ExtractedTemplate | null;
  completionRatio: number;
  templateReady: boolean;
  isGenerating: boolean;
  generateError: string | null;
  onGenerate: () => void;
}

function DocumentPreviewWindow({ template }: { template: ExtractedTemplate | null }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-sm text-slate-100">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs uppercase tracking-[0.4em] text-indigo-200">Document</p>
        {template ? (
          <span className="text-xs text-slate-400">{template.placeholders.length} placeholders</span>
        ) : null}
      </div>
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

function PreviewCard({
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
          <h2 className="text-lg font-semibold text-slate-900">3. Preview & export</h2>
          <p className="text-sm text-slate-500">
            Replace placeholders inline and download an identical .docx copy.
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm font-medium text-slate-700">{completionRatio}% complete</p>
          <div className="mt-1 h-2 w-36 rounded-full bg-slate-100">
            <div
              className="h-2 rounded-full bg-indigo-600 transition-all"
              style={{ width: `${completionRatio}%` }}
            />
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

function PlaceholderTable({ template }: { template: ExtractedTemplate | null }) {
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
                    <td className="py-3 text-xs uppercase tracking-wide text-slate-500">
                      {placeholder.type}
                    </td>
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
