import { sql, type SQL } from "@vercel/postgres";
import type {
  ExtractedTemplate,
  DocumentProcessingStatus,
  DocumentRecord,
  InternalDocumentRecord,
} from "./types";

type DocumentRow = Omit<InternalDocumentRecord, "template_json"> & {
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
        created_at timestamptz NOT NULL DEFAULT now(),
        plain_text text,
        processing_status text NOT NULL DEFAULT 'pending',
        processing_progress integer NOT NULL DEFAULT 0,
        processing_total_chunks integer NOT NULL DEFAULT 0,
        processing_next_chunk integer NOT NULL DEFAULT 0,
        processing_error text
      );
    `.then(() => undefined);
    await tableReady;
    await sql`
      ALTER TABLE documents
      ADD COLUMN IF NOT EXISTS plain_text text;
    `;
    await sql`
      ALTER TABLE documents
      ADD COLUMN IF NOT EXISTS processing_status text NOT NULL DEFAULT 'pending';
    `;
    await sql`
      ALTER TABLE documents
      ADD COLUMN IF NOT EXISTS processing_progress integer NOT NULL DEFAULT 0;
    `;
    await sql`
      ALTER TABLE documents
      ADD COLUMN IF NOT EXISTS processing_total_chunks integer NOT NULL DEFAULT 0;
    `;
    await sql`
      ALTER TABLE documents
      ADD COLUMN IF NOT EXISTS processing_next_chunk integer NOT NULL DEFAULT 0;
    `;
    await sql`
      ALTER TABLE documents
      ADD COLUMN IF NOT EXISTS processing_error text;
    `;
  }

  return tableReady;
}

export type InsertableDocument = Omit<InternalDocumentRecord, "created_at">;

export async function insertDocument(doc: InsertableDocument): Promise<InternalDocumentRecord> {
  await ensureDocumentsTable();
  const templateJson = JSON.stringify(doc.template_json);
  const result = await sql<DocumentRow>`
    INSERT INTO documents (
      id,
      filename,
      mime_type,
      original_blob_url,
      filled_blob_url,
      template_json,
      plain_text,
      processing_status,
      processing_progress,
      processing_total_chunks,
      processing_next_chunk,
      processing_error
    )
    VALUES (
      ${doc.id},
      ${doc.filename},
      ${doc.mime_type},
      ${doc.original_blob_url},
      ${doc.filled_blob_url},
      ${templateJson}::jsonb,
      ${doc.plain_text},
      ${doc.processing_status},
      ${doc.processing_progress},
      ${doc.processing_total_chunks},
      ${doc.processing_next_chunk},
      ${doc.processing_error}
    )
    RETURNING *;
  `;
  return normalizeRecord(result.rows[0]);
}

export async function getDocumentById(
  id: string,
  options: { includePlainText: true }
): Promise<InternalDocumentRecord | null>;
export async function getDocumentById(
  id: string,
  options?: { includePlainText?: false }
): Promise<DocumentRecord | null>;
export async function getDocumentById(
  id: string,
  options?: { includePlainText?: boolean }
): Promise<InternalDocumentRecord | DocumentRecord | null> {
  await ensureDocumentsTable();
  const result = await sql<DocumentRow>`
    SELECT * FROM documents WHERE id = ${id} LIMIT 1;
  `;
  if (!result.rows[0]) {
    return null;
  }
  const record = normalizeRecord(result.rows[0]);
  if (options?.includePlainText) {
    return record;
  }
  return stripPrivateDocumentFields(record);
}

export async function updateTemplateJson(
  id: string,
  template: ExtractedTemplate,
  options?: Partial<{
    processing_status: DocumentProcessingStatus;
    processing_progress: number;
    processing_total_chunks: number;
    processing_next_chunk: number;
    processing_error: string | null;
    plain_text: string | null;
  }>
): Promise<InternalDocumentRecord | null> {
  await ensureDocumentsTable();
  const templateJson = JSON.stringify(template);
  const fields = [sql`template_json = ${templateJson}::jsonb`];
  if (typeof options?.processing_status !== "undefined") {
    fields.push(sql`processing_status = ${options.processing_status}`);
  }
  if (typeof options?.processing_progress !== "undefined") {
    fields.push(sql`processing_progress = ${options.processing_progress}`);
  }
  if (typeof options?.processing_total_chunks !== "undefined") {
    fields.push(sql`processing_total_chunks = ${options.processing_total_chunks}`);
  }
  if (typeof options?.processing_next_chunk !== "undefined") {
    fields.push(sql`processing_next_chunk = ${options.processing_next_chunk}`);
  }
  if (typeof options?.processing_error !== "undefined") {
    fields.push(sql`processing_error = ${options.processing_error}`);
  }
  if (typeof options?.plain_text !== "undefined") {
    fields.push(sql`plain_text = ${options.plain_text}`);
  }
  const setClause = joinSqlFields(fields);
  const result = await sql<DocumentRow>`
    UPDATE documents
    SET ${setClause}
    WHERE id = ${id}
    RETURNING *;
  `;
  if (!result.rows[0]) {
    return null;
  }
  return normalizeRecord(result.rows[0]);
}

export async function updateDocumentProcessingState(
  id: string,
  updates: Partial<{
    processing_status: DocumentProcessingStatus;
    processing_progress: number;
    processing_total_chunks: number;
    processing_next_chunk: number;
    processing_error: string | null;
    plain_text: string | null;
    template_json: ExtractedTemplate;
  }>
): Promise<InternalDocumentRecord | null> {
  await ensureDocumentsTable();
  const fields = [] as ReturnType<typeof sql>[];
  if (typeof updates.processing_status !== "undefined") {
    fields.push(sql`processing_status = ${updates.processing_status}`);
  }
  if (typeof updates.processing_progress !== "undefined") {
    fields.push(sql`processing_progress = ${updates.processing_progress}`);
  }
  if (typeof updates.processing_total_chunks !== "undefined") {
    fields.push(sql`processing_total_chunks = ${updates.processing_total_chunks}`);
  }
  if (typeof updates.processing_next_chunk !== "undefined") {
    fields.push(sql`processing_next_chunk = ${updates.processing_next_chunk}`);
  }
  if (typeof updates.processing_error !== "undefined") {
    fields.push(sql`processing_error = ${updates.processing_error}`);
  }
  if (typeof updates.plain_text !== "undefined") {
    fields.push(sql`plain_text = ${updates.plain_text}`);
  }
  if (typeof updates.template_json !== "undefined") {
    const templateJson = JSON.stringify(updates.template_json);
    fields.push(sql`template_json = ${templateJson}::jsonb`);
  }
  if (fields.length === 0) {
    const current = await getDocumentById(id, { includePlainText: true });
    return current as InternalDocumentRecord | null;
  }
  const setClause = joinSqlFields(fields);
  const result = await sql<DocumentRow>`
    UPDATE documents
    SET ${setClause}
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
  return stripPrivateDocumentFields(normalizeRecord(result.rows[0]));
}

function normalizeRecord(row: DocumentRow): InternalDocumentRecord {
  const template =
    typeof row.template_json === "string"
      ? (JSON.parse(row.template_json) as ExtractedTemplate)
      : (row.template_json as ExtractedTemplate);
  return {
    ...row,
    template_json: template,
  };
}

export function stripPrivateDocumentFields(record: InternalDocumentRecord): DocumentRecord {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { plain_text: _plainText, ...publicFields } = record;
  return publicFields;
}

function joinSqlFields(fields: SQL[]): SQL {
  if (fields.length === 0) {
    throw new Error("joinSqlFields requires at least one SQL fragment");
  }
  const [first, ...rest] = fields;
  return rest.reduce<SQL>((acc, field) => sql`${acc}, ${field}`, first);
}
