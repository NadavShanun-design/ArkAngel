import React, { createContext, useContext } from "react";
import { useCompletion } from "@/hooks/useCompletion";

type CompletionCtx = ReturnType<typeof useCompletion> | null;

const CompletionContext = createContext<CompletionCtx>(null);

export function CompletionProvider({ children }: { children: React.ReactNode }) {
  // Single source of truth for the entire subtree
  const completion = useCompletion();
  return (
    <CompletionContext.Provider value={completion}>
      {children}
    </CompletionContext.Provider>
  );
}

// Consumer hook
export function useCompletionShared() {
  const ctx = useContext(CompletionContext);
  if (!ctx) {
    throw new Error("useCompletionShared must be used within <CompletionProvider>");
  }
  return ctx;
}



