"use client";

import { type ReactNode } from "react";
import { AppFeedbackProvider } from "@/components/app-shell";

export function AppProviders({ children }: { children: ReactNode }) {
  return <AppFeedbackProvider>{children}</AppFeedbackProvider>;
}
