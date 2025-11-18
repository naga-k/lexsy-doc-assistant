import { NextResponse } from "next/server";
import { processDocumentChunkBatch, toPublicDocument } from "@/lib/document-processor";

export const maxDuration = 60;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const result = await processDocumentChunkBatch(id);

  if (result.status === "missing") {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }
  if (result.status === "failed") {
    return NextResponse.json(
      {
        error: result.error ?? "Document processing failed.",
        document: toPublicDocument(result),
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ document: toPublicDocument(result) });
}
