import type { ReactNode } from "react";
import { FlowNav } from "./flow-nav";
import { FlowSessionProvider } from "./flow-session-context";

export default function FlowLayout({ children }: { children: ReactNode }) {
  return (
    <FlowSessionProvider>
      <div className="flex min-h-screen flex-col bg-slate-950 text-white">
        <FlowNav />
        <main className="flex-1 w-full py-2 sm:py-3 lg:py-4">
          <div className="mx-auto w-full px-2 sm:px-3 lg:px-4">{children}</div>
        </main>
      </div>
    </FlowSessionProvider>
  );
}
