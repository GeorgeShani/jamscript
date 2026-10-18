/** Simple line-based +/- counts for proposal review chips. */
export function lineDiffCounts(base: string, proposed: string) {
  const before = new Map<string, number>();
  for (const line of base.split("\n")) before.set(line, (before.get(line) ?? 0) + 1);
  let added = 0;
  let removed = 0;
  for (const line of proposed.split("\n")) {
    const count = before.get(line) ?? 0;
    if (count > 0) before.set(line, count - 1);
    else added += 1;
  }
  for (const count of before.values()) removed += count;
  return { added, removed };
}
