import { deriveMusic, lensPatch, type LensEdit, type MusicLens } from "@/engine/music-document";

function patchesTo(previous: string, source: string, edit: LensEdit) {
  const patch = lensPatch(previous, edit);
  return (
    !!patch && previous.slice(0, patch.from) + patch.insert + previous.slice(patch.to) === source
  );
}

/** Describe only source changes that the checked lens model can identify. */
export function takeLabel(previous: string | null, source: string): string {
  if (previous === null) return "First play";
  const before = deriveMusic(previous);
  const after = deriveMusic(source);
  if (!before.valid || !after.valid) return "Source edit";
  const oldLenses = new Map(
    before.tracks.flatMap((track) => track.lenses).map((lens) => [lens.id, lens]),
  );
  const newLenses = after.tracks.flatMap((track) => track.lenses);
  const changes: { old: MusicLens; current: MusicLens }[] = [];
  for (const current of newLenses) {
    const old = oldLenses.get(current.id);
    if (!old || old.kind !== current.kind) continue;
    const oldValue =
      old.kind === "param"
        ? old.value
        : old.steps.map((step) => [step.sound, step.substeps, step.alternatives]);
    const newValue =
      current.kind === "param"
        ? current.value
        : current.steps.map((step) => [step.sound, step.substeps, step.alternatives]);
    if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) changes.push({ old, current });
  }
  if (changes.length === 1) {
    const { old, current } = changes[0]!;
    if (
      old.kind === "param" &&
      current.kind === "param" &&
      previous.slice(0, old.from) === source.slice(0, current.from) &&
      previous.slice(old.to) === source.slice(current.to)
    )
      return `${current.track} ${current.name} ${old.value} → ${current.value}`;
    if (old.kind === "rhythm" && current.kind === "rhythm") {
      if (old.steps.length === current.steps.length) {
        const changedSteps = old.steps.flatMap((step, index) =>
          JSON.stringify([step.sound, step.substeps, step.alternatives]) !==
          JSON.stringify([
            current.steps[index]?.sound,
            current.steps[index]?.substeps,
            current.steps[index]?.alternatives,
          ])
            ? [index]
            : [],
        );
        if (changedSteps.length === 1) {
          const index = changedSteps[0]!;
          const oldStep = old.steps[index]!;
          const newStep = current.steps[index]!;
          if (
            previous.slice(0, oldStep.from) === source.slice(0, newStep.from) &&
            previous.slice(oldStep.to) === source.slice(newStep.to)
          )
            return `${current.track} rhythm edit`;
        }
      }
      for (const [stepIndex, step] of old.steps.entries()) {
        if (
          !step.substeps &&
          !step.alternatives &&
          patchesTo(previous, source, { target: old.id, step: stepIndex })
        )
          return `${current.track} rhythm edit`;
        for (const [substep] of (step.substeps ?? []).entries())
          if (patchesTo(previous, source, { target: old.id, step: stepIndex, substep }))
            return `${current.track} rhythm edit`;
        for (const [alternative] of (step.alternatives ?? []).entries())
          if (patchesTo(previous, source, { target: old.id, step: stepIndex, alternative }))
            return `${current.track} rhythm edit`;
      }
    }
  }
  if (before.tempo !== after.tempo && before.tempo !== null && after.tempo !== null)
    return `Tempo ${before.tempo} → ${after.tempo} CPS`;
  if (changes.length > 1) return `${changes.length} control changes`;
  return "Source edit";
}
