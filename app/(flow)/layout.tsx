import type { ReactNode } from "react";
import { FlowNav } from "./flow-nav";
import { FlowSessionProvider } from "./flow-session-context";

export default function FlowLayout({ children }: { children: ReactNode }) {
  return (
    <FlowSessionProvider>
      <div className="flex h-screen flex-col bg-slate-950 text-white">
        <FlowNav />
        <main className="flex-1 w-full min-h-0 overflow-hidden">
          <div className="mx-auto flex h-full w-full flex-col min-h-0 overflow-hidden px-2 py-2 sm:px-3 sm:py-3 lg:px-4 lg:py-4">
            {children}
          </div>
        </main>
      </div>
    </FlowSessionProvider>
  );
}
