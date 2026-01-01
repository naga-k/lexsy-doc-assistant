# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Lexsy Doc Assistant is a Next.js 16 application that extracts placeholders from legal DOCX templates, lets users fill them via an AI chat interface, and produces completed documents. Uses React 19, Vercel Postgres, Vercel Blob storage, and OpenAI (gpt-5-mini).

## Commands

```bash
npm install           # Install dependencies
npm run dev           # Start Next.js dev server on http://localhost:3000
npm run build         # Production build
npm run lint          # ESLint
npm run process-docs  # Run background worker for document processing
```

### Worker Environment Variables

- `LEXSY_WORKER_CONCURRENCY` - Documents processed in parallel (default: 5)
- `LEXSY_WORKER_CHUNK_BATCH` - Chunks per document processed concurrently (default: 5)
- `LEXSY_WORKER_SINGLE_PASS=1` - Exit after one sweep (useful for local testing)

## Architecture

### Document Processing Pipeline

1. **Upload** (`app/(flow)/upload/page.tsx`): User uploads DOCX, stored in Vercel Blob
2. **Text Extraction** (`lib/docx.ts`): Mammoth extracts plain text from DOCX
3. **Placeholder Extraction** (`lib/extraction.ts`): OpenAI extracts placeholders from text chunks (max 5000 chars each). Produces `ExtractedTemplate` with `docAst` (text/placeholder nodes) and `placeholders` array
4. **Background Worker** (`scripts/process-documents.ts`): Polls for `processing_status='pending'` documents and processes them chunk by chunk
5. **Fill Flow** (`app/(flow)/fill/page.tsx`): Chat interface for filling placeholders, document preview with SuperDoc
6. **Document Generation** (`lib/docx.ts:fillDocxTemplate`): Replaces placeholder tokens in DOCX XML and generates filled document

### Key Data Types (`lib/types.ts`)

- `ExtractedTemplate`: `{ docAst: DocAstNode[], placeholders: Placeholder[] }`
- `DocumentRecord`: Document metadata + template_json + processing state
- `PlaceholderValueType`: STRING | NUMBER | DATE | PERCENT | MONEY | UNKNOWN

### API Routes

- `POST /api/documents` - Upload new document
- `GET /api/documents/[id]` - Get document with template
- `POST /api/documents/[id]/chat` - Chat endpoint with placeholder tools
- `POST /api/documents/[id]/process` - Trigger document processing
- `GET /api/documents/[id]/download` - Download filled DOCX

### Chat System (`lib/chat/`)

- `placeholder-tools.ts`: Two AI tools - `inspect_placeholder` (lookup) and `update_placeholder` (persist values)
- `prompt-builder.ts`: Builds system prompts with placeholder context
- `template-utils.ts`: Helper functions for placeholder status tracking

### Database

Single `documents` table in Vercel Postgres with columns for document metadata, `template_json` (JSONB), and processing state tracking (`processing_status`, `processing_progress`, `processing_next_chunk`).

### UI Components

- `components/ai-elements/`: Chat UI components (messages, prompts, loaders)
- `components/ui/`: Reusable UI primitives (Radix-based)
- `components/superdoc/`: DOCX document viewer using @harbour-enterprises/superdoc
- `components/workflow.tsx`: Main workflow components (ChatPanel, DocumentPreviewWindow, PlaceholderTable)

## Required Environment Variables

```bash
POSTGRES_URL          # Vercel/Neon Postgres connection string
BLOB_READ_WRITE_TOKEN # Vercel Blob storage token
OPENAI_API_KEY        # OpenAI API key for extraction + chat
```
