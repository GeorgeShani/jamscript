import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { RepoPopover } from "@/components/jam/RepoPopover";
import { REPO_FIXTURES, addPreviewChanges, canPreviewCommit, commitPreview, repoPrimaryAction } from "@/components/jam/repo-fixtures";
import { SAMPLE_CODE } from "@/components/jam/session";
import { TAKE_FIXTURES } from "@/components/jam/take-fixtures";

vi.mock("sonner", () => ({ toast: vi.fn() }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("Repo preview rules", () => {
  it("chooses only Clone, Commit or Push as the next action", () => {
    expect(repoPrimaryAction(REPO_FIXTURES.noRepo)).toBe("clone");
    expect(repoPrimaryAction(REPO_FIXTURES.changed)).toBe("commit");
    expect(repoPrimaryAction(REPO_FIXTURES.ready)).toBe("commit");
    expect(repoPrimaryAction(REPO_FIXTURES.ahead)).toBe("push");
    expect(repoPrimaryAction(REPO_FIXTURES.clean)).toBeNull();
  });

  it("commits all example changes when none are added", () => {
    const result = commitPreview(REPO_FIXTURES.changed, "  hats 4 to 8 hits  ");
    expect(result.changed).toBe(false);
    expect(result.added).toBe(false);
    expect(result.ahead).toBe(1);
    expect(result.history[0]?.message).toBe("hats 4 to 8 hits");
  });

  it("adds and removes example readiness without discarding changes", () => {
    const added = addPreviewChanges(REPO_FIXTURES.changed, true);
    expect(added.added).toBe(true);
    const removed = addPreviewChanges(added, false);
    expect(removed.added).toBe(false);
    expect(removed.changed).toBe(true);
    expect(REPO_FIXTURES.changed.added).toBe(false);
  });

  it("refuses blank messages, clean commits and busy changes without a timer", () => {
    expect(canPreviewCommit(REPO_FIXTURES.changed, " ")).toBe(false);
    expect(commitPreview(REPO_FIXTURES.clean, "new message")).toBe(REPO_FIXTURES.clean);
    expect(commitPreview(REPO_FIXTURES.busy, "new message")).toBe(REPO_FIXTURES.busy);
    expect(addPreviewChanges(REPO_FIXTURES.busy, true)).toBe(REPO_FIXTURES.busy);
  });

  it("keeps the Open marker fixed when another file is selected and blocks loading", () => {
    render(<RepoPopover open onOpenDiff={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "ideas.js" }));
    expect(screen.getByRole("button", { name: "ideas.js" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "ideas.js" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("button", { name: "night-bus.js Open" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "Open selected file" })).toBeDisabled();
  });

  it("creates only a preview commit, leaving the source, current Take and fixtures untouched", () => {
    const before = { code: SAMPLE_CODE, takes: JSON.stringify(TAKE_FIXTURES), repo: JSON.stringify(REPO_FIXTURES) };
    render(<RepoPopover open onOpenDiff={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Add all" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Commit message" }), { key: "Enter", ctrlKey: true });
    expect(toast).toHaveBeenCalledExactlyOnceWith("Preview commit created");
    expect(screen.queryByRole("textbox", { name: "Commit message" })).toBeNull();
    expect(screen.getByRole("button", { name: "Push to main" })).toBeDisabled();
    expect(SAMPLE_CODE).toBe(before.code);
    expect(JSON.stringify(TAKE_FIXTURES)).toBe(before.takes);
    expect(JSON.stringify(REPO_FIXTURES)).toBe(before.repo);
  });

  it("opens an example immediately without fetching or simulating progress", () => {
    const fetch = vi.spyOn(window, "fetch");
    render(<RepoPopover open fixture={REPO_FIXTURES.noRepo} onOpenDiff={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Clone" }));
    expect(screen.getByRole("button", { name: "Commit" })).toBeEnabled();
    expect(fetch).not.toHaveBeenCalled();
    fetch.mockRestore();
    expect(toast).not.toHaveBeenCalled();
  });

  it.each(Object.keys(REPO_FIXTURES) as (keyof typeof REPO_FIXTURES)[])("renders %s with publishing and pulling unavailable and no credentials", (key) => {
    render(<RepoPopover open fixture={REPO_FIXTURES[key]} onOpenDiff={vi.fn()} />);
    if (REPO_FIXTURES[key].exists) {
      const push = screen.getByRole("button", { name: "Push to main" });
      const pull = screen.getByRole("button", { name: "Pull" });
      expect(push).toBeDisabled();
      expect(pull).toBeDisabled();
      fireEvent.click(push);
      fireEvent.click(pull);
    }
    expect(document.querySelector('input[type="password"]')).toBeNull();
    expect(screen.queryByRole("textbox", { name: /token|email|name/i })).toBeNull();
    expect(toast).not.toHaveBeenCalled();
  });
});