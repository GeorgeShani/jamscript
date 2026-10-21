import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SharedProjectList } from "../../desktop/ShareControls";
import { collaborationApi } from "../../desktop/collaboration-api";

const auth = vi.hoisted(() => ({ person: { id: "user_1", name: "Musician" } }));
vi.mock("../../desktop/auth-context", () => ({ useDesktopAuth: () => auth }));
vi.mock("../../desktop/collaboration-api", () => ({ collaborationApi: vi.fn() }));

const projects = [
  {
    workspaceId: "workspace_1",
    workspaceName: "Coastline",
    documentId: "document_1",
    documentName: "song.js",
    role: "owner",
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(collaborationApi).mockResolvedValue(projects);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("desktop shared workspace loading", () => {
  it("avoids refetching on account object rerenders and repeated window focus", async () => {
    const clock = vi.spyOn(Date, "now").mockReturnValue(100_000);
    const view = render(<SharedProjectList />);
    await screen.findByText("Coastline");
    auth.person = { ...auth.person };
    view.rerender(<SharedProjectList />);
    fireEvent.focus(window);
    fireEvent.focus(window);
    expect(collaborationApi).toHaveBeenCalledTimes(1);
    clock.mockReturnValue(131_000);
    fireEvent.focus(window);
    await waitFor(() => expect(collaborationApi).toHaveBeenCalledTimes(2));
  });

  it("keeps loaded workspaces usable while refreshing and ignores focus during a request", async () => {
    render(<SharedProjectList />);
    await screen.findByText("Coastline");
    vi.mocked(collaborationApi).mockImplementation(() => new Promise(() => {}));
    fireEvent.click(screen.getByRole("button", { name: "Refresh shared workspaces" }));
    expect(screen.getByText("Coastline")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Refresh shared workspaces" })).toBeDisabled();
    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 60_000);
    fireEvent.focus(window);
    expect(collaborationApi).toHaveBeenCalledTimes(2);
  });
});
