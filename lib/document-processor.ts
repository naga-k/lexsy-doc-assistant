import { put } from "@vercel/blob";
import {
  buildPlaceholderKeyUsage,
  chunkDocumentText,
  deduplicatePlaceholderKeys,
  extractTemplateChunk,
  MAX_CHUNK_LENGTH,
} from "./extraction";
import {
  getDocumentById,
  updateDocumentProcessingState,
  updateTemplateJson,
  stripPrivateDocumentFields,
  updateOriginalBlobUrl,
} from "./documents";
import type { DocumentRecord, ExtractedTemplate, InternalDocumentRecord } from "./types";
import { fillDocxTemplate } from "./docx";

export type ProcessBatchStatus = "missing" | "ready" | "processing" | "failed";

export interface ProcessBatchResult {
  status: ProcessBatchStatus;
  document: InternalDocumentRecord | DocumentRecord | null;
  error?: string;
}

export interface ProcessBatchOptions {
  chunkBatchSize?: number;
}

const DEFAULT_CHUNK_BATCH_SIZE = Number(process.env.LEXSY_PROCESS_CHUNK_BATCH ?? "1");

export async function processDocumentChunkBatch(
  documentId: string,
  { chunkBatchSize }: ProcessBatchOptions = {}
): Promise<ProcessBatchResult> {
  const batchSize = Math.max(chunkBatchSize ?? DEFAULT_CHUNK_BATCH_SIZE, 1);
  const document = await getDocumentById(documentId, { includePlainText: true });
  if (!document) {
    return { status: "missing", document: null };
  }

  if (document.processing_status === "ready") {
    return { status: "ready", document };
  }

  if (!document.plain_text) {
    const failed = await updateDocumentProcessingState(documentId, {
      processing_status: "failed",
      processing_error: "Document text unavailable for processing.",
    });
    return {
      status: "failed",
      document: failed ?? document,
      error: "Document text unavailable for processing.",
    };
  }

  const chunks = chunkDocumentText(document.plain_text, MAX_CHUNK_LENGTH);
  const totalChunks = chunks.length || document.processing_total_chunks || 0;

  if (totalChunks === 0) {
    const readyRecord = await updateDocumentProcessingState(documentId, {
      processing_status: "ready",
      processing_progress: 100,
      processing_total_chunks: 0,
      processing_next_chunk: 0,
      plain_text: null,
    });
    return { status: "ready", document: readyRecord ?? document };
  }

  const nextChunk = document.processing_next_chunk ?? 0;
  if (nextChunk >= totalChunks) {
    const readyRecord = await updateDocumentProcessingState(documentId, {
      processing_status: "ready",
      processing_progress: 100,
      processing_total_chunks: totalChunks,
      processing_next_chunk: totalChunks,
      plain_text: null,
    });
    return { status: "ready", document: readyRecord ?? document };
  }

  const resolvedBatchSize = Math.min(batchSize, totalChunks - nextChunk);

  try {
    const usageMap = buildPlaceholderKeyUsage(document.template_json.placeholders);
    let latestTemplate: ExtractedTemplate = {
      docAst: document.template_json.docAst,
      placeholders: document.template_json.placeholders,
    };
    let latestDocument: InternalDocumentRecord | DocumentRecord = document;

    const chunkIndices = Array.from({ length: resolvedBatchSize }, (_, offset) => nextChunk + offset);

    const chunkResults = await Promise.all(
      chunkIndices.map(async (chunkIndex) => {
        const chunkStartTime = Date.now();
        console.info(`[documents.worker] Chunk processing start`, {
          documentId: document.id,
          chunkNumber: chunkIndex + 1,
          totalChunks,
          batchSize: resolvedBatchSize,
          timestamp: new Date(chunkStartTime).toISOString(),
        });

        const chunkTemplate = await extractTemplateChunk(chunks, chunkIndex, {
          usageMap,
        });

        return { chunkIndex, chunkTemplate, chunkStartTime };
      })
    );

    for (const { chunkIndex, chunkTemplate, chunkStartTime } of chunkResults) {
      if (!chunkTemplate) {
        break;
      }

      latestTemplate = {
        docAst: latestTemplate.docAst.concat(chunkTemplate.docAst),
        placeholders: latestTemplate.placeholders.concat(chunkTemplate.placeholders),
      };

      const processedChunks = chunkIndex + 1;
      const isComplete = processedChunks >= totalChunks;
      const progress = Math.min(100, Math.round((processedChunks / totalChunks) * 100));

      const updated = await updateTemplateJson(documentId, latestTemplate, {
        processing_status: "processing",
        processing_progress: progress,
        processing_total_chunks: totalChunks,
        processing_next_chunk: processedChunks,
        processing_error: null,
        plain_text: isComplete ? null : document.plain_text,
      });

      if (updated) {
        latestDocument = updated;
      }

      console.info(`[documents.worker] Chunk processing complete`, {
        documentId: document.id,
        chunkNumber: processedChunks,
        totalChunks,
        progress,
        status: "processing",
        durationMs: Date.now() - chunkStartTime,
        timestamp: new Date().toISOString(),
      });

      if (isComplete) {
        break;
      }
    }

    const extractedAllChunks =
      totalChunks > 0 && (latestDocument.processing_next_chunk ?? 0) >= totalChunks;

    if (extractedAllChunks) {
      // Deduplicate keys after parallel chunk processing to handle race conditions
      latestTemplate = deduplicatePlaceholderKeys(latestTemplate);

      // Save the deduplicated template to database
      const deduplicatedDoc = await updateTemplateJson(documentId, latestTemplate);
      if (deduplicatedDoc) {
        latestDocument = deduplicatedDoc;
      }

      let hydratedDocument: InternalDocumentRecord | DocumentRecord = latestDocument;
      try {
        const normalized = await normalizeOriginalDocument(latestDocument, latestTemplate);
        if (normalized) {
          hydratedDocument = normalized;
        }
      } catch (normalizationError) {
        console.error("Failed to normalize DOCX placeholders", normalizationError);
      }

      const readyRecord = await updateDocumentProcessingState(documentId, {
        processing_status: "ready",
        processing_progress: 100,
        processing_total_chunks: totalChunks,
        processing_next_chunk: totalChunks,
        processing_error: null,
        plain_text: null,
      });

      if (readyRecord) {
        latestDocument = readyRecord;
      } else {
        latestDocument = hydratedDocument;
      }
    }

    return {
      status: latestDocument.processing_status === "ready" ? "ready" : "processing",
      document: latestDocument,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown processing failure";
    const failed = await updateDocumentProcessingState(documentId, {
      processing_status: "failed",
      processing_error: message,
    });
    return {
      status: "failed",
      document: failed ?? document,
      error: message,
    };
  }
}

export function toPublicDocument(result: ProcessBatchResult): DocumentRecord | null {
  if (!result.document) {
    return null;
  }
  return stripPrivateDocumentFields(result.document as InternalDocumentRecord);
}

async function normalizeOriginalDocument(
  document: InternalDocumentRecord | DocumentRecord,
  template: ExtractedTemplate
): Promise<InternalDocumentRecord | DocumentRecord | null> {
  if (!document.original_blob_url) {
    return null;
  }

  const replacementConfigs = template.placeholders
    .map((placeholder) => {
      const canonicalToken = placeholder.raw ?? placeholder.key;
      if (!canonicalToken) {
        return null;
      }
      const tokens = collectNormalizationTokens(placeholder);
      if (tokens.length === 0) {
        return null;
      }
      return { tokens, value: canonicalToken };
    })
    .filter((entry): entry is { tokens: string[]; value: string } => Boolean(entry));

  if (replacementConfigs.length === 0) {
    return null;
  }

  const response = await fetch(document.original_blob_url);
  if (!response.ok) {
    throw new Error("Unable to fetch DOCX for placeholder normalization.");
  }
  const templateBuffer = Buffer.from(await response.arrayBuffer());

  const xmlReplacementEntries = buildXmlReplacementEntries(replacementConfigs);
  if (xmlReplacementEntries.length === 0) {
    throw new Error("No placeholder tokens available for normalization.");
  }

  const xmlResult = await fillDocxTemplate(templateBuffer, xmlReplacementEntries);
  if (!xmlResult.replacementsApplied) {
    throw new Error("XML placeholder normalization produced no changes.");
  }
  if (xmlResult.appliedCount !== xmlReplacementEntries.length) {
    console.warn("Placeholder normalization incomplete", {
      applied: xmlResult.appliedCount,
      expected: xmlReplacementEntries.length,
    });
  }

  const normalizedBuffer = xmlResult.buffer;
  const blobKey = `documents/${document.id}/normalized-${Date.now()}.docx`;
  const blob = await put(blobKey, normalizedBuffer, {
    access: "public",
    contentType: document.mime_type,
  });

  const updatedRecord = await updateOriginalBlobUrl(document.id, blob.url);
  if (!updatedRecord) {
    return null;
  }
  if ("plain_text" in document) {
    return updatedRecord;
  }
  return stripPrivateDocumentFields(updatedRecord);
}

function collectNormalizationTokens(placeholder: ExtractedTemplate["placeholders"][number]): string[] {
  const tokenSet = new Set<string>();

  const addTokenVariants = (token?: string | null) => {
    if (!token) {
      return;
    }
    if (token.length > 0) {
      tokenSet.add(token);
    }
    const trimmed = token.trim();
    if (trimmed && trimmed !== token) {
      tokenSet.add(trimmed);
    }
    const collapsed = trimmed.replace(/\s+/g, " ");
    if (collapsed && collapsed !== trimmed) {
      tokenSet.add(collapsed);
    }
  };

  addTokenVariants(placeholder.context?.original_raw);

  if (tokenSet.size === 0) {
    if (placeholder.raw && looksLikePlaceholderToken(placeholder.raw)) {
      addTokenVariants(placeholder.raw);
    } else if (placeholder.key && looksLikePlaceholderToken(placeholder.key)) {
      addTokenVariants(placeholder.key);
    }
  }

  return Array.from(tokenSet).filter((token) => token.length > 0);
}

function looksLikePlaceholderToken(token: string): boolean {
  return /[\[\]\{\}\(\)<>$]|_{2,}/.test(token);
}

function buildXmlReplacementEntries(
  configs: Array<{ tokens: string[]; value: string }>
): Array<{ raw: string; value: string }> {
  const entries: Array<{ raw: string; value: string }> = [];
  for (const config of configs) {
    const preferredToken = config.tokens[0];
    if (!preferredToken) {
      continue;
    }
    entries.push({ raw: preferredToken, value: config.value });
  }
  return entries;
}
