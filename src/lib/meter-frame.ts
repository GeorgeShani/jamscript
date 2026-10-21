import { SILENCE_DB } from "./decibels";
import type { MeterFrame } from "./types";

/** The level a readout shows from one frame. */
export const readChannel = (
  frame: MeterFrame,
  measure: "peak" | "rms",
  channel: number | "max",
) => {
  const read = (index: number) => {
    const level = frame.channels[index];
    if (!level) {
      return SILENCE_DB;
    }
    return measure === "rms" ? (level.rmsDb ?? level.peakDb) : level.peakDb;
  };
  if (channel !== "max") {
    return read(channel);
  }
  let loudest = SILENCE_DB;
  for (let index = 0; index < frame.channels.length; index += 1) {
    loudest = Math.max(loudest, read(index));
  }
  return loudest;
};
