'use client';

import { useCallback, useMemo, useState } from "react";
import clsx from "clsx";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import type { DocumentRecord, ExtractedTemplate } from "@/lib/types";
import { isTemplateComplete } from "@/lib/templates";

type DocumentResponse = { document: DocumentRecord; error?: string };

const heroImageUrl =
  "https://cdn.prod.website-files.com/65030261282cb8dc8d56f660/669e8921529a7f101e0f65ee_5.png";

const serviceHighlights = [
  {
    title: "For Startups",
    description:
      "Guidance from incorporation to scaling—cap tables, founder equity, fundraising, and compliant contracts bundled with the same AI chat that fills your documents.",
    accent: "Formation",
  },
  {
    title: "For Investors",
    description:
      "Fund formation, LP communications, side letters, and diligence docs with clarity and responsiveness that echo the Lexsy concierge experience.",
    accent: "Funds",
  },
];

const testimonials = [
  {
    name: "Oliver Cameron",
    role: "General Partner, Reasons to Be Optimistic",
    quote:
      "Kristina has been an invaluable partner to my fund. She combines fast, creative legal work with clear communication and a great sense of humor.",
    avatar:
      "https://cdn.prod.website-files.com/65030262282cb8dc8d56f8b8/6717211f9a16352e6269a027_Oliver.jpeg",
  },
  {
    name: "Amber Illig",
    role: "General Partner, The Council Fund",
    quote:
      "Kristina was the perfect partner to help us onboard LPs while staying transparent about costs—she keeps the deal momentum alive.",
    avatar:
      "https://cdn.prod.website-files.com/65030262282cb8dc8d56f8b8/6719342dd6d399a3f23ce3fa_Amber%20Illig.jpeg",
  },
  {
    name: "Rima Seiilova-Olson",
    role: "Co-founder & CEO, Tenvos",
    quote:
      "Kristina steered us through stock awards, commercial agreements, and fundraising with the steady hand we needed when everything felt complex.",
    avatar:
      "https://cdn.prod.website-files.com/65030262282cb8dc8d56f8b8/6717255f43b30134fed8d8ed_Rima%20Seiilova-Olson.jpeg",
  },
  {
    name: "Balaji Gopinath",
    role: "General Partner, Kubera Venture Capital",
    quote:
      "Lexsy handled fund compliance and filings so we could keep our focus on LPs and portfolio companies. Their responsiveness keeps us ahead.",
    avatar:
      "https://cdn.prod.website-files.com/65030262282cb8dc8d56f8b8/67193397edfe0efa9f45cc0f_Balaji%20Gopinath.jpeg",
  },
];

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
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-10">
        <HeroShowcase />
        <ServiceHighlightsSection />
        <div className="grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <UploadCard
            document={document}
            uploading={uploading}
            error={uploadError}
            onFileSelected={handleFileUpload}
          />
          <ChatPanel document={document} onTemplateUpdated={handleTemplateRefresh} />
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
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
        <TestimonialsSection />
      </div>
    </main>
  );
}

function HeroShowcase() {
  return (
    <section className="rounded-3xl border border-white/10 bg-linear-to-br from-slate-900 via-slate-950 to-indigo-900 p-8 shadow-[0_30px_90px_rgba(15,23,42,0.65)]">
      <div className="grid gap-8 lg:grid-cols-[1.05fr,0.95fr]">
        <div className="space-y-5">
          <div className="flex items-center gap-3 text-xs uppercase tracking-[0.4em] text-indigo-200">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            Lexsy partner
          </div>
          <h1 className="text-4xl font-semibold leading-tight text-white sm:text-5xl">
            Legal partner on your hero’s journey
          </h1>
          <p className="text-base text-slate-200">
            Lean on Lexsy for AI-assisted placeholder discovery, instant legal chat, and polished export-ready documents that let you move faster.
          </p>
          <div className="flex flex-wrap gap-3">
            <a
              href="https://stan.store/Lexsy"
              target="_blank"
              rel="noreferrer"
              className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-slate-900 shadow-lg shadow-indigo-900/40 transition hover:-translate-y-0.5"
            >
              Apply to Work With Us
            </a>
            <a
              href="#upload-template"
              className="rounded-full border border-white/40 px-5 py-2 text-sm font-semibold text-white transition hover:border-white"
            >
              Upload a template
            </a>
          </div>
          <div className="flex flex-wrap gap-8 text-sm text-slate-200">
            <div>
              <p className="text-2xl font-semibold text-white">24h</p>
              <p className="text-xs uppercase tracking-[0.4em] text-slate-400">avg. chat turn</p>
            </div>
            <div>
              <p className="text-2xl font-semibold text-white">14K+</p>
              <p className="text-xs uppercase tracking-[0.4em] text-slate-400">fields filled</p>
            </div>
          </div>
        </div>
        <div className="relative flex items-center justify-center">
          <div className="absolute top-4 right-4 hidden rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-xs text-white backdrop-blur md:block">
            <p className="font-semibold text-white">Lexsy AI</p>
            <p className="text-[11px] text-slate-200">Launch-ready documents</p>
          </div>
          <img
            src={heroImageUrl}
            alt="Hero visual"
            className="h-80 w-full max-w-[420px] rounded-[30px] object-cover shadow-[0_35px_70px_rgba(0,0,0,0.4)]"
          />
        </div>
      </div>
    </section>
  );
}

