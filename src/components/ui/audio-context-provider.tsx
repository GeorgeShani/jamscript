"use client";
import type { ReactNode } from "react";
import { AudioContextContext } from "@/hooks/use-audio-context";

export interface AudioContextProviderProps {
  /** Use your own context instead of the shared one. */
  context: AudioContext;
  children: ReactNode;
}

/** Makes every audiocn hook below it use `context`. */
export const AudioContextProvider = ({ context, children }: AudioContextProviderProps) => (
  <AudioContextContext.Provider value={context}>{children}</AudioContextContext.Provider>
);
