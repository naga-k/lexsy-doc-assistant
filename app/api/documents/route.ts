import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { put } from "@vercel/blob";
import { insertDocument, stripPrivateDocumentFields } from "@/lib/documents";
import { extractRawText } from "@/lib/docx";
import { chunkDocumentText, MAX_CHUNK_LENGTH } from "@/lib/extraction";
import type { ExtractedTemplate } from "@/lib/types";

export const maxDuration = 60;

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  if (file.type !== "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    return NextResponse.json(
      { error: "Only .docx files are supported." },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const id = randomUUID();
  const blobKey = `documents/${id}/${file.name}`;

  const blob = await put(blobKey, buffer, {
    access: "public",
    contentType: file.type,
  });

  const plainText = await extractRawText(buffer);
  const chunks = chunkDocumentText(plainText, MAX_CHUNK_LENGTH);
  const totalChunks = chunks.length;
  const initialStatus = totalChunks === 0 ? "ready" : "pending";
  const initialProgress = totalChunks === 0 ? 100 : 0;
  const initialTemplate: ExtractedTemplate = { docAst: [], placeholders: [] };

  const document = await insertDocument({
    id,
    filename: file.name,
    mime_type: file.type,
    original_blob_url: blob.url,
    filled_blob_url: null,
    template_json: initialTemplate,
    plain_text: totalChunks === 0 ? null : plainText,
    processing_status: initialStatus,
    processing_progress: initialProgress,
    processing_total_chunks: totalChunks,
    processing_next_chunk: 0,
    processing_error: null,
  });

  return NextResponse.json({ document: stripPrivateDocumentFields(document) });
}
