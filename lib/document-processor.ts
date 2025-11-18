import { buildPlaceholderKeyUsage, chunkDocumentText, extractTemplateChunkRange, MAX_CHUNK_LENGTH } from "./extraction";
import {
  getDocumentById,
  updateDocumentProcessingState,
  updateTemplateJson,
  stripPrivateDocumentFields,
} from "./documents";
import type { DocumentRecord, ExtractedTemplate, InternalDocumentRecord } from "./types";

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
    const chunkTemplate = await extractTemplateChunkRange(chunks, nextChunk, resolvedBatchSize, {
      usageMap,
    });

    const mergedTemplate: ExtractedTemplate = {
      docAst: document.template_json.docAst.concat(chunkTemplate.docAst),
      placeholders: document.template_json.placeholders.concat(chunkTemplate.placeholders),
    };

    const processedChunks = nextChunk + resolvedBatchSize;
    const isComplete = processedChunks >= totalChunks;
    const progress = Math.min(100, Math.round((processedChunks / totalChunks) * 100));

    const updated = await updateTemplateJson(documentId, mergedTemplate, {
      processing_status: isComplete ? "ready" : "processing",
      processing_progress: progress,
      processing_total_chunks: totalChunks,
      processing_next_chunk: processedChunks,
      processing_error: null,
      plain_text: isComplete ? null : document.plain_text,
    });

    return {
      status: isComplete ? "ready" : "processing",
      document: updated ?? document,
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
