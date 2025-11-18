import { NextResponse } from "next/server";
import { getDocumentById, stripPrivateDocumentFields, updateTemplateJson } from "@/lib/documents";
import { applyPlaceholderUpdates } from "@/lib/templates";
import { regenerateDocumentPreview } from "@/lib/document-preview";

interface PlaceholderUpdateRequest {
  updates?: Record<string, unknown>;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as PlaceholderUpdateRequest | null;
  const rawUpdates = body?.updates;

  if (!rawUpdates || typeof rawUpdates !== "object") {
    return NextResponse.json({ error: "Missing placeholder updates." }, { status: 400 });
  }

  const sanitizedUpdates = Object.entries(rawUpdates).reduce((acc, [key, value]) => {
    if (!key || typeof value !== "string") {
      return acc;
    }
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return acc;
    }
    acc[key] = trimmed;
    return acc;
  }, {} as Record<string, string>);

  if (Object.keys(sanitizedUpdates).length === 0) {
    return NextResponse.json({ error: "Provide at least one non-empty value." }, { status: 400 });
  }

  const document = await getDocumentById(id);
  if (!document) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }

  const nextTemplate = applyPlaceholderUpdates(document.template_json, sanitizedUpdates);
  const updatedRecord = await updateTemplateJson(id, nextTemplate);
  if (!updatedRecord) {
    return NextResponse.json({ error: "Unable to persist placeholder values." }, { status: 500 });
  }

  let refreshed = null;
  try {
    refreshed = await regenerateDocumentPreview(document, nextTemplate);
  } catch (previewError) {
    console.error("Live preview refresh failed", previewError);
  }

  const responseDocument = refreshed ?? {
    ...stripPrivateDocumentFields(updatedRecord),
  };

  return NextResponse.json({ document: responseDocument });
}
