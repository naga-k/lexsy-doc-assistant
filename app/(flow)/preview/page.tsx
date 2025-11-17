"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { DocumentRecord, ExtractedTemplate } from "@/lib/types";
import { generateDocument, requestDocument } from "@/lib/client-documents";
import { PreviewCard } from "@/components/workflow";
import { isTemplateComplete } from "@/lib/templates";

export default function PreviewPage() {
  return (
    <Suspense fallback={<PreviewPageFallback />}>
      <PreviewPageContent />
    </Suspense>
  );
}

function PreviewPageContent() {
  const searchParams = useSearchParams();
  const docId = searchParams.get("docId");
  const [document, setDocument] = useState<DocumentRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const template: ExtractedTemplate | null = document?.template_json ?? null;

  const loadDocument = useCallback(async () => {
    if (!docId) return;
    setLoading(true);
    setError(null);
    try {
      const next = await requestDocument(docId);
      setDocument(next);
    } catch (loadError) {
      setError((loadError as Error).message);
    } finally {
      setLoading(false);
    }
  }, [docId]);

  useEffect(() => {
    if (docId) {
      void loadDocument();
    } else {
      setDocument(null);
    }
  }, [docId, loadDocument]);

  const completionRatio = useMemo(() => {
    const placeholders = template?.placeholders.filter((ph) => ph.required) ?? [];
    if (placeholders.length === 0) return 0;
    const filled = placeholders.filter((ph) => Boolean(ph.value)).length;
    return Math.round((filled / placeholders.length) * 100);
  }, [template]);

  const templateReady = template ? isTemplateComplete(template) : false;

  const handleGenerate = useCallback(async () => {
    if (!docId) return;
    setIsGenerating(true);
    setGenerateError(null);
    try {
      const next = await generateDocument(docId);
      setDocument(next);
    } catch (generateErr) {
      setGenerateError((generateErr as Error).message);
    } finally {
      setIsGenerating(false);
    }
  }, [docId]);

  return (
    <div className="space-y-10">
      <section className="rounded-3xl border border-white/15 bg-white/5 px-6 py-8 shadow-[0_35px_90px_rgba(2,6,23,0.65)] backdrop-blur md:px-10">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-4">
            <p className="text-xs uppercase tracking-[0.4em] text-indigo-200">Stage 03 · Preview & export</p>
            <div className="space-y-3">
              <h1 className="text-4xl font-semibold text-white">Ship the finished .docx right from here.</h1>
              <p className="text-base text-slate-200">
                Lexsy replays your structured answers into the original layout. Generate a clean copy and share the download link without leaving this flow.
              </p>
            </div>
          </div>
          <div className="grid gap-4 text-sm text-slate-200 sm:grid-cols-2 lg:max-w-sm">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-[11px] uppercase tracking-[0.4em] text-indigo-200">Document ID</p>
              <p className="mt-2 break-all text-base font-semibold text-white">{docId ?? "Add ?docId=..."}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-[11px] uppercase tracking-[0.4em] text-indigo-200">Completion</p>
              <p className="mt-2 text-2xl font-semibold text-white">{template ? `${completionRatio}%` : "—"}</p>
              <p className="text-xs text-slate-400">Required placeholders filled</p>
            </div>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-3 text-xs text-slate-300">
          <span className="rounded-full border border-white/10 px-3 py-1 text-white/70">
            {templateReady ? "Ready to export" : "Fill placeholders to unlock export"}
          </span>
          <Link
            href={docId ? `/fill?docId=${docId}` : "/fill"}
            className="rounded-full border border-white/30 px-4 py-1.5 text-white/80 transition hover:text-white"
          >
            Review in Fill screen
          </Link>
        </div>
      </section>

      {!docId ? (
        <MissingDocState />
      ) : loading ? (
        <p className="text-sm text-slate-300">Loading document…</p>
      ) : error ? (
        <p className="text-sm text-rose-300">{error}</p>
      ) : (
        <PreviewCard
          document={document}
          template={template}
          completionRatio={completionRatio}
          templateReady={templateReady}
          isGenerating={isGenerating}
          generateError={generateError}
          onGenerate={handleGenerate}
        />
      )}
    </div>
  );
}

function PreviewPageFallback() {
  return <div className="text-sm text-slate-300">Loading preview workspace…</div>;
}

function MissingDocState() {
  return (
    <div className="rounded-3xl border border-dashed border-white/25 bg-white/5 p-6 text-sm text-slate-300">
      Provide a <code className="text-white">docId</code> query parameter first. Use the upload page to create one.
    </div>
  );
}
