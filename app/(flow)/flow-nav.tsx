"use client";

import Link from "next/link";

export function FlowNav() {
  return (
    <nav className="lexsy-nav shrink-0">
      <div className="mx-auto flex w-full items-center justify-between px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-3">
          <span className="sr-only">Lexsy home</span>
          <img
            src="https://cdn.prod.website-files.com/65030261282cb8dc8d56f660/671dd7da409351203f94af52_Lexsy.png"
            alt="Lexsy"
            className="h-7 w-auto"
            loading="lazy"
            decoding="async"
          />
        </Link>
        <span className="text-[10px] font-semibold uppercase tracking-[0.35em] text-lexsy-muted">
          Workflow
        </span>
        <a
          href="https://stan.store/Lexsy"
          target="_blank"
          rel="noreferrer"
          className="lexsy-outline-button hidden sm:inline-flex"
        >
          Apply
        </a>
      </div>
    </nav>
  );
}
