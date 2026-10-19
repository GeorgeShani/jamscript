import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { invoke } from "@tauri-apps/api/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DesktopAuthProvider } from "../../desktop/auth";
import { AuthControls, GuestWorkspaceNotice } from "../../desktop/AuthControls";
import { collaborationApi } from "../../desktop/collaboration-api";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("../../desktop/collaboration-api", () => ({ collaborationApi: vi.fn() }));

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe("desktop guest save notice", () => {
  it("shows the notice when the desktop session is signed out", async () => {
    vi.mocked(invoke).mockResolvedValue({ signedIn: false, available: true });
    render(
      <DesktopAuthProvider>
        <GuestWorkspaceNotice />
      </DesktopAuthProvider>,
    );
    expect(await screen.findByText("Saved locally · No account required")).toBeInTheDocument();
  });

  it("hides the notice for a signed-in session even if its profile request fails", async () => {
    vi.mocked(invoke).mockResolvedValue({ signedIn: true, available: true });
    vi.mocked(collaborationApi).mockRejectedValue(new Error("Profile unavailable"));
    render(
      <DesktopAuthProvider>
        <AuthControls />
        <GuestWorkspaceNotice />
      </DesktopAuthProvider>,
    );
    await waitFor(() => expect(collaborationApi).toHaveBeenCalledWith("/api/desktop-session"));
    expect(await screen.findByRole("alert")).toHaveTextContent("Profile unavailable");
    expect(screen.getByText("● Signed in")).toBeInTheDocument();
    expect(screen.queryByText("Saved locally · No account required")).not.toBeInTheDocument();
  });
});
