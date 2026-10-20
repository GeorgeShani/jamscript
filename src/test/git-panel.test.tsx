import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
  it("animates Push only while its real request is pending and confirms success after it resolves", async () => {
    let finish!: (value: GitWorkspaceStatus) => void;
    const git = authStubs({
      push: vi.fn(
        () =>
          new Promise<GitWorkspaceStatus>((resolve) => {
            finish = resolve;
          }),
      ),
    });
    render(<GitPanel workspaceId="native:folder" documents={[]} git={git} isDirty={() => false} />);
    fireEvent.click(await screen.findByRole("button", { name: "Push" }));
    expect(screen.getByRole("button", { name: "Push" })).toHaveAttribute("data-pending", "true");
    expect(screen.getByText("Pushing commits…")).toBeInTheDocument();
    expect(screen.queryByText("Push complete")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pull" })).toBeDisabled();
    await act(async () => {
      finish(status());
    });
    expect(screen.getByText("Push complete")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Push" })).toHaveAttribute("data-complete", "true");
    expect(screen.getByRole("button", { name: "Push" })).toBeEnabled();
  });

  it("distinguishes Pull failures from successful completion and allows retry", async () => {
    const git = authStubs({
      pull: vi
        .fn()
        .mockRejectedValueOnce(new Error("Connection interrupted"))
        .mockResolvedValueOnce(status()),
    });
    render(<GitPanel workspaceId="native:folder" documents={[]} git={git} isDirty={() => false} />);
    fireEvent.click(await screen.findByRole("button", { name: "Pull" }));
    expect(await screen.findByText("Pull failed")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Connection interrupted");
    expect(screen.queryByText("Pull complete")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Pull" }));
    expect(await screen.findByText("Pull complete")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("acknowledges an explicit status refresh", async () => {
    render(
      <GitPanel
        workspaceId="native:folder"
        documents={[]}
        git={authStubs()}
        isDirty={() => false}
      />,
    );
    await screen.findByText("No local changes");
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    expect(await screen.findByText("Status refreshed")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Refresh" })).toBeEnabled();
  });

  it("shows a clean working tree as status and keeps commit controls out of the empty state", async () => {
    render(
      <GitPanel
        workspaceId="native:folder"
        documents={[]}
        git={authStubs()}
        isDirty={() => false}
      />,
    );
    expect(await screen.findByText("No local changes")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Saved files match the last commit");
    expect(screen.queryByLabelText("Commit message")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Commit" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Push" })).toBeEnabled();
  });

  it("does not claim the whole repository is clean when other file types have changes", async () => {
    const git = authStubs({
      status: vi
        .fn()
        .mockResolvedValue(status({ files: [{ name: "notes.txt", status: "modified" }] })),
    });
    render(<GitPanel workspaceId="native:folder" documents={[]} git={git} isDirty={() => false} />);
    expect(await screen.findByText("No music file changes")).toBeInTheDocument();
    expect(screen.queryByText("No local changes")).not.toBeInTheDocument();
  });

  it("does not report a clean repository while status is still loading", () => {
    const git = authStubs({ status: vi.fn(() => new Promise<GitWorkspaceStatus>(() => {})) });
    render(<GitPanel workspaceId="native:folder" documents={[]} git={git} isDirty={() => false} />);
    expect(screen.getByRole("status")).toHaveTextContent("Checking saved files");
    expect(screen.queryByText("No local changes")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Push" })).not.toBeInTheDocument();
  });

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

  it("blocks committing a selected file after its editor becomes unsaved", async () => {
    const git = authStubs({
      status: vi
        .fn()
        .mockResolvedValue(status({ files: [{ name: "song.js", status: "modified" }] })),
    });
    const document: DocumentRecord = {
      id: "song",
      workspaceId: "native:folder",
      name: "song.js",
      source: 's("bd")',
      createdAt: 0,
      updatedAt: 0,
    };
    let dirty = false;
    const props = {
      workspaceId: "native:folder",
      documents: [document],
      git,
      isDirty: () => dirty,
    };
    const { rerender } = render(<GitPanel {...props} />);
    fireEvent.change(await screen.findByLabelText("Commit message"), {
      target: { value: "Change drums" },
    });
    expect(screen.getByRole("button", { name: "Commit" })).toBeEnabled();
    dirty = true;
    rerender(<GitPanel {...props} />);
    expect(screen.getByRole("button", { name: "Commit" })).toBeDisabled();
    expect(screen.getByText("Save selected files before committing.")).toBeInTheDocument();
    expect(git.commit).not.toHaveBeenCalled();
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
