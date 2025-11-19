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

  const filledPlaceholders = template.placeholders.filter(
    (placeholder) => typeof placeholder.value === "string" && placeholder.value.trim().length > 0
  );

  const replacements = filledPlaceholders.map((placeholder) => {
    const value = (placeholder.value ?? "").trim();
    return {
      raw: placeholder.raw ?? placeholder.key,
      key: placeholder.key,
      value,
    };
  });

  const { buffer: filledBuffer, replacementsApplied } = await fillDocxTemplate(
    templateBuffer,
    replacements
  );

  if (!replacementsApplied) {
    console.warn("regenerateDocumentPreview produced no placeholder replacements", {
      documentId: document.id,
      placeholderCount: replacements.length,
    });
  }
  const blobKey = `documents/${document.id}/preview-${Date.now()}.docx`;
  const blob = await put(blobKey, filledBuffer, {
    access: "public",
    contentType: document.mime_type,
  });

  const updatedDocument = await updateFilledBlobUrl(document.id, blob.url);
  return updatedDocument;
}
