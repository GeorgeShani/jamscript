import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GitPanel } from "@/workbench/GitPanel";
import type { DocumentRecord, WorkspaceStorage } from "@/workspaces/storage";

afterEach(cleanup);

function authStubs(
  overrides: Partial<NonNullable<WorkspaceStorage["git"]>> = {},
): NonNullable<WorkspaceStorage["git"]> {
  return {
    status: vi.fn().mockResolvedValue({ branch: "main", files: [] }),
    initialize: vi.fn(),
    commit: vi.fn(),
    cloneInto: vi.fn(),
    push: vi.fn(),
    pull: vi.fn(),
    githubAuthStatus: vi.fn().mockResolvedValue({ signedIn: false, deviceFlowAvailable: false }),
    beginGitHubDeviceFlow: vi.fn(),
    pollGitHubDeviceFlow: vi.fn(),
    storeGitHubToken: vi.fn().mockResolvedValue({ signedIn: true, deviceFlowAvailable: false }),
    signOutGitHub: vi.fn().mockResolvedValue({ signedIn: false, deviceFlowAvailable: false }),
    ...overrides,
  };
}

describe("optional desktop Git panel", () => {
  it("initializes explicitly and commits only selected saved music files", async () => {
    const files = [{ name: "song.js", status: "untracked" }];
    const git = authStubs({
      status: vi.fn().mockRejectedValue(new Error("No Git repository in this selected folder")),
      initialize: vi.fn().mockResolvedValue({ branch: null, files }),
      commit: vi.fn().mockResolvedValue({ branch: "main", files: [] }),
    });
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
    const git = authStubs({
      push: vi.fn().mockResolvedValue({ branch: "main", files: [] }),
    });
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
    const git = authStubs({
      status: vi
        .fn()
        .mockResolvedValue({ branch: "main", files: [{ name: "old.js", status: "deleted" }] }),
      commit: vi.fn().mockResolvedValue({ branch: "main", files: [] }),
    });
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

  it("stores a pasted GitHub token in the OS credential path", async () => {
    const git = authStubs();
    render(<GitPanel workspaceId="native:folder" documents={[]} git={git} isDirty={() => false} />);
    fireEvent.click(screen.getByText("Git"));
    fireEvent.change(await screen.findByPlaceholderText("github_pat_…"), {
      target: { value: "github_pat_exampletoken" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Store token" }));
    await waitFor(() =>
      expect(git.storeGitHubToken).toHaveBeenCalledWith("github_pat_exampletoken"),
    );
    expect(await screen.findByRole("button", { name: "Sign out of GitHub" })).toBeInTheDocument();
  });
});
