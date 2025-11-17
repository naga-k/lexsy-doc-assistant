import type { ReactNode } from "react";
import { FlowNav } from "./flow-nav";

export default function FlowLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen bg-slate-950 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(79,70,229,0.45),transparent_55%)]" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(16,185,129,0.12),transparent_40%)]" aria-hidden="true" />
      <div className="relative z-10 flex min-h-screen flex-col">
        <FlowNav />
        <section className="mx-auto w-full max-w-6xl flex-1 px-4 py-12 md:px-6">{children}</section>
      </div>
    </div>
  );
}
