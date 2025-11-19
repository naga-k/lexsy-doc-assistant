import { put } from "@vercel/blob";
import type { DocumentRecord, ExtractedTemplate } from "@/lib/types";
import { fillDocxTemplate } from "@/lib/docx";
import { updateFilledBlobUrl } from "@/lib/documents";
import { fillDocxWithSuperDoc } from "@/lib/superdoc-headless";
import type { SuperDocReplacement } from "@/lib/superdoc-headless";

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

  const superdocReplacements = filledPlaceholders.map((placeholder) => {
    const value = (placeholder.value ?? "").trim();
    if (!value) {
      return null;
    }
    const normalizedRaw = placeholder.raw?.replace(/\s+/g, " ").trim();
    const tokenSet = new Set<string>();

    const originalRaw = placeholder.context?.original_raw;
    if (typeof originalRaw === "string" && originalRaw.length > 0) {
      tokenSet.add(originalRaw);
      const trimmedOriginal = originalRaw.trim();
      if (trimmedOriginal && trimmedOriginal !== originalRaw) {
        tokenSet.add(trimmedOriginal);
      }
    }
    if (placeholder.raw) {
      tokenSet.add(placeholder.raw);
    }
    if (normalizedRaw && normalizedRaw !== placeholder.raw) {
      tokenSet.add(normalizedRaw);
    }
    if (placeholder.key) {
      tokenSet.add(`[${placeholder.key}]`);
      tokenSet.add(placeholder.key);
    }
    return {
      tokens: Array.from(tokenSet).filter(Boolean),
      value,
    };
  }).filter((entry): entry is SuperDocReplacement => Boolean(entry));

  let filledBuffer: Buffer | null = null;
  try {
    filledBuffer = await fillDocxWithSuperDoc(templateBuffer, superdocReplacements);
  } catch (superdocError) {
    console.error("SuperDoc headless fill failed, falling back to XML replacement", superdocError);
    const fallbackResult = await fillDocxTemplate(templateBuffer, replacements);
    filledBuffer = fallbackResult.buffer;
  }

  if (!filledBuffer) {
    filledBuffer = templateBuffer;
  }
  const blobKey = `documents/${document.id}/preview-${Date.now()}.docx`;
  const blob = await put(blobKey, filledBuffer, {
    access: "public",
    contentType: document.mime_type,
  });

  const updatedDocument = await updateFilledBlobUrl(document.id, blob.url);
  return updatedDocument;
}
