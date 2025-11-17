"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { DocumentRecord, ExtractedTemplate } from "@/lib/types";
import { requestDocument } from "@/lib/client-documents";
import { ChatPanel, DocumentPreviewWindow, PlaceholderTable } from "@/components/workflow";
import clsx from "clsx";
import { useFlowSession } from "../flow-session-context";
import { getTemplateCompletionRatio } from "@/lib/templates";

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
  const router = useRouter();
  const [document, setDocument] = useState<DocumentRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

  const handleJumpToPreview = useCallback(() => {
    if (!docId) return;
    router.push(`/preview?docId=${docId}`);
  }, [docId, router]);

  return (
    <div className="flex h-screen min-h-0 flex-col gap-1 overflow-hidden px-2 py-4 sm:px-4 lg:px-5">
      {!docId ? (
        <MissingDocState />
      ) : loading ? (
        <p className="text-sm text-slate-300">Loading document…</p>
      ) : error ? (
        <p className="text-sm text-rose-300">{error}</p>
      ) : (
        <div className="flex flex-1 min-h-0 flex-col gap-2 sm:gap-3">
          <FillTopBar
            activePane={activePane}
            onPaneChange={setActivePane}
            onJumpToPreview={handleJumpToPreview}
            previewDisabled={!docId}
            completionRatio={completionRatio}
          />
          <div className="grid flex-1 min-h-0 gap-3 lg:grid-cols-[minmax(0,0.6fr)_minmax(0,0.4fr)]">
            <div className="flex min-h-0 flex-col gap-3 overflow-hidden p-1 sm:p-2">
              <div className="flex-1 min-h-0 overflow-hidden">
                {activePane === "document" ? (
                  <DocumentPreviewWindow template={template} />
                ) : (
                  <PlaceholderTable template={template} />
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
  onJumpToPreview: () => void;
  previewDisabled: boolean;
  completionRatio: number;
};

function FillTopBar({
  activePane,
  onPaneChange,
  onJumpToPreview,
  previewDisabled,
  completionRatio,
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
        onClick={onJumpToPreview}
        className="inline-flex items-center rounded-full border border-white/20 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/80 transition hover:border-white/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
        disabled={previewDisabled}
      >
        Jump to preview
      </button>
    </div>
  );
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