function ServiceHighlightsSection() {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-lg shadow-black/30">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-indigo-200">Services</p>
          <h2 className="text-2xl font-semibold text-white">Services for startups and investors</h2>
          <p className="text-sm text-slate-300">
            We support every stage—formation, fundraising, hiring, compliance, and operations—while keeping you aligned with your business.
          </p>
        </div>
        <a
          href="/services"
          className="text-sm font-semibold text-indigo-200 transition hover:text-white"
        >
          Explore all services ↗
        </a>
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {serviceHighlights.map((service) => (
          <div
            key={service.title}
            className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]"
          >
            <p className="text-[11px] uppercase tracking-[0.4em] text-emerald-300">{service.accent}</p>
            <h3 className="mt-3 text-xl font-semibold text-white">{service.title}</h3>
            <p className="mt-2 text-sm text-slate-300">{service.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function TestimonialsSection() {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-lg shadow-black/30">
      <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-indigo-200">Testimonials</p>
          <h2 className="text-2xl font-semibold text-white">Don’t just take our word for it</h2>
        </div>
        <span className="text-sm text-slate-300">Hear from founders building faster</span>
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {testimonials.map((testimonial) => (
          <div
            key={testimonial.name}
            className="flex h-full flex-col justify-between rounded-3xl border border-white/10 bg-slate-900/60 p-4 text-sm text-slate-100"
          >
            <p className="text-base text-white">“{testimonial.quote}”</p>
            <div className="mt-5 flex items-center gap-3">
              <div className="h-12 w-12 overflow-hidden rounded-full bg-slate-800">
                <img src={testimonial.avatar} alt={testimonial.name} className="h-full w-full object-cover" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">{testimonial.name}</p>
                <p className="text-xs text-slate-400">{testimonial.role}</p>
              </div>
            </div>
          </div>
        ))}
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
}

function UploadCard({ document, uploading, error, onFileSelected }: UploadCardProps) {
  return (
    <section
      id="upload-template"
      className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
    >
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
    <section className="flex min-h-[420px] flex-col rounded-3xl border border-white/20 bg-slate-900/70 p-6 text-white shadow-2xl backdrop-blur">
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
    <div className="flex flex-1 flex-col gap-4 text-white">
      <div className="flex-1 space-y-3 overflow-y-auto rounded-2xl border border-white/10 bg-slate-900/60 p-4">
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
      <form className="space-y-3" onSubmit={submitMessage}>
        <textarea
          className="min-h-24 w-full resize-none rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-sm text-white placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
          placeholder="Answer Lexsy here..."
          value={draft}
          disabled={isLoading}
          onChange={(event) => setDraft(event.target.value)}
        />
        <div className="flex items-center justify-between">
          {error ? (
            <p className="text-xs text-rose-300">{error.message}</p>
          ) : (
            <span className="text-xs text-slate-300">
              Structured values only—Lexsy never keeps your free-form chat transcript.
            </span>
          )}
          <button
            type="submit"
            disabled={isLoading || !draft.trim()}
            className="rounded-full bg-linear-to-r from-indigo-500 to-purple-500 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-900/60 transition enabled:hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Send
          </button>
        </div>
      </form>
      <button
        type="button"
        onClick={() => setDraft("")}
        className="text-left text-xs font-semibold uppercase tracking-[0.3em] text-slate-400 transition hover:text-white"
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
