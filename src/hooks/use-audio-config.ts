"use client";

import { createContext, useContext } from "react";

import type { BallisticsInput } from "@/lib/ballistics";
import type { MeterZone, Orientation } from "@/lib/types";

export type AudioSize = "sm" | "default" | "lg";

/**
 * Settings a container (a mixer or channel strip) passes down to the audiocn
 * components inside it. Explicit props on a component always win.
 */
export interface AudioConfig {
  orientation?: Orientation | undefined;
  size?: AudioSize | undefined;
  disabled?: boolean;
  /** Muted or silenced by another channel's solo: meters render dimmed. */
  dimmed?: boolean;
  minDb?: number | undefined;
  maxDb?: number | undefined;
  zones?: MeterZone[] | undefined;
  ballistics?: BallisticsInput | undefined;
}

export const AudioConfigContext = createContext<AudioConfig>({});

/** The config from the nearest mixer or channel strip, or `{}`. */
export const useAudioConfig = (): AudioConfig => useContext(AudioConfigContext);
