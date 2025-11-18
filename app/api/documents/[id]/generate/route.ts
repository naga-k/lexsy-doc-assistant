import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { getDocumentById, updateFilledBlobUrl } from "@/lib/documents";
import { fillDocxTemplate } from "@/lib/docx";
import { isTemplateComplete } from "@/lib/templates";

export const maxDuration = 60;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const document = await getDocumentById(id);
  if (!document) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  if (document.processing_status !== "ready") {
    return NextResponse.json(
      { error: "Template is still processing. Please try again shortly." },
      { status: 409 }
    );
  }

  if (!isTemplateComplete(document.template_json)) {
    return NextResponse.json(
      { error: "Please fill every required placeholder before generating the document." },
      { status: 400 }
    );
  }

  const templateResponse = await fetch(document.original_blob_url);
  if (!templateResponse.ok) {
    return NextResponse.json(
      { error: "Unable to read original template from storage." },
      { status: 500 }
    );
  }

  const templateBuffer = Buffer.from(await templateResponse.arrayBuffer());
  const replacements = document.template_json.placeholders
    .filter((placeholder) => placeholder.value)
    .map((placeholder) => ({
      raw: placeholder.raw,
      value: placeholder.value!,
    }));

  const filledBuffer = await fillDocxTemplate(templateBuffer, replacements);
  const filledBlobKey = `documents/${document.id}/filled-${Date.now()}.docx`;
  const filledBlob = await put(filledBlobKey, filledBuffer, {
    access: "public",
    contentType: document.mime_type,
  });

  await updateFilledBlobUrl(document.id, filledBlob.url);

  return NextResponse.json({
    document: {
      ...document,
      filled_blob_url: filledBlob.url,
    },
  });
}
