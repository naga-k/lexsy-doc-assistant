"use client";

import Link from "next/link";

export function FlowNav() {
  return (
    <nav className="shrink-0 border-b border-white/10 bg-slate-950/90 backdrop-blur">
      <div className="flex w-full items-center px-4 py-4 sm:px-8 lg:px-16">
        <Link href="/" className="text-sm font-semibold uppercase tracking-[0.4em] text-indigo-200">
          Lexsy
        </Link>
      </div>
    </nav>
  );
}
