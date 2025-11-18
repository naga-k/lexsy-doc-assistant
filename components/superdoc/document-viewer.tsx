"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import clsx from "clsx";
import { Loader } from "@/components/ai-elements/loader";
import type { DocumentRecord } from "@/lib/types";

export type SuperDocViewerStatus = "idle" | "loading" | "ready" | "error";

type SuperDocHandle = {
  destroy?: () => void;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
};

export interface SuperDocViewerProps {
  document: DocumentRecord | null;
  className?: string;
  fallback?: ReactNode;
  variant?: "live" | "preview";
  readOnly?: boolean;
  docUrl?: string | null;
  onStatusChange?: (status: SuperDocViewerStatus) => void;
}

export function SuperDocViewer({
  document,
  className,
  fallback,
  docUrl,
  readOnly = true,
  variant = "live",
  onStatusChange,
}: SuperDocViewerProps) {
  const containerIdRef = useRef(`superdoc-container-${Math.random().toString(36).slice(2)}`);
  const superdocRef = useRef<SuperDocHandle | null>(null);
  const [status, setStatus] = useState<SuperDocViewerStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const resolvedDocumentUrl = useMemo(() => {
    if (docUrl) return docUrl;
    if (document?.filled_blob_url) return document.filled_blob_url;
    if (document?.original_blob_url) return document.original_blob_url;
    return null;
  }, [docUrl, document?.filled_blob_url, document?.original_blob_url]);

  const resolvedRole = readOnly ? "viewer" : "editor";
  const resolvedMode = readOnly || variant === "preview" ? "viewing" : "editing";

  const updateStatus = useCallback(
    (next: SuperDocViewerStatus) => {
      setStatus(next);
      onStatusChange?.(next);
    },
    [onStatusChange]
  );

  const destroyInstance = useCallback(() => {
    superdocRef.current?.destroy?.();
    superdocRef.current = null;
  }, []);

  useEffect(() => {
    if (!resolvedDocumentUrl) {
      destroyInstance();
      setError(null);
      updateStatus("idle");
      return;
    }

    let disposed = false;
    updateStatus("loading");
    setError(null);

    const mount = async () => {
      try {
        const { SuperDoc } = (await import("@harbour-enterprises/superdoc")) as unknown as {
          SuperDoc: new (config: Record<string, unknown>) => SuperDocHandle;
        };

        if (disposed) {
          return;
        }

        destroyInstance();

        const instance = new SuperDoc({
          selector: `#${containerIdRef.current}`,
          document: resolvedDocumentUrl,
          role: resolvedRole,
          documentMode: resolvedMode,
          user: {
            name: "Lexsy Preview",
            email: "preview@lexsy.dev",
          },
          modules: {
            comments: { allowResolve: true },
            inspector: { dock: "right" },
          },
        });

        superdocRef.current = instance;

        if (typeof instance.on === "function") {
          instance.on("ready", () => {
            if (disposed) return;
            updateStatus("ready");
          });
        } else {
          updateStatus("ready");
        }
      } catch (mountError) {
        if (disposed) return;
        console.error("Failed to initialize SuperDoc", mountError);
        setError((mountError as Error).message ?? "Unable to load document preview");
        updateStatus("error");
      }
    };

    void mount();

    return () => {
      disposed = true;
      destroyInstance();
    };
  }, [destroyInstance, resolvedDocumentUrl, resolvedMode, resolvedRole, updateStatus, reloadToken]);

  const handleReload = useCallback(() => {
    if (!resolvedDocumentUrl) return;
    setReloadToken((prev) => prev + 1);
  }, [resolvedDocumentUrl]);

  const canShowViewer = Boolean(resolvedDocumentUrl);

  return (
    <div className={clsx("flex h-full flex-col gap-2", className)}>
      {canShowViewer ? (
        <>
          <div className="relative flex-1 min-h-[280px] rounded-[inherit] bg-transparent">
            <div
              id={containerIdRef.current}
              className="superdoc-host h-full w-full overflow-auto rounded-[inherit]"
            />
            {status === "loading" ? (
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-[inherit] bg-black/60 text-sm text-white/70">
                <Loader size={20} className="text-indigo-200" />
                <span>Preparing DOCX preview…</span>
              </div>
            ) : null}
            {status === "error" ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-[inherit] bg-black/70 text-center text-sm text-rose-200">
                <p>{error ?? "Unable to render document."}</p>
                <button
                  type="button"
                  onClick={handleReload}
                  className="rounded-full border border-rose-200/50 px-4 py-1 text-[11px] font-semibold uppercase tracking-[0.3em] text-rose-100"
                >
                  Retry
                </button>
              </div>
            ) : null}
          </div>
        </>
      ) : (
        <div className="flex flex-1 flex-col justify-center rounded-3xl border border-dashed border-white/20 bg-white/5 p-5 text-sm text-white/70">
          {fallback ?? (
            <p>
              Upload a template or generate a filled version to unlock the immersive Word preview.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
