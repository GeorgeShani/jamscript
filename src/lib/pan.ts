// Adapted from audiocn/ui (MIT), commit 521c03f. See public/licenses/audiocn-MIT.txt.
export const PAN_PERCENT = 100;

/** "L30", "C", "R30". */
export const formatPan = (value: number): string => {
  const amount = Math.round(Math.abs(value) * PAN_PERCENT);
  if (amount === 0) {
    return "C";
  }
  return `${value < 0 ? "L" : "R"}${amount}`;
};

const CENTER_TEXT = /^c(?:enter|entre)?$/iu;
const SIDE_PREFIX = /^[LR]/iu;

/** Reads "L30", "R15", "C" or a number from −100 to 100; the inverse of formatPan. */
export const parsePan = (text: string): number | null => {
  const trimmed = text.trim().replaceAll("\u2212", "-");
  if (CENTER_TEXT.test(trimmed)) {
    return 0;
  }
  const side = SIDE_PREFIX.test(trimmed) ? trimmed[0]?.toUpperCase() : null;
  const digits = (side ? trimmed.slice(1) : trimmed).trim();
  const amount = Number(digits) / PAN_PERCENT;
  if (digits === "" || Number.isNaN(amount)) {
    return null;
  }
  return side === "L" ? -Math.abs(amount) : amount;
};

export const describePan = (value: number): string => {
  const amount = Math.round(Math.abs(value) * PAN_PERCENT);
  if (amount === 0) {
    return "Center";
  }
  return `${amount}% ${value < 0 ? "left" : "right"}`;
};
