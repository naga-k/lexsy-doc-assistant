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
    <div className="flex h-full flex-1 min-h-0 flex-col gap-2 overflow-hidden px-2 py-4 text-lexsy-ink sm:px-4 lg:px-5">
      {!docId ? (
        <MissingDocState />
      ) : loading ? (
        <p className="text-sm text-lexsy-muted">Loading document…</p>
      ) : error ? (
        <p className="text-sm text-[#e4587c]">{error}</p>
      ) : (
        <div className="flex flex-1 min-h-0 flex-col gap-3">
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
            <div className="flex h-full min-h-0 flex-col overflow-hidden">
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
            <div className="flex h-full min-h-0 flex-col overflow-hidden">
              <ChatPanel
                document={document}
                onTemplateUpdated={handleTemplateUpdated}
                className="h-full min-h-0"
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
    <div className="lexsy-panel rounded-3xl px-3 py-2 text-[11px] text-lexsy-muted">
      <div className="flex flex-wrap items-center gap-3">
        <div className="lexsy-pill-toggle-group">
          {(["document", "placeholders"] as Pane[]).map((pane) => (
            <button
              key={pane}
              type="button"
              onClick={() => onPaneChange(pane)}
              className={clsx(
                "lexsy-pill-toggle",
                activePane === pane && "lexsy-pill-toggle-active"
              )}
            >
              {pane === "document" ? "Document" : "Placeholders"}
            </button>
          ))}
        </div>
        <div className="flex flex-1 min-w-[180px] items-center gap-2">
          <div className="lexsy-progress-track h-1 flex-1">
            <div
              className="lexsy-progress-fill transition-all"
              style={{ width: `${completionRatio}%` }}
            />
          </div>
          <span className="font-semibold tabular-nums text-lexsy-ink">{completionRatio}%</span>
        </div>
        <button
          type="button"
          onClick={() => {
            if (!downloadHref) return;
            window.location.assign(downloadHref);
          }}
          className="lexsy-outline-button inline-flex items-center gap-2 px-4! py-1.5! text-[10px] tracking-[0.3em] disabled:cursor-not-allowed disabled:opacity-40"
          disabled={!downloadHref}
        >
          Download DOCX
        </button>
      </div>
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
    <div className="lexsy-panel-soft rounded-2xl border border-(--lexsy-border-strong) px-4 py-3 text-xs text-lexsy-muted">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-[10px] font-semibold uppercase tracking-[0.25em] text-(--lexsy-rose)">
          {statusLabel}
        </span>
        {!isFailed ? (
          <div className="flex min-w-40 flex-1 items-center gap-2 text-[11px]">
            <div className="lexsy-progress-track h-1.5 flex-1">
              <div className="lexsy-progress-fill transition-all" style={{ width: `${progress}%` }} />
            </div>
            <span className="font-semibold tabular-nums">{Math.round(progress)}%</span>
          </div>
        ) : (
          <button
            type="button"
            onClick={onRetry}
            className="lexsy-outline-button inline-flex items-center px-4! py-1.5! text-[10px] tracking-[0.3em]"
          >
            Retry extraction
          </button>
        )}
      </div>
      {error ? <p className="mt-2 text-[11px] text-[#e4587c]">{error}</p> : null}
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
    <div className="lexsy-panel-dashed flex h-full flex-col items-center justify-center rounded-2xl px-6 text-center text-sm text-lexsy-muted">
      <div className="flex items-center justify-center gap-2 text-xs uppercase tracking-[0.3em] text-(--lexsy-rose)">
        <Loader size={16} className="text-(--lexsy-rose)" />
        <span>{isFailed ? "Extraction failed" : "Preparing template"}</span>
      </div>
      <p className="mt-3 text-xs text-lexsy-muted">
        {isFailed ? "Retry extraction to continue." : "Hang tight while we map placeholders."}
      </p>
      <div className="lexsy-progress-track mt-4 h-1.5 w-48">
        <div className="lexsy-progress-fill transition-all" style={{ width: `${progress}%` }} />
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
      <div className="h-6 w-40 animate-pulse rounded-full bg-(--lexsy-cloud)" />
      <div className="lexsy-panel h-32 animate-pulse rounded-3xl" />
    </div>
  );
}

function MissingDocState() {
  return (
    <div className="lexsy-panel-dashed rounded-2xl p-6 text-sm text-lexsy-muted">
      Provide a <code className="text-lexsy-ink">docId</code> query parameter, e.g. <span className="font-semibold text-lexsy-ink">/fill?docId=&lt;id&gt;</span>.
      You can obtain one from the upload screen.
    </div>
  );
}
