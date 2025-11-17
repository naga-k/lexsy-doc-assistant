import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { put } from "@vercel/blob";
import { insertDocument } from "@/lib/documents";
import { extractRawText } from "@/lib/docx";
import { extractTemplateFromText } from "@/lib/extraction";
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
  const template: ExtractedTemplate = await extractTemplateFromText(plainText);

  const document = await insertDocument({
    id,
    filename: file.name,
    mime_type: file.type,
    original_blob_url: blob.url,
    filled_blob_url: null,
    template_json: template,
  });

  return NextResponse.json({ document });
}
