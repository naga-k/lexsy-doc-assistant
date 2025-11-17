'use client';

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { DocumentRecord, ExtractedTemplate } from "@/lib/types";
import { requestDocument } from "@/lib/client-documents";
import { ChatPanel, DocumentPreviewWindow, PlaceholderTable } from "@/components/workflow";
import clsx from "clsx";
import { useFlowSession } from "../flow-session-context";

export default function FillPage() {
  const searchParams = useSearchParams();
  const docId = searchParams.get("docId");
  const router = useRouter();
  const [document, setDocument] = useState<DocumentRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activePane, setActivePane] = useState<"document" | "placeholders">("document");
  const { setDocId: setActiveDocId, setIsDirty } = useFlowSession();

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

  useEffect(() => {
    setActiveDocId(docId);
    setIsDirty(Boolean(docId));
    return () => {
      setActiveDocId(null);
      setIsDirty(false);
    };
  }, [docId, setActiveDocId, setIsDirty]);

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
        <div className="rounded-3xl border border-white/10 bg-slate-950/40 p-6 shadow-lg">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,0.6fr)_minmax(0,0.4fr)]">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="inline-flex rounded-full border border-white/20 p-1 text-sm text-white/70">
                  {(["document", "placeholders"] as const).map((pane) => (
                    <button
                      key={pane}
                      type="button"
                      onClick={() => setActivePane(pane)}
                      className={clsx(
                        "rounded-full px-4 py-1.5 font-medium transition",
                        activePane === pane ? "bg-white text-slate-900" : "hover:text-white"
                      )}
                    >
                      {pane === "document" ? "Document" : "Placeholders"}
                    </button>
                  ))}
                </div>
                {activePane === "document" && template ? (
                  <span className="text-xs uppercase tracking-[0.3em] text-indigo-200">
                    {template.placeholders.length} placeholders
                  </span>
                ) : null}
                {activePane === "placeholders" && docSummary ? (
                  <span className="text-xs text-slate-300">
                    Filled {docSummary.filled}/{docSummary.total}
                  </span>
                ) : null}
              </div>

              {activePane === "document" ? (
                <DocumentPreviewWindow template={template} />
              ) : (
                <PlaceholderTable template={template} />
              )}
            </div>

            <div className="lg:self-start lg:sticky lg:top-6">
              <ChatPanel document={document} onTemplateUpdated={handleTemplateUpdated} />
            </div>
          </div>
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
