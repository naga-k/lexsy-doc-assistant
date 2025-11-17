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
    <div className="space-y-8">
      <header className="space-y-3">
        <p className="text-xs uppercase tracking-[0.4em] text-indigo-200">Screen two</p>
        <h1 className="text-3xl font-semibold text-white">Fill placeholders with context</h1>
        <p className="text-sm text-slate-300">
          Keep the document on the left while you answer via chat on the right. We only persist structured
          values.
        </p>
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
          <span>Document ID: {docId ?? "missing"}</span>
          {docSummary ? (
            <span>
              Filled {docSummary.filled}/{docSummary.total}
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => router.push("/preview" + (docId ? `?docId=${docId}` : ""))}
            className="rounded-full border border-white/30 px-3 py-1 text-white/80 transition hover:text-white"
            disabled={!docId}
          >
            Jump to preview
          </button>
        </div>
      </header>

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
    <div className="rounded-2xl border border-dashed border-white/20 bg-white/5 p-6 text-sm text-slate-300">
      Provide a <code className="text-white">docId</code> query parameter, e.g. <span className="font-semibold">/fill?docId=&lt;id&gt;</span>.
      You can obtain one from the upload screen.
    </div>
  );
}
