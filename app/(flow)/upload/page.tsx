'use client';

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import type { DocumentRecord } from "@/lib/types";
import { UploadCard } from "@/components/workflow";
import { uploadDocument } from "@/lib/client-documents";

export default function UploadPage() {
  const router = useRouter();
  const [document, setDocument] = useState<DocumentRecord | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = useCallback(
    async (file: File | null) => {
      if (!file) return;
      setUploading(true);
      setError(null);
      try {
        const nextDocument = await uploadDocument(file);
        setDocument(nextDocument);
        router.push(`/fill?docId=${nextDocument.id}`);
      } catch (uploadError) {
        setError((uploadError as Error).message);
      } finally {
        setUploading(false);
      }
    },
    [router]
  );

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <p className="text-xs uppercase tracking-[0.4em] text-indigo-200">Screen one</p>
        <h1 className="text-3xl font-semibold text-white">Upload a template</h1>
        <p className="text-sm text-slate-300">
          Drop a .docx file. We extract placeholders and hand you a link to move straight into the fill
          screen.
        </p>
      </header>

      <UploadCard document={document} uploading={uploading} error={error} onFileSelected={handleFileUpload} />

      <section className="rounded-2xl border border-white/15 bg-white/5 p-5 text-sm text-slate-200">
        {document ? (
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.3em] text-indigo-200">Latest upload</p>
            <p className="text-base font-medium text-white">{document.filename}</p>
            <p>
              Continue to the fill screen to start chatting: <span className="font-semibold">/fill?docId={document.id}</span>
            </p>
          </div>
        ) : (
          <p>Need a hint? Start with the SAFE template you sketched and we will mirror it exactly.</p>
        )}
      </section>
    </div>
  );
}
