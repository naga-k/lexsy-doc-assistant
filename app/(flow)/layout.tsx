import type { ReactNode } from "react";
import { FlowNav } from "./flow-nav";
import { FlowSessionProvider } from "./flow-session-context";

export default function FlowLayout({ children }: { children: ReactNode }) {
  return (
    <FlowSessionProvider>
      <div className="flex min-h-screen flex-col bg-slate-950 text-white">
        <FlowNav />
        <main className="flex-1 w-full px-4 py-10 sm:px-8 lg:px-16">{children}</main>
      </div>
    </FlowSessionProvider>
  );
}
