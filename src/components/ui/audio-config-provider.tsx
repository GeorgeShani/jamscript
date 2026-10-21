"use client";
import { useContext, useMemo, type ReactNode } from "react";
import { AudioConfigContext, type AudioConfig } from "@/hooks/use-audio-config";

export interface AudioConfigProviderProps {
  value: AudioConfig;
  children: ReactNode;
}

/** Merges `value` over any config from a parent provider. */
export const AudioConfigProvider = ({ value, children }: AudioConfigProviderProps) => {
  const parent = useContext(AudioConfigContext);
  const { ballistics, dimmed, disabled, maxDb, minDb, orientation, size, zones } = value;

  const merged = useMemo<AudioConfig>(
    () => ({
      ballistics: ballistics ?? parent.ballistics,
      dimmed: (dimmed ?? false) || (parent.dimmed ?? false),
      disabled: (disabled ?? false) || (parent.disabled ?? false),
      maxDb: maxDb ?? parent.maxDb,
      minDb: minDb ?? parent.minDb,
      orientation: orientation ?? parent.orientation,
      size: size ?? parent.size,
      zones: zones ?? parent.zones,
    }),
    [ballistics, dimmed, disabled, maxDb, minDb, orientation, parent, size, zones],
  );

  return <AudioConfigContext.Provider value={merged}>{children}</AudioConfigContext.Provider>;
};
