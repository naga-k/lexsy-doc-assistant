import { NextResponse } from "next/server";
import {
  buildPlaceholderKeyUsage,
  chunkDocumentText,
  extractTemplateChunkRange,
  MAX_CHUNK_LENGTH,
} from "@/lib/extraction";
import {
  getDocumentById,
  stripPrivateDocumentFields,
  updateDocumentProcessingState,
  updateTemplateJson,
} from "@/lib/documents";
import type { ExtractedTemplate } from "@/lib/types";

const CHUNKS_PER_REQUEST = Number(process.env.LEXSY_PROCESS_CHUNK_BATCH ?? "1");

export const maxDuration = 60;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const document = await getDocumentById(id, { includePlainText: true });
  if (!document) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  if (document.processing_status === "ready") {
    return NextResponse.json({ document: stripPrivateDocumentFields(document) });
  }

  if (!document.plain_text) {
    return NextResponse.json(
      { error: "Document text unavailable for processing." },
      { status: 400 }
    );
  }

  const chunks = chunkDocumentText(document.plain_text, MAX_CHUNK_LENGTH);
  const totalChunks = chunks.length || document.processing_total_chunks || 0;

  if (totalChunks === 0) {
    const readyRecord = await updateDocumentProcessingState(id, {
      processing_status: "ready",
      processing_progress: 100,
      processing_total_chunks: 0,
      processing_next_chunk: 0,
      plain_text: null,
    });
    return NextResponse.json({ document: stripPrivateDocumentFields(readyRecord ?? document) });
  }

  const nextChunk = document.processing_next_chunk ?? 0;
  if (nextChunk >= totalChunks) {
    const readyRecord = await updateDocumentProcessingState(id, {
      processing_status: "ready",
      processing_progress: 100,
      processing_total_chunks: totalChunks,
      processing_next_chunk: totalChunks,
      plain_text: null,
    });
    return NextResponse.json({ document: stripPrivateDocumentFields(readyRecord ?? document) });
  }

  const batchSize = Math.min(Math.max(CHUNKS_PER_REQUEST, 1), totalChunks - nextChunk);
  try {
    const usageMap = buildPlaceholderKeyUsage(document.template_json.placeholders);
    const chunkTemplate = await extractTemplateChunkRange(chunks, nextChunk, batchSize, {
      usageMap,
    });

    const mergedTemplate: ExtractedTemplate = {
      docAst: document.template_json.docAst.concat(chunkTemplate.docAst),
      placeholders: document.template_json.placeholders.concat(chunkTemplate.placeholders),
    };

    const processedChunks = nextChunk + batchSize;
    const isComplete = processedChunks >= totalChunks;
    const progress = Math.min(100, Math.round((processedChunks / totalChunks) * 100));

    const updated = await updateTemplateJson(id, mergedTemplate, {
      processing_status: isComplete ? "ready" : "processing",
      processing_progress: progress,
      processing_total_chunks: totalChunks,
      processing_next_chunk: processedChunks,
      processing_error: null,
      plain_text: isComplete ? null : document.plain_text,
    });

    return NextResponse.json({ document: stripPrivateDocumentFields(updated ?? document) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown processing failure";
    const failed = await updateDocumentProcessingState(id, {
      processing_status: "failed",
      processing_error: message,
    });
    return NextResponse.json(
      { error: "Document processing failed.", document: stripPrivateDocumentFields(failed ?? document) },
      { status: 500 }
    );
  }
}
