import { sql } from "@vercel/postgres";
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
  const assignments: UpdateAssignment[] = [
    { column: "template_json", value: templateJson, cast: "jsonb" },
  ];
  if (typeof options?.processing_status !== "undefined") {
    assignments.push({ column: "processing_status", value: options.processing_status });
  }
  if (typeof options?.processing_progress !== "undefined") {
    assignments.push({ column: "processing_progress", value: options.processing_progress });
  }
  if (typeof options?.processing_total_chunks !== "undefined") {
    assignments.push({ column: "processing_total_chunks", value: options.processing_total_chunks });
  }
  if (typeof options?.processing_next_chunk !== "undefined") {
    assignments.push({ column: "processing_next_chunk", value: options.processing_next_chunk });
  }
  if (typeof options?.processing_error !== "undefined") {
    assignments.push({ column: "processing_error", value: options.processing_error });
  }
  if (typeof options?.plain_text !== "undefined") {
    assignments.push({ column: "plain_text", value: options.plain_text });
  }
  const { text, values } = buildUpdateStatement(assignments, id);
  const result = await sql.query<DocumentRow>(text, values);
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
  const assignments: UpdateAssignment[] = [];
  if (typeof updates.processing_status !== "undefined") {
    assignments.push({ column: "processing_status", value: updates.processing_status });
  }
  if (typeof updates.processing_progress !== "undefined") {
    assignments.push({ column: "processing_progress", value: updates.processing_progress });
  }
  if (typeof updates.processing_total_chunks !== "undefined") {
    assignments.push({ column: "processing_total_chunks", value: updates.processing_total_chunks });
  }
  if (typeof updates.processing_next_chunk !== "undefined") {
    assignments.push({ column: "processing_next_chunk", value: updates.processing_next_chunk });
  }
  if (typeof updates.processing_error !== "undefined") {
    assignments.push({ column: "processing_error", value: updates.processing_error });
  }
  if (typeof updates.plain_text !== "undefined") {
    assignments.push({ column: "plain_text", value: updates.plain_text });
  }
  if (typeof updates.template_json !== "undefined") {
    const templateJson = JSON.stringify(updates.template_json);
    assignments.push({ column: "template_json", value: templateJson, cast: "jsonb" });
  }
  if (assignments.length === 0) {
    const current = await getDocumentById(id, { includePlainText: true });
    return current as InternalDocumentRecord | null;
  }
  const { text, values } = buildUpdateStatement(assignments, id);
  const result = await sql.query<DocumentRow>(text, values);
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

type UpdateAssignment = {
  column:
    | "template_json"
    | "processing_status"
    | "processing_progress"
    | "processing_total_chunks"
    | "processing_next_chunk"
    | "processing_error"
    | "plain_text";
  value: string | number | boolean | null;
  cast?: "jsonb";
};

function buildUpdateStatement(assignments: UpdateAssignment[], id: string) {
  if (assignments.length === 0) {
    throw new Error("buildUpdateStatement requires at least one assignment");
  }
  const fragments: string[] = [];
  const values: Array<string | number | boolean | null> = [];
  assignments.forEach(({ column, value, cast }) => {
    values.push(value);
    const placeholderIndex = values.length;
    const castSuffix = cast ? `::${cast}` : "";
    fragments.push(`${column} = $${placeholderIndex}${castSuffix}`);
  });
  const wherePlaceholder = `$${values.length + 1}`;
  const text = `UPDATE documents SET ${fragments.join(", ")} WHERE id = ${wherePlaceholder} RETURNING *;`;
  return { text, values: values.concat(id) };
}

export async function findDocumentsNeedingProcessing(
  options?: {
    limit?: number;
    includePlainText?: boolean;
  }
): Promise<Array<InternalDocumentRecord | DocumentRecord>> {
  await ensureDocumentsTable();
  const limit = Math.max(options?.limit ?? 1, 1);
  const result = await sql<DocumentRow>`
    SELECT *
    FROM documents
    WHERE processing_status IN ('pending', 'processing')
    ORDER BY created_at ASC
    LIMIT ${limit};
  `;
  const records = result.rows.map((row) => normalizeRecord(row));
  if (options?.includePlainText) {
    return records;
  }
  return records.map(stripPrivateDocumentFields);
}
