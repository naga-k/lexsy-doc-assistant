import { sql } from "@vercel/postgres";
import type { ExtractedTemplate, DocumentRecord } from "./types";

type DocumentRow = Omit<DocumentRecord, "template_json"> & {
  template_json: ExtractedTemplate | string;
};

let tableReady: Promise<void> | null = null;

async function ensureDocumentsTable() {
  if (!tableReady) {
    tableReady = sql`
      CREATE TABLE IF NOT EXISTS documents (
        id text PRIMARY KEY,
        filename text NOT NULL,
        mime_type text NOT NULL,
        original_blob_url text NOT NULL,
        filled_blob_url text,
        template_json jsonb NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      );
    `.then(() => undefined);
  }

  return tableReady;
}

export async function insertDocument(
  doc: Omit<DocumentRecord, "created_at">
): Promise<DocumentRecord> {
  await ensureDocumentsTable();
  const templateJson = JSON.stringify(doc.template_json);
  const result = await sql<DocumentRow>`
    INSERT INTO documents (id, filename, mime_type, original_blob_url, filled_blob_url, template_json)
    VALUES (${doc.id}, ${doc.filename}, ${doc.mime_type}, ${doc.original_blob_url}, ${doc.filled_blob_url}, ${templateJson}::jsonb)
    RETURNING *;
  `;
  return normalizeRecord(result.rows[0]);
}

export async function getDocumentById(id: string): Promise<DocumentRecord | null> {
  await ensureDocumentsTable();
  const result = await sql<DocumentRow>`
    SELECT * FROM documents WHERE id = ${id} LIMIT 1;
  `;
  if (!result.rows[0]) {
    return null;
  }
  return normalizeRecord(result.rows[0]);
}

export async function updateTemplateJson(
  id: string,
  template: ExtractedTemplate
): Promise<DocumentRecord | null> {
  await ensureDocumentsTable();
  const templateJson = JSON.stringify(template);
  const result = await sql<DocumentRow>`
    UPDATE documents
    SET template_json = ${templateJson}::jsonb
    WHERE id = ${id}
    RETURNING *;
  `;
  if (!result.rows[0]) {
    return null;
  }
  return normalizeRecord(result.rows[0]);
}

export async function updateFilledBlobUrl(
  id: string,
  url: string
): Promise<DocumentRecord | null> {
  await ensureDocumentsTable();
  const result = await sql<DocumentRow>`
    UPDATE documents
    SET filled_blob_url = ${url}
    WHERE id = ${id}
    RETURNING *;
  `;
  if (!result.rows[0]) {
    return null;
  }
  return normalizeRecord(result.rows[0]);
}

function normalizeRecord(row: DocumentRow): DocumentRecord {
  const template =
    typeof row.template_json === "string"
      ? (JSON.parse(row.template_json) as ExtractedTemplate)
      : (row.template_json as ExtractedTemplate);
  return {
    ...row,
    template_json: template,
  };
}
