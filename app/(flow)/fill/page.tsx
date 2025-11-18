"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { DocumentRecord, ExtractedTemplate } from "@/lib/types";
import { processDocument, requestDocument } from "@/lib/client-documents";
import { ChatPanel, DocumentPreviewWindow, PlaceholderTable } from "@/components/workflow";
import clsx from "clsx";
import { useFlowSession } from "../flow-session-context";
import { getTemplateCompletionRatio } from "@/lib/templates";
import { Loader } from "@/components/ai-elements/loader";

type Pane = "document" | "placeholders";

export default function FillPage() {
  return (
    <Suspense fallback={<FillPageFallback />}>
      <FillPageContent />
    </Suspense>
  );
}

function FillPageContent() {
  const searchParams = useSearchParams();
  const docId = searchParams.get("docId");
  const [document, setDocument] = useState<DocumentRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processingError, setProcessingError] = useState<string | null>(null);
  const [activePane, setActivePane] = useState<Pane>("document");
  const { setDocId: setActiveDocId, setIsDirty } = useFlowSession();

  const template: ExtractedTemplate | null = document?.template_json ?? null;
  const completionRatio = useMemo(() => getTemplateCompletionRatio(template), [template]);

  const loadDocument = useCallback(
    async (options?: { background?: boolean }) => {
      if (!docId) return;
      const background = options?.background ?? false;
      if (!background) {
        setLoading(true);
        setError(null);
      }
      try {
        const next = await requestDocument(docId);
        setDocument(next);
      } catch (loadError) {
        if (background) {
          console.warn("Background refresh failed", loadError);
        } else {
          setError((loadError as Error).message);
        }
      } finally {
        if (!background) {
          setLoading(false);
        }
      }
    },
    [docId]
  );

  useEffect(() => {
    if (docId) {
      void loadDocument();
      setProcessingError(null);
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
    void loadDocument({ background: true });
  }, [loadDocument]);

  const handleDocumentPatched = useCallback((next: DocumentRecord) => {
    setDocument(next);
    setProcessingError(null);
  }, [setProcessingError]);

  const handleRetryProcessing = useCallback(() => {
    if (!docId) return;
    setProcessingError(null);
    setDocument((prev) =>
      prev
        ? {
            ...prev,
            processing_status: "pending",
            processing_progress: 0,
            processing_next_chunk: 0,
          }
        : prev
    );
    void processDocument(docId)
      .then((updated) => {
        setDocument(updated);
      })
      .catch((processErr) => {
        setProcessingError((processErr as Error).message);
      });
  }, [docId]);

  const shouldAutoProcess = Boolean(
    docId &&
      document &&
      document.processing_status !== "ready" &&
      document.processing_status !== "failed"
  );

  useEffect(() => {
    if (!docId || !shouldAutoProcess) {
      return;
    }

    let cancelled = false;
    let timeoutId: number | null = null;

    const poll = async () => {
      try {
        const updated = await requestDocument(docId);
        if (cancelled) return;
        setDocument(updated);
        setProcessingError(null);
        if (updated.processing_status === "ready" || updated.processing_status === "failed") {
          return;
        }
        timeoutId = window.setTimeout(poll, 1200);
      } catch (pollError) {
        if (cancelled) return;
        setProcessingError((pollError as Error).message);
        timeoutId = window.setTimeout(poll, 2500);
      }
    };

    void poll();

    return () => {
      cancelled = true;
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [docId, shouldAutoProcess, setDocument]);

  const isProcessing = document ? document.processing_status !== "ready" : false;
  const isProcessingFailed = document?.processing_status === "failed";
  const totalChunks = document?.processing_total_chunks ?? 0;
  const animatedProgress = useOptimisticProgress(
    document?.processing_progress ?? 0,
    totalChunks,
    isProcessing && !isProcessingFailed
  );

  return (
    <div className="flex h-full flex-1 min-h-0 flex-col gap-1 overflow-hidden px-2 py-4 sm:px-4 lg:px-5">
      {!docId ? (
        <MissingDocState />
      ) : loading ? (
        <p className="text-sm text-slate-300">Loading document…</p>
      ) : error ? (
        <p className="text-sm text-rose-300">{error}</p>
      ) : (
        <div className="flex flex-1 min-h-0 flex-col gap-2 sm:gap-3">
          {document ? (
            <ProcessingBanner
              status={document.processing_status}
              progress={animatedProgress}
              error={isProcessingFailed ? document.processing_error ?? processingError : processingError}
              onRetry={handleRetryProcessing}
            />
          ) : null}
          <FillTopBar
            activePane={activePane}
            onPaneChange={setActivePane}
            completionRatio={completionRatio}
            downloadHref={
              document?.filled_blob_url && !isProcessing
                ? `/api/documents/${document.id}/download`
                : null
            }
          />
          <div className="grid flex-1 min-h-0 gap-3 lg:grid-cols-[minmax(0,0.6fr)_minmax(0,0.4fr)]">
            <div className="flex min-h-0 flex-col gap-3 overflow-hidden p-1 sm:p-2">
              <div className="flex-1 min-h-0 overflow-hidden">
                {isProcessing ? (
                  <PendingTemplateState status={document?.processing_status} progress={animatedProgress} />
                ) : activePane === "document" ? (
                  <DocumentPreviewWindow template={template} document={document} />
                ) : (
                  <PlaceholderTable
                    template={template}
                    document={document}
                    onDocumentUpdated={handleDocumentPatched}
                  />
                )}
              </div>
            </div>
            <div className="flex min-h-0 flex-col overflow-hidden p-1 sm:p-2">
              <ChatPanel
                document={document}
                onTemplateUpdated={handleTemplateUpdated}
                className="h-full min-h-0 overflow-hidden"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

type FillTopBarProps = {
  activePane: Pane;
  onPaneChange: (pane: Pane) => void;
  completionRatio: number;
  downloadHref: string | null;
};

function FillTopBar({
  activePane,
  onPaneChange,
  completionRatio,
  downloadHref,
}: FillTopBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 px-1 py-1 text-xs text-slate-300 sm:px-2">
      <div className="inline-flex rounded-full border border-white/15 bg-white/5 p-0.5 text-white/70">
        {(["document", "placeholders"] as Pane[]).map((pane) => (
          <button
            key={pane}
            type="button"
            onClick={() => onPaneChange(pane)}
            className={clsx(
              "rounded-full px-3 py-1 text-[11px] font-medium uppercase tracking-[0.2em] transition",
              activePane === pane
                ? "bg-white text-slate-900"
                : "text-slate-300 hover:text-white hover:bg-white/10"
            )}
          >
            {pane === "document" ? "Document" : "Placeholders"}
          </button>
        ))}
      </div>
      <div className="flex flex-1 items-center gap-2 text-[11px] text-white/70 min-w-[140px]">
        <div className="h-1 flex-1 rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-indigo-500 transition-all"
            style={{ width: `${completionRatio}%` }}
          />
        </div>
        <span className="font-semibold tabular-nums">{completionRatio}%</span>
      </div>
      <button
        type="button"
        onClick={() => {
          if (!downloadHref) return;
          window.location.assign(downloadHref);
        }}
        className="inline-flex items-center rounded-full border border-white/20 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/80 transition hover:border-white/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
        disabled={!downloadHref}
      >
        Download latest DOCX
      </button>
    </div>
  );
}

type ProcessingBannerProps = {
  status: DocumentRecord["processing_status"];
  progress: number;
  error: string | null;
  onRetry: () => void;
};

function ProcessingBanner({ status, progress, error, onRetry }: ProcessingBannerProps) {
  if (status === "ready") {
    return null;
  }
  const isFailed = status === "failed";
  const statusLabel = isFailed
    ? "Extraction failed"
    : status === "processing"
      ? "Extracting template"
      : "Queued for extraction";
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-white/80">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-[10px] font-semibold uppercase tracking-[0.25em] text-indigo-200">
          {statusLabel}
        </span>
        {!isFailed ? (
          <div className="flex min-w-40 flex-1 items-center gap-2 text-[11px]">
            <div className="h-1.5 flex-1 rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-indigo-400 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="font-semibold tabular-nums">{Math.round(progress)}%</span>
          </div>
        ) : (
          <button
            type="button"
            onClick={onRetry}
            className="rounded-full border border-white/30 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.3em] text-white transition hover:border-white/60"
          >
            Retry extraction
          </button>
        )}
      </div>
      {error ? <p className="mt-2 text-[11px] text-rose-200">{error}</p> : null}
    </div>
  );
}

type PendingTemplateStateProps = {
  status?: DocumentRecord["processing_status"];
  progress: number;
};

function PendingTemplateState({ status, progress }: PendingTemplateStateProps) {
  const isFailed = status === "failed";
  return (
    <div className="flex h-full flex-col items-center justify-center rounded-2xl border border-dashed border-white/15 bg-white/5 px-6 text-center text-sm text-slate-200">
      <div className="flex items-center justify-center gap-2 text-xs uppercase tracking-[0.3em] text-indigo-200">
        <Loader size={16} className="text-indigo-200" />
        <span>{isFailed ? "Extraction failed" : "Preparing template"}</span>
      </div>
      <p className="mt-3 text-xs text-slate-300">
        {isFailed ? "Retry extraction to continue." : "Hang tight while we map placeholders."}
      </p>
      <div className="mt-4 h-1.5 w-48 rounded-full bg-white/10">
        <div className="h-full rounded-full bg-indigo-400 transition-all" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}

function useOptimisticProgress(progress: number, totalChunks: number, isActive: boolean) {
  const [displayProgress, setDisplayProgress] = useState(progress);
  const displayRef = useRef(progress);

  useEffect(() => {
    setDisplayProgress(progress);
  }, [progress]);

  useEffect(() => {
    displayRef.current = displayProgress;
  }, [displayProgress]);

  useEffect(() => {
    if (!isActive) {
      setDisplayProgress(progress);
      return;
    }

    const chunkFraction = totalChunks > 0 ? 100 / totalChunks : 6;
    const optimisticCap = Math.min(99, progress + chunkFraction * 0.85);
    const step = Math.max(0.15, chunkFraction / 12);

    if (displayRef.current >= optimisticCap) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setDisplayProgress((current) => {
        if (current >= optimisticCap) {
          return current;
        }
        return Math.min(current + step, optimisticCap);
      });
    }, 750);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isActive, progress, totalChunks]);

  return Math.min(100, Math.max(0, displayProgress));
}

function FillPageFallback() {
  return (
    <div className="space-y-4">
      <div className="h-6 w-40 animate-pulse rounded-full bg-white/20" />
      <div className="h-32 animate-pulse rounded-3xl border border-white/10 bg-white/5" />
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
