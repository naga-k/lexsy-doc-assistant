'use client';

import { createContext, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";

type FlowSessionValue = {
  docId: string | null;
  setDocId: (next: string | null) => void;
  isDirty: boolean;
  setIsDirty: (next: boolean) => void;
};

const FlowSessionContext = createContext<FlowSessionValue | undefined>(undefined);

export function FlowSessionProvider({ children }: { children: ReactNode }) {
  const [docId, setDocId] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  const value = useMemo(
    () => ({
      docId,
      setDocId,
      isDirty,
      setIsDirty,
    }),
    [docId, isDirty]
  );

  return <FlowSessionContext.Provider value={value}>{children}</FlowSessionContext.Provider>;
}

export function useFlowSession() {
  const context = useContext(FlowSessionContext);
  if (!context) {
    throw new Error("useFlowSession must be used within a FlowSessionProvider");
  }
  return context;
}
