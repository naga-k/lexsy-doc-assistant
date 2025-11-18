"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function FlowNav() {
  const pathname = usePathname();
  const stepLabel = pathname === "/fill" ? "Step 2 · Fill" : null;

  return (
    <nav className="shrink-0 border-b border-white/10 bg-slate-950/90 backdrop-blur">
      <div className="flex w-full items-center justify-between px-4 py-4 sm:px-8 lg:px-16">
        <Link href="/" className="text-sm font-semibold uppercase tracking-[0.4em] text-indigo-200">
          Lexsy
        </Link>
        {stepLabel ? (
          <span className="text-xs uppercase tracking-[0.3em] text-slate-400">{stepLabel}</span>
        ) : (
          <span />
        )}
      </div>
    </nav>
  );
}
