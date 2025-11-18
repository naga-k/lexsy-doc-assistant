import type { DocumentRecord } from "@/lib/types";

export type DocumentResponse = { document: DocumentRecord; error?: string };

export function safeJson<T>(input: string): T | null {
  try {
    return JSON.parse(input) as T;
  } catch {
    return null;
  }
}

async function parseDocumentResponse(response: Response) {
  const raw = await response.text();
  const payload = safeJson<DocumentResponse>(raw);
  if (!response.ok || !payload?.document) {
    if (response.ok && !payload?.document) {
      throw new Error("Server response missing document payload.");
    }
    throw new Error(payload?.error ?? "Request failed.");
  }
  return payload.document;
}

export async function requestDocument(id: string) {
  const response = await fetch(`/api/documents/${id}`, {
    method: "GET",
    cache: "no-store",
  });
  return parseDocumentResponse(response);
}

export async function uploadDocument(file: File) {
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch("/api/documents", {
    method: "POST",
    body: formData,
  });
  return parseDocumentResponse(response);
}

export async function generateDocument(documentId: string) {
  const response = await fetch(`/api/documents/${documentId}/generate`, {
    method: "POST",
  });
  return parseDocumentResponse(response);
}

export async function processDocument(documentId: string) {
  const response = await fetch(`/api/documents/${documentId}/process`, {
    method: "POST",
  });
  return parseDocumentResponse(response);
}

export async function updateDocumentPlaceholders(documentId: string, updates: Record<string, string>) {
  const response = await fetch(`/api/documents/${documentId}/placeholders`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ updates }),
  });
  return parseDocumentResponse(response);
}
