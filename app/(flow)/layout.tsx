import type { ReactNode } from "react";
import { FlowNav } from "./flow-nav";
import { FlowSessionProvider } from "./flow-session-context";

export default function FlowLayout({ children }: { children: ReactNode }) {
  return (
    <FlowSessionProvider>
      <div className="flex min-h-screen flex-col bg-slate-950 text-white">
        <FlowNav />
        <main className="flex-1 w-full py-3 sm:py-4 lg:py-6">
          <div className="mx-auto w-full px-3 sm:px-4 lg:px-6">{children}</div>
        </main>
      </div>
    </FlowSessionProvider>
  );
}
