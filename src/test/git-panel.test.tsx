import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GitPanel } from "@/workbench/GitPanel";
import type { DocumentRecord, WorkspaceStorage } from "@/workspaces/storage";

afterEach(cleanup);

describe("optional desktop Git panel", () => {
  it("initializes explicitly and commits only selected saved music files", async () => {
    const files = [{ name: "song.js", status: "untracked" }];
    const git = {
      status: vi.fn().mockRejectedValue(new Error("No Git repository in this selected folder")),
      initialize: vi.fn().mockResolvedValue({ branch: null, files }),
      commit: vi.fn().mockResolvedValue({ branch: "main", files: [] }),
      cloneInto: vi.fn().mockResolvedValue({ branch: "main", files: [] }),
      push: vi.fn().mockResolvedValue({ branch: "main", files: [] }),
      pull: vi.fn().mockResolvedValue({ branch: "main", files: [] }),
    } satisfies NonNullable<WorkspaceStorage["git"]>;
    const document = {
      id: "song",
      workspaceId: "native:folder",
      name: "song.js",
      source: 's("bd")',
      createdAt: 0,
      updatedAt: 0,
    } satisfies DocumentRecord;
    render(
      <GitPanel
        workspaceId="native:folder"
        documents={[document]}
        git={git}
        isDirty={() => false}
      />,
    );
    fireEvent.click(screen.getByText("Git"));
    fireEvent.click(await screen.findByRole("button", { name: "Initialize Git" }));
    await screen.findByText(/1 changed music files/);
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.change(screen.getByRole("textbox", { name: "Commit message" }), {
      target: { value: "Add kick pattern" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Commit selected files" }));
    await waitFor(() =>
      expect(git.commit).toHaveBeenCalledWith("native:folder", [document], [], "Add kick pattern"),
    );
  });
  it("refuses pull while any file has unsaved changes", async () => {
    const git = {
      status: vi.fn().mockResolvedValue({ branch: "main", files: [] }),
      initialize: vi.fn(),
      commit: vi.fn(),
      cloneInto: vi.fn(),
      push: vi.fn().mockResolvedValue({ branch: "main", files: [] }),
      pull: vi.fn().mockResolvedValue({ branch: "main", files: [] }),
    } satisfies NonNullable<WorkspaceStorage["git"]>;
    const document = {
      id: "song",
      workspaceId: "native:folder",
      name: "song.js",
      source: 's("bd")',
      createdAt: 0,
      updatedAt: 0,
    } satisfies DocumentRecord;
    render(
      <GitPanel
        workspaceId="native:folder"
        documents={[document]}
        git={git}
        isDirty={() => true}
      />,
    );
    fireEvent.click(screen.getByText("Git"));
    expect(await screen.findByRole("button", { name: "Pull fast-forward" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Push commits" }));
    await waitFor(() => expect(git.push).toHaveBeenCalledWith("native:folder"));
  });

  it("commits an explicitly selected deleted music file", async () => {
    const git = {
      status: vi
        .fn()
        .mockResolvedValue({ branch: "main", files: [{ name: "old.js", status: "deleted" }] }),
      initialize: vi.fn(),
      cloneInto: vi.fn(),
      push: vi.fn(),
      pull: vi.fn(),
      commit: vi.fn().mockResolvedValue({ branch: "main", files: [] }),
    } satisfies NonNullable<WorkspaceStorage["git"]>;
    render(<GitPanel workspaceId="native:folder" documents={[]} git={git} isDirty={() => false} />);
    fireEvent.click(screen.getByText("Git"));
    fireEvent.click(await screen.findByRole("checkbox"));
    fireEvent.change(screen.getByRole("textbox", { name: "Commit message" }), {
      target: { value: "Remove old song" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Commit selected files" }));
    await waitFor(() =>
      expect(git.commit).toHaveBeenCalledWith("native:folder", [], ["old.js"], "Remove old song"),
    );
  });
});
