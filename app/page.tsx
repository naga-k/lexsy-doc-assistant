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
    <div className="lexsy-shell flex min-h-screen flex-col">
      <header className="lexsy-nav">
        <div className="mx-auto flex w-full items-center justify-between px-4 py-4 sm:py-5">
          <Link href="/" className="flex items-center gap-3">
            <span className="sr-only">Lexsy</span>
            <img
              src="https://cdn.prod.website-files.com/65030261282cb8dc8d56f660/671dd7da409351203f94af52_Lexsy.png"
              alt="Lexsy"
              className="h-8 w-auto"
              loading="lazy"
              decoding="async"
            />
          </Link>
          <div className="flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.35em] text-lexsy-muted">
            <span className="hidden sm:inline">AI legal partner</span>
            <a href="https://stan.store/Lexsy" target="_blank" rel="noreferrer" className="lexsy-cta">
              Apply to Work With Us
            </a>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        <section className="mx-auto flex w-full flex-col gap-12 px-4 py-12 sm:py-16 lg:py-20">
          <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
            <div className="space-y-8">
              <div className="space-y-4">
                <p className="lexsy-eyebrow">Lexsy workflow</p>
                <div className="space-y-4">
                  <h1 className="text-4xl font-semibold leading-tight text-lexsy-ink sm:text-5xl">
                    Legal partner on your hero&apos;s journey
                  </h1>
                  <p className="text-base text-lexsy-muted sm:text-lg">
                    Upload the contract you&apos;re working on, watch us extract placeholders, then keep everything in sync while you
                    fill, preview, and export the polished .docx.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <a className="lexsy-outline-button" href="#upload-your-template">
                  Step 1 · Upload
                </a>
                <div className="lexsy-pill-group">
                  <span>Fill</span>
                  <span>Preview</span>
                  <span>Export</span>
                </div>
              </div>

              <div id="upload-your-template">
                <UploadCard
                  document={document}
                  uploading={uploading}
                  error={error}
                  onFileSelected={handleFileUpload}
                  showDetails={false}
                />
              </div>
            </div>

            <div className="space-y-6">
              <div className="lexsy-hero-visual">
                <img
                  src="https://cdn.prod.website-files.com/65030261282cb8dc8d56f660/669e8921529a7f101e0f65ee_5.png"
                  alt="Lexsy workflow preview"
                  loading="lazy"
                  decoding="async"
                />
              </div>
              <div className="grid gap-4">
                {followupSteps.map((step) => (
                  <div key={step.badge} className="lexsy-panel rounded-2xl p-5">
                    <p className="lexsy-chip text-[10px] tracking-[0.3em]">{step.badge}</p>
                    <h3 className="mt-3 text-xl font-semibold text-lexsy-ink">{step.title}</h3>
                    <p className="mt-2 text-sm text-lexsy-muted">{step.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
