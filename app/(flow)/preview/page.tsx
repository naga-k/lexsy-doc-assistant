"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { DocumentRecord, ExtractedTemplate } from "@/lib/types";
import { generateDocument, requestDocument } from "@/lib/client-documents";
import { PreviewCard } from "@/components/workflow";
import { getTemplateCompletionRatio, isTemplateComplete } from "@/lib/templates";

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

  const completionRatio = useMemo(() => getTemplateCompletionRatio(template), [template]);

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
    <div className="space-y-4">
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
  return (
    <div className="space-y-4">
      <div className="h-6 w-32 animate-pulse rounded-full bg-white/20" />
      <div className="h-48 animate-pulse rounded-3xl border border-white/10 bg-white/5" />
    </div>
  );
}

function MissingDocState() {
  return (
    <div className="rounded-2xl border border-dashed border-white/20 bg-white/5 p-6 text-sm text-slate-300">
      Provide a <code className="text-white">docId</code> query parameter first. Use the upload page to create one.
    </div>
  );
}
