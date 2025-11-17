'use client';

import { useCallback, useMemo, useState } from "react";
import clsx from "clsx";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import type { DocumentRecord, ExtractedTemplate } from "@/lib/types";
import { isTemplateComplete } from "@/lib/templates";

type DocumentResponse = { document: DocumentRecord; error?: string };

export default function HomePage() {
  const [document, setDocument] = useState<DocumentRecord | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

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
    <main className="min-h-screen bg-slate-50 py-8 text-slate-900">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 lg:flex-row lg:gap-8">
        <div className="flex w-full flex-col gap-4 lg:w-1/2">
          <UploadCard
            document={document}
            uploading={uploading}
            error={uploadError}
            onFileSelected={handleFileUpload}
          />
          <ChatPanel document={document} onTemplateUpdated={handleTemplateRefresh} />
        </div>
        <div className="flex w-full flex-col gap-4 lg:w-1/2">
          <PreviewCard
            document={document}
            template={template}
            completionRatio={completionRatio}
            templateReady={templateReady}
            onGenerate={handleGenerate}
            generateError={generateError}
            isGenerating={isGenerating}
          />
          <PlaceholderTable template={template} />
        </div>
      </div>
    </main>
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
}

function UploadCard({ document, uploading, error, onFileSelected }: UploadCardProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">1. Upload template</h2>
          <p className="text-sm text-slate-500">
            We store the original template privately and keep formatting intact.
          </p>
        </div>
        {document ? (
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
            {document.filename}
          </span>
        ) : null}
      </div>
      <div className="mt-5 flex flex-col gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50/60 p-5 text-sm text-slate-600">
        <p>
          Drag & drop a .docx file or{" "}
          <label className="cursor-pointer font-semibold text-indigo-600 hover:text-indigo-500">
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
        <p className="text-xs text-slate-500">
          Supported format: Microsoft Word .docx. Files are uploaded to Vercel Blob storage.
        </p>
        {uploading ? <p className="text-sm text-indigo-600">Uploading and extracting placeholders…</p> : null}
        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      </div>
    </section>
  );
}

interface ChatPanelProps {
  document: DocumentRecord | null;
  onTemplateUpdated: () => void;
}

function ChatPanel({ document, onTemplateUpdated }: ChatPanelProps) {
  return (
    <section className="flex min-h-[420px] flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">2. Fill via chat</h2>
          <p className="text-sm text-slate-500">
            Lexsy asks for missing fields and updates placeholders live.
          </p>
        </div>
      </div>
      {!document ? (
        <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 text-center text-sm text-slate-500">
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

  const [draft, setDraft] = useState("");
  const isLoading = status === "submitted" || status === "streaming";

  const submitMessage = useCallback(
    async (event?: React.FormEvent<HTMLFormElement>) => {
      event?.preventDefault();
      if (!draft.trim() || isLoading) {
        return;
      }
      try {
        await sendMessage({ text: draft.trim() });
        setDraft("");
        clearError();
        onTemplateUpdated();
      } catch (submitError) {
        console.error(submitError);
      }
    },
    [draft, isLoading, sendMessage, clearError, onTemplateUpdated]
  );

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex-1 space-y-3 overflow-y-auto rounded-xl border border-slate-100 bg-slate-50/60 p-4">
        {messages.length === 0 ? (
          <div className="text-sm text-slate-500">
            Lexsy is ready. Start by telling me about your company name or investor details.
          </div>
        ) : (
          messages.map((message, index) => (
            <div
              key={message.id ?? `${message.role}-${index}`}
              className={clsx(
                "max-w-full rounded-2xl px-4 py-2 text-sm leading-relaxed",
                message.role === "user"
                  ? "ml-auto bg-indigo-600 text-white"
                  : "bg-white text-slate-900 shadow-sm"
              )}
            >
              {renderMessageText(message)}
            </div>
          ))
        )}
      </div>
      <form
        className="space-y-2"
        onSubmit={submitMessage}
      >
        <textarea
          className="min-h-24 w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-100"
          placeholder="Answer Lexsy here..."
          value={draft}
          disabled={isLoading}
          onChange={(event) => setDraft(event.target.value)}
        />
        <div className="flex items-center justify-between">
          {error ? (
            <p className="text-sm text-rose-600">{error.message}</p>
          ) : (
            <span className="text-xs text-slate-400">
              We only store structured values, not your raw chat transcript.
            </span>
          )}
          <button
            type="submit"
            disabled={isLoading || !draft.trim()}
            className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            Send
          </button>
        </div>
      </form>
      <button
        type="button"
        onClick={() => setDraft("")}
        className="text-left text-xs text-slate-400 hover:text-slate-500"
      >
        Clear draft
      </button>
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
