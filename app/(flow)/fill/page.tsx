'use client';

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { DocumentRecord, ExtractedTemplate } from "@/lib/types";
import { requestDocument } from "@/lib/client-documents";
import { ChatPanel, DocumentPreviewWindow, PlaceholderTable } from "@/components/workflow";

export default function FillPage() {
  const searchParams = useSearchParams();
  const docId = searchParams.get("docId");
  const router = useRouter();
  const [document, setDocument] = useState<DocumentRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const handleTemplateUpdated = useCallback(() => {
    void loadDocument();
  }, [loadDocument]);

  const docSummary = useMemo(() => {
    if (!document) return null;
    const total = document.template_json?.placeholders.length ?? 0;
    const filled = document.template_json?.placeholders.filter((ph) => Boolean(ph.value)).length ?? 0;
    return { total, filled };
  }, [document]);

  return (
    <div className="space-y-10">
      <section className="rounded-3xl border border-white/15 bg-white/5 px-6 py-8 shadow-[0_35px_90px_rgba(2,6,23,0.65)] backdrop-blur md:px-10">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-4">
            <p className="text-xs uppercase tracking-[0.4em] text-indigo-200">Stage 02 · Fill</p>
            <div className="space-y-3">
              <h1 className="text-4xl font-semibold text-white">Answer once while the template stays pinned.</h1>
              <p className="text-base text-slate-200">
                This is the same dual-column workspace from lexsy.ai: document on the left, guided chat on the right.
                Every reply instantly syncs placeholders so legal, sales, and finance see the same truth.
              </p>
            </div>
          </div>
          <div className="grid gap-4 text-sm text-slate-200 sm:grid-cols-2 lg:max-w-sm">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-[11px] uppercase tracking-[0.4em] text-indigo-200">Document ID</p>
              <p className="mt-2 break-all text-base font-semibold text-white">{docId ?? "Add ?docId=..."}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-[11px] uppercase tracking-[0.4em] text-indigo-200">Progress</p>
              <p className="mt-2 text-2xl font-semibold text-white">
                {docSummary ? `${docSummary.filled}/${docSummary.total}` : "—"}
              </p>
              <p className="text-xs text-slate-400">Filled placeholders</p>
            </div>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-3 text-xs text-slate-300">
          <span className="rounded-full border border-white/10 px-3 py-1 text-white/70">
            Structured values only
          </span>
          <button
            type="button"
            onClick={() => router.push("/preview" + (docId ? `?docId=${docId}` : ""))}
            className="rounded-full border border-white/30 px-4 py-1.5 text-white/80 transition hover:text-white"
            disabled={!docId}
          >
            Jump to preview
          </button>
        </div>
      </section>

      {!docId ? (
        <MissingDocState />
      ) : loading ? (
        <p className="text-sm text-slate-300">Loading document…</p>
      ) : error ? (
        <p className="text-sm text-rose-300">{error}</p>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-[1.1fr,0.9fr]">
            <DocumentPreviewWindow template={template} />
            <ChatPanel document={document} onTemplateUpdated={handleTemplateUpdated} />
          </div>
          <PlaceholderTable template={template} />
        </div>
      )}
    </div>
  );
}

function MissingDocState() {
  return (
    <div className="rounded-3xl border border-dashed border-white/25 bg-white/5 p-6 text-sm text-slate-300">
      Provide a <code className="text-white">docId</code> query parameter, e.g. <span className="font-semibold">/fill?docId=&lt;id&gt;</span>.
      You can obtain one from the upload screen.
    </div>
  );
}
