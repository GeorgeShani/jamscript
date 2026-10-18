import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GitPanel } from "@/workbench/GitPanel";
import type { DocumentRecord, GitWorkspaceStatus, WorkspaceStorage } from "@/workspaces/storage";

afterEach(cleanup);

function status(partial: Partial<GitWorkspaceStatus> = {}): GitWorkspaceStatus {
  return {
    branch: "main",
    files: [],
    hasOrigin: true,
    originUrl: "https://github.com/example/songs.git",
    ...partial,
  };
}

function authStubs(
  overrides: Partial<NonNullable<WorkspaceStorage["git"]>> = {},
): NonNullable<WorkspaceStorage["git"]> {
  return {
    status: vi.fn().mockResolvedValue(status()),
    initialize: vi.fn(),
    commit: vi.fn(),
    cloneInto: vi.fn(),
    setOrigin: vi.fn().mockResolvedValue(status()),
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
  it("initializes and commits only selected saved music files", async () => {
    const files = [{ name: "song.js", status: "untracked" }];
    const git = authStubs({
      status: vi.fn().mockRejectedValue(new Error("No Git repository in this selected folder")),
      initialize: vi
        .fn()
        .mockResolvedValue(status({ branch: null, files, hasOrigin: false, originUrl: null })),
      commit: vi.fn().mockResolvedValue(status({ files: [] })),
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
    fireEvent.click(await screen.findByRole("button", { name: "Init repository" }));
    await screen.findByText(/song\.js/);
    fireEvent.change(screen.getByLabelText("Commit message"), {
      target: { value: "Add kick pattern" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Commit" }));
    await waitFor(() =>
      expect(git.commit).toHaveBeenCalledWith("native:folder", [document], [], "Add kick pattern"),
    );
  });

  it("refuses pull while any file has unsaved changes", async () => {
    const git = authStubs({
      push: vi.fn().mockResolvedValue(status()),
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
    expect(await screen.findByRole("button", { name: "Pull" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Push" }));
    await waitFor(() => expect(git.push).toHaveBeenCalledWith("native:folder"));
  });

  it("adds a remote origin from the sidebar", async () => {
    const git = authStubs({
      status: vi.fn().mockResolvedValue(status({ hasOrigin: false, originUrl: null })),
      setOrigin: vi
        .fn()
        .mockResolvedValue(status({ originUrl: "https://github.com/owner/songs.git" })),
    });
    render(<GitPanel workspaceId="native:folder" documents={[]} git={git} isDirty={() => false} />);
    fireEvent.change(await screen.findByLabelText("Remote origin"), {
      target: { value: "https://github.com/owner/songs.git" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() =>
      expect(git.setOrigin).toHaveBeenCalledWith(
        "native:folder",
        "https://github.com/owner/songs.git",
      ),
    );
  });

  it("stores a pasted GitHub token", async () => {
    const git = authStubs();
    render(<GitPanel workspaceId="native:folder" documents={[]} git={git} isDirty={() => false} />);
    fireEvent.click(await screen.findByText("GitHub · sign in"));
    fireEvent.change(screen.getByLabelText("GitHub token"), {
      target: { value: "github_pat_exampletoken" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Store" }));
    await waitFor(() =>
      expect(git.storeGitHubToken).toHaveBeenCalledWith("github_pat_exampletoken"),
    );
    expect(await screen.findByText("GitHub · connected")).toBeInTheDocument();
  });
});
