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
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-3xl font-semibold text-white">Upload a template</h1>
      <UploadCard
        document={document}
        uploading={uploading}
        error={error}
        onFileSelected={handleFileUpload}
        variant="hero"
        showDetails={false}
      />
    </div>
  );
}
