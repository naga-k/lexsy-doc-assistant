'use client';

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import type { DocumentRecord } from "@/lib/types";
import { UploadCard } from "@/components/workflow";
import { uploadDocument } from "@/lib/client-documents";

const heroHighlights = [
  { label: "Avg. parse time", value: "12s" },
  { label: "Max file size", value: "25 MB" },
  { label: "Privacy tier", value: "SOC 2-ready" },
];

const assuranceItems = [
  {
    title: "Live Lexsy pipeline",
    description: "Every upload hits the same extractor powering lexsy.ai, so formatting and numbering stay intact.",
  },
  {
    title: "docId handoff link",
    description: "We respond with a shareable identifier that opens straight into Fill and Preview screens.",
  },
  {
    title: "Secure storage",
    description: "Files are encrypted in Vercel Blob with automatic expiry once you export the final document.",
  },
];

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
    <div className="space-y-10">
      <section className="rounded-3xl border border-white/15 bg-white/5 px-6 py-10 shadow-[0_35px_90px_rgba(2,6,23,0.65)] backdrop-blur md:px-10">
        <div className="grid gap-10 lg:grid-cols-[1.05fr,0.95fr]">
          <div className="space-y-6">
            <p className="text-xs uppercase tracking-[0.4em] text-indigo-200">Stage 01 · Upload</p>
            <div className="space-y-4">
              <h1 className="text-4xl font-semibold text-white">Bring the same template your team runs in Lexsy.</h1>
              <p className="text-base text-slate-200">
                Drag in the live .docx and we preserve pagination, numbering, and hidden placeholders. The
                second the upload finishes you get a docId link for Fill and Preview—no extra setup.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {heroHighlights.map((stat) => (
                <div key={stat.label} className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
                  <p className="text-xs uppercase tracking-[0.4em] text-indigo-200">{stat.label}</p>
                  <p className="mt-2 text-2xl font-semibold text-white">{stat.value}</p>
                </div>
              ))}
            </div>
          </div>
          <UploadCard document={document} uploading={uploading} error={error} onFileSelected={handleFileUpload} variant="hero" />
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.05fr,0.95fr]">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-slate-100">
          <p className="text-xs uppercase tracking-[0.4em] text-indigo-200">What happens next</p>
          <ul className="mt-4 space-y-4 text-sm text-slate-200">
            {assuranceItems.map((item) => (
              <li key={item.title} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-base font-medium text-white">{item.title}</p>
                <p className="mt-1 text-slate-300">{item.description}</p>
              </li>
            ))}
          </ul>
        </div>
        <section className="rounded-3xl border border-white/15 bg-linear-to-br from-white/5 via-white/0 to-white/10 p-6 text-sm text-slate-200">
          {document ? (
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-[0.4em] text-indigo-200">Latest upload</p>
              <p className="text-2xl font-semibold text-white">{document.filename}</p>
              <div className="grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-left text-xs uppercase tracking-[0.3em] text-slate-300">
                <span>docId</span>
                <p className="text-base font-semibold text-white normal-case tracking-normal">{document.id}</p>
              </div>
              <p className="text-slate-300">
                Continue to Fill with <span className="font-semibold text-white">/fill?docId={document.id}</span> or preview the final copy any time via Preview.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-[0.4em] text-indigo-200">Need inspiration?</p>
              <p className="text-base text-slate-200">
                Upload the same SAFE template your team already trusts on lexsy.ai—this environment mirrors the real product so nothing feels like a mock.
              </p>
              <p className="text-xs text-slate-400">You&apos;ll see the docId and deep link here after the first upload.</p>
            </div>
          )}
        </section>
      </section>
    </div>
  );
}
