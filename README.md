# Lexsy Doc Assistant

Minimal notes for running the app and the background worker.

## Requirements

- Node.js 20+
- npm (ships with Node)
- Credentials for Postgres, Vercel Blob, and OpenAI

## Environment variables

Create `.env.local` with the secrets you received. These are the only values the app expects:

| Name | Description |
| --- | --- |
| `POSTGRES_URL` | Vercel (or Neon) Postgres connection string with read/write access. |
| `BLOB_READ_WRITE_TOKEN` | Token that lets the app read/write files in Vercel Blob storage. |
| `OPENAI_API_KEY` | API key used for placeholder extraction + generation. |

Keep the file local—never commit it.

## Development server

```bash
npm install           # first run only
npm run dev           # starts Next.js on http://localhost:3000
```

## Background worker

Run the worker in a second terminal so pending documents are processed out of band:

```bash
npm run process-docs
```

Useful env knobs while testing:

- `LEXSY_WORKER_CONCURRENCY` – number of documents processed in parallel (default 5)
- `LEXSY_WORKER_CHUNK_BATCH` – chunks per document processed concurrently (default 5)
- `LEXSY_WORKER_SINGLE_PASS=1` – exit after one sweep (handy for local smoke tests)

Uploading a doc through the UI sets `processing_status = 'pending'`, the worker advances it to `ready`, and the client polls `/api/documents/:id` for status. No other manual steps required.
