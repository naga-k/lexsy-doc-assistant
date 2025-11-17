import { NextResponse } from "next/server";
import { getDocumentById } from "@/lib/documents";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const document = await getDocumentById(id);
  if (!document || !document.filled_blob_url) {
    return NextResponse.json(
      { error: "Filled document is not available yet." },
      { status: 404 }
    );
  }

  const response = await fetch(document.filled_blob_url);
  if (!response.ok || !response.body) {
    return NextResponse.json(
      { error: "Unable to download document from blob storage." },
      { status: 500 }
    );
  }

  const filename = document.filename.replace(/\.docx$/i, "-filled.docx");
  const headers = new Headers(response.headers);
  headers.set("Content-Type", document.mime_type);
  headers.set("Content-Disposition", `attachment; filename="${filename}"`);

  return new NextResponse(response.body, { headers });
}
