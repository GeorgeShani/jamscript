// Synthetic presentation data only: no Git, document, Take or browser storage access.
export type RepoStatus = "noRepo" | "clean" | "changed" | "ready" | "ahead" | "behind" | "busy" | "offline" | "tokenNeeded" | "tokenRefused" | "diverged" | "unsavedEditor";
export type RepoHistory = { readonly message: string; readonly id: string; readonly when: string };
export type RepoPreview = {
  readonly status: RepoStatus;
  readonly exists: boolean;
  readonly changed: boolean;
  readonly added: boolean;
  readonly ahead: number;
  readonly behind: number;
  readonly history: readonly RepoHistory[];
};
export const REPO_SUMMARY = "bass lpf 1200 to 430, hats 4 to 8 hits";
export const REPO_FILES = ["night-bus.js", "ideas.js", "drums-only.js"] as const;
export const REPO_OPEN_FILE = "night-bus.js";
const HISTORY: readonly RepoHistory[] = Object.freeze([
  Object.freeze({ message: "Night bus first draft", id: "3f9a2c1", when: "yesterday" }),
  Object.freeze({ message: "Add perc line", id: "b71d0e4", when: "2 days ago" }),
  Object.freeze({ message: "Start the repo", id: "0c5e8aa", when: "2 days ago" }),
]);
const BASE: RepoPreview = { status: "clean", exists: true, changed: false, added: false, ahead: 0, behind: 0, history: HISTORY };
export const REPO_FIXTURES: Readonly<Record<RepoStatus, RepoPreview>> = Object.freeze({
  noRepo: Object.freeze({ ...BASE, status: "noRepo", exists: false, history: [] }),
  clean: Object.freeze(BASE),
  changed: Object.freeze({ ...BASE, status: "changed", changed: true }),
  ready: Object.freeze({ ...BASE, status: "ready", changed: true, added: true }),
  ahead: Object.freeze({ ...BASE, status: "ahead", ahead: 1 }),
  behind: Object.freeze({ ...BASE, status: "behind", behind: 2 }),
  busy: Object.freeze({ ...BASE, status: "busy", changed: true }),
  offline: Object.freeze({ ...BASE, status: "offline", ahead: 1 }),
  tokenNeeded: Object.freeze({ ...BASE, status: "tokenNeeded", ahead: 1 }),
  tokenRefused: Object.freeze({ ...BASE, status: "tokenRefused", ahead: 1 }),
  diverged: Object.freeze({ ...BASE, status: "diverged", ahead: 1, behind: 2 }),
  unsavedEditor: Object.freeze({ ...BASE, status: "unsavedEditor", changed: true }),
});
export const REPO_EXPLANATIONS: Partial<Record<RepoStatus, string>> = {
  noRepo: "Clone opens an example repo only. No address is fetched.",
  clean: "Nothing to commit. This example song matches main.",
  busy: "Repo busy example. Wait for the real operation to finish before making changes; no operation is running here.",
  offline: "Offline example. Reconnect before publishing or pulling; neither is connected in this preview.",
  tokenNeeded: "Publishing would need GitHub permission. Credentials are not collected in this preview.",
  tokenRefused: "GitHub permission refused example. Check permission outside JamScript; no token was submitted here.",
  diverged: "This repo has changes from both sides. Resolve them outside JamScript before pulling.",
  unsavedEditor: "Loading another file is blocked because the editor has unsaved changes. Keep or save them outside this preview first.",
};
export function repoPrimaryAction(state: RepoPreview): "clone" | "commit" | "push" | null {
  if (!state.exists) return "clone";
  if (state.changed) return "commit";
  return state.ahead > 0 ? "push" : null;
}
export function canPreviewCommit(state: RepoPreview, message: string): boolean {
  return state.exists && state.changed && state.status !== "busy" && message.trim().length > 0;
}
export function addPreviewChanges(state: RepoPreview, added: boolean): RepoPreview {
  if (!state.changed || state.status === "busy") return state;
  return { ...state, added, status: added ? "ready" : "changed" };
}
export function commitPreview(state: RepoPreview, message: string): RepoPreview {
  if (!canPreviewCommit(state, message)) return state;
  const ahead = state.ahead + 1;
  return { ...state, status: "ahead", changed: false, added: false, ahead,
    history: [{ message: message.trim(), id: `preview-${ahead}`, when: "just now" }, ...state.history].slice(0, 5) };
}