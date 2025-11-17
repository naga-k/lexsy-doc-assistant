"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { DocumentRecord } from "@/lib/types";
import { uploadDocument } from "@/lib/client-documents";
import { UploadCard } from "@/components/workflow";

const followupSteps = [
  {
    title: "Fill",
    description: "Chat through missing fields while comparing the live template.",
    badge: "Step 2",
  },
  {
    title: "Preview & export",
    description: "Generate the filled copy and download the latest .docx.",
    badge: "Step 3",
  },
];

export default function HomePage() {
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
    <div className="flex min-h-screen flex-col bg-slate-950 text-white">
      <div className="flex w-full items-center justify-between px-4 py-4 sm:px-8 lg:px-16">
        <Link
          href="/"
          className="text-sm font-semibold uppercase tracking-[0.4em] text-indigo-200"
        >
          Lexsy
        </Link>
      </div>

      <main className="flex-1 overflow-y-auto">
        <section className="mx-auto flex w-full max-w-4xl flex-col gap-10 px-4 py-16">
          <div className="space-y-4">
            <p className="text-xs uppercase tracking-[0.4em] text-indigo-200">Lexsy workflow</p>
          </div>

          <div className="grid gap-8 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
            <section className="space-y-4 rounded-3xl border border-white/15 bg-white/5 p-6">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-indigo-200">Step 1</p>
                <h2 className="mt-3 text-2xl font-semibold text-white">Upload your template</h2>
                <p className="mt-2 text-sm text-slate-300">
                  Start by sending a .docx contract or template. We extract placeholders instantly and
                  hand you off to the fill experience.
                </p>
              </div>
              <UploadCard
                document={document}
                uploading={uploading}
                error={error}
                onFileSelected={handleFileUpload}
                variant="hero"
                showDetails={false}
              />
            </section>

            <div className="space-y-6">
              {followupSteps.map((step) => (
                <div key={step.badge} className="rounded-2xl border border-white/15 bg-white/5 p-5">
                  <p className="text-xs uppercase tracking-[0.3em] text-indigo-200">{step.badge}</p>
                  <h3 className="mt-3 text-xl font-semibold text-white">{step.title}</h3>
                  <p className="mt-2 text-sm text-slate-300">{step.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
