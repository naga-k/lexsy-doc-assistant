"use client";

import { useCallback, useState } from "react";
import Image from "next/image";
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
        <div className="mx-auto flex w-full items-center px-4 py-4 sm:py-5">
          <Link href="/" className="inline-flex items-center">
            <span className="sr-only">Lexsy</span>
            <Image
              src="https://cdn.prod.website-files.com/65030261282cb8dc8d56f660/671dd7da409351203f94af52_Lexsy.png"
              alt="Lexsy"
              width={155}
              height={40}
              className="h-8 w-auto"
              priority={false}
              unoptimized
            />
          </Link>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        <section className="mx-auto flex w-full flex-col gap-12 px-4 py-12 sm:py-16 lg:py-20">
          <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <div className="space-y-8">
              <div className="space-y-4">
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

              <div id="upload-your-template" className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                <div className="lexsy-panel h-full rounded-3xl p-6">
                  <p className="lexsy-chip text-[10px] tracking-[0.3em]">Step 1</p>
                  <h3 className="mt-3 text-xl font-semibold text-lexsy-ink">Upload</h3>
                  <p className="mt-2 text-sm text-lexsy-muted">Drag &amp; drop or browse for a .docx to start.</p>
                  <div className="mt-4">
                    <UploadCard
                      document={document}
                      uploading={uploading}
                      error={error}
                      onFileSelected={handleFileUpload}
                      variant="hero"
                      showDetails={false}
                    />
                  </div>
                </div>
                <div className="space-y-4">
                  {followupSteps.map((step) => (
                    <div key={step.badge} className="lexsy-panel rounded-3xl p-5">
                      <p className="lexsy-chip text-[10px] tracking-[0.3em]">{step.badge}</p>
                      <h3 className="mt-3 text-xl font-semibold text-lexsy-ink">{step.title}</h3>
                      <p className="mt-2 text-sm text-lexsy-muted">{step.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="lexsy-hero-visual">
                <div className="relative aspect-4/3 w-full">
                  <Image
                    src="https://cdn.prod.website-files.com/65030261282cb8dc8d56f660/669e8921529a7f101e0f65ee_5.png"
                    alt="Lexsy team candid"
                    fill
                    sizes="(min-width: 1024px) 40vw, 100vw"
                    className="object-cover"
                    unoptimized
                  />
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
