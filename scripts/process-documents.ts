#!/usr/bin/env tsx

import fs from "node:fs";
import path from "node:path";
import { config as loadEnv } from "dotenv";
import { processDocumentChunkBatch } from "../lib/document-processor";
import { findDocumentsNeedingProcessing } from "../lib/documents";

const ENV_FILES = [".env", ".env.local"];
for (const file of ENV_FILES) {
  const fullPath = path.resolve(process.cwd(), file);
  if (fs.existsSync(fullPath)) {
    loadEnv({ path: fullPath, override: true });
  }
}

const REQUIRED_ENV_VARS = ["POSTGRES_URL", "OPENAI_API_KEY"];

function validateEnv(workerId: string) {
  const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.error(`[documents.worker] Missing required env vars`, { workerId, missing });
    process.exit(1);
  }
}

const CONCURRENCY = Number(process.env.LEXSY_WORKER_CONCURRENCY ?? "5");
const CHUNK_BATCH_SIZE = Math.max(
  1,
  Number(process.env.LEXSY_WORKER_CHUNK_BATCH ?? process.env.LEXSY_PROCESS_CHUNK_BATCH ?? "5")
);
const POLL_INTERVAL_MS = Number(process.env.LEXSY_WORKER_POLL_INTERVAL_MS ?? "5000");
const BATCH_LIMIT = Number(process.env.LEXSY_WORKER_BATCH_LIMIT ?? "10");
const SINGLE_PASS = process.env.LEXSY_WORKER_SINGLE_PASS === "1";
const ERROR_DELAY_MS = Number(process.env.LEXSY_WORKER_ERROR_DELAY_MS ?? "5000");
const MAX_CONSECUTIVE_ERRORS = Math.max(1, Number(process.env.LEXSY_WORKER_MAX_ERRORS ?? "5"));

const workerId = `${process.env.RENDER_INSTANCE_ID ?? process.env.HOSTNAME ?? "lexsy-worker"}-${
  process.pid
}`;

validateEnv(workerId);

console.info(`[documents.worker] Starting`, {
  workerId,
  concurrency: CONCURRENCY,
  batchLimit: BATCH_LIMIT,
  pollIntervalMs: POLL_INTERVAL_MS,
  singlePass: SINGLE_PASS,
  chunkBatchSize: CHUNK_BATCH_SIZE,
});

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runOnce() {
  const documents = await findDocumentsNeedingProcessing({
    limit: BATCH_LIMIT,
    includePlainText: true,
  });

  if (documents.length === 0) {
    console.info(`[documents.worker] No documents queued`, { workerId });
    return 0;
  }

  console.info(`[documents.worker] Claimed batch`, {
    workerId,
    count: documents.length,
    documentIds: documents.map((doc) => doc.id),
  });

  let processedCount = 0;

  await runWithConcurrency(documents, CONCURRENCY, async (document, index) => {
    const start = Date.now();
    const queuedChunks = document.processing_total_chunks ?? 0;
    const nextChunk = document.processing_next_chunk ?? 0;
    console.info(`[documents.worker] Processing document`, {
      workerId,
      documentId: document.id,
      filename: document.filename,
      queuedChunks,
      nextChunk,
      queuePosition: index + 1,
      batchSize: documents.length,
    });
    try {
      const result = await processDocumentChunkBatch(document.id, {
        chunkBatchSize: CHUNK_BATCH_SIZE,
      });
      processedCount += 1;
      const updated = result.document ?? document;
      const progress = updated.processing_progress ?? 0;
      const totalChunks = updated.processing_total_chunks ?? queuedChunks;
      const cursor = updated.processing_next_chunk ?? nextChunk;
      console.info(`[documents.worker] Document processed`, {
        workerId,
        documentId: document.id,
        status: result.status,
        progress,
        chunkCursor: totalChunks ? `${Math.min(cursor, totalChunks)}/${totalChunks}` : undefined,
        durationMs: Date.now() - start,
        error: result.error,
      });
      if (result.status === "failed") {
        throw new Error(result.error ?? "Document processing failed");
      }
    } catch (error) {
      console.error(`[documents.worker] Document processing error`, {
        workerId,
        documentId: document.id,
        error,
      });
      throw error;
    }
  });
  return processedCount;
}

async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<void>
) {
  if (items.length === 0) {
    return;
  }
  const concurrency = Math.max(1, Math.min(limit, items.length));
  let nextIndex = 0;

  const runners = Array.from({ length: concurrency }, async () => {
    while (true) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      if (currentIndex >= items.length) {
        break;
      }
      const item = items[currentIndex];
      await worker(item, currentIndex);
    }
  });

  await Promise.all(runners);
}

async function loop() {
  let iteration = 0;
  let consecutiveErrors = 0;
  while (true) {
    try {
      iteration += 1;
      const processed = await runOnce();
      consecutiveErrors = 0;
      if (processed > 0) {
        console.info(`[documents.worker] Batch complete`, {
          workerId,
          iteration,
          processed,
        });
      }
      if (SINGLE_PASS) {
        console.info(`[documents.worker] Single pass complete`, { workerId, iteration });
        return;
      }
      if (processed === 0) {
        await delay(POLL_INTERVAL_MS);
      }
    } catch (error) {
      consecutiveErrors += 1;
      console.error("Worker loop error", { workerId, iteration, consecutiveErrors, error });
      await delay(ERROR_DELAY_MS);
      if (SINGLE_PASS) {
        console.error(`[documents.worker] Exiting after single-pass failure`, {
          workerId,
          iteration,
        });
        return;
      }
      if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
        console.error(`[documents.worker] Too many consecutive errors, exiting`, {
          workerId,
          maxConsecutiveErrors: MAX_CONSECUTIVE_ERRORS,
        });
        process.exit(1);
      }
    }
  }
}

void loop();
