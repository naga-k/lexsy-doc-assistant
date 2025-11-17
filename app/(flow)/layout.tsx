import type { ReactNode } from "react";
import { FlowNav } from "./flow-nav";

export default function FlowLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <FlowNav />
      <section className="mx-auto w-full max-w-5xl px-4 py-12">{children}</section>
    </div>
  );
}
