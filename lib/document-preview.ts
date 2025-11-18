import { put } from "@vercel/blob";
import type { DocumentRecord, ExtractedTemplate } from "@/lib/types";
import { fillDocxTemplate } from "@/lib/docx";
import { updateFilledBlobUrl } from "@/lib/documents";

export async function regenerateDocumentPreview(
  document: DocumentRecord,
  template: ExtractedTemplate
): Promise<DocumentRecord | null> {
  if (!document.original_blob_url) {
    return null;
  }

  const response = await fetch(document.original_blob_url);
  if (!response.ok) {
    throw new Error("Unable to fetch original template for preview generation.");
  }

  const templateBuffer = Buffer.from(await response.arrayBuffer());
  const replacements = template.placeholders
    .filter((placeholder) => Boolean(placeholder.value))
    .map((placeholder) => ({
      raw: placeholder.raw ?? placeholder.key,
      value: placeholder.value ?? "",
    }));

  const filledBuffer = await fillDocxTemplate(templateBuffer, replacements);
  const blobKey = `documents/${document.id}/preview-${Date.now()}.docx`;
  const blob = await put(blobKey, filledBuffer, {
    access: "public",
    contentType: document.mime_type,
  });

  const updatedDocument = await updateFilledBlobUrl(document.id, blob.url);
  return updatedDocument;
}
