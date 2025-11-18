import { NextResponse } from "next/server";
import { getDocumentById, stripPrivateDocumentFields, updateDocumentProcessingState } from "@/lib/documents";
import type { ExtractedTemplate } from "@/lib/types";

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
  if (!document.plain_text) {
    return NextResponse.json(
      {
        error: "Document text unavailable for processing.",
        document: stripPrivateDocumentFields(document),
      },
      { status: 400 }
    );
  }

  const resetTemplate: ExtractedTemplate = { docAst: [], placeholders: [] };
  const updated = await updateDocumentProcessingState(id, {
    processing_status: "pending",
    processing_progress: 0,
    processing_next_chunk: 0,
    processing_error: null,
    template_json: resetTemplate,
  });

  return NextResponse.json({ document: stripPrivateDocumentFields(updated ?? document) });
}
