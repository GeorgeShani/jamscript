import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { invoke } from "@tauri-apps/api/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DesktopAuthProvider, useDesktopAuth } from "../../desktop/auth";
import { AuthControls, GuestWorkspaceNotice } from "../../desktop/AuthControls";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

beforeEach(() => vi.clearAllMocks());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("desktop guest save notice", () => {
  it("shows the Clerk photo and falls back to initials when loading fails", async () => {
    vi.mocked(invoke).mockImplementation(async (command) => {
      if (command === "desktop_auth_status") return { signedIn: true, available: true };
      if (command === "desktop_auth_profile")
        return {
          id: "photo-user",
          name: "Test Player",
          imageUrl: "https://img.clerk.com/test-photo.png",
        };
      return undefined;
    });
    render(
      <DesktopAuthProvider>
        <AuthControls />
      </DesktopAuthProvider>,
    );
    const trigger = await screen.findByRole("button", { name: "Open account profile" });
    const image = trigger.querySelector("img")!;
    expect(image).toHaveAttribute("src", "https://img.clerk.com/test-photo.png");
    fireEvent.error(image);
    expect(trigger).toHaveTextContent("TP");
    fireEvent.click(trigger);
    expect(screen.getByRole("dialog").querySelector("img")).toHaveAttribute(
      "src",
      "https://img.clerk.com/test-photo.png",
    );
  });

  it("checks approval immediately on focus and follows the native retry delay", async () => {
    vi.useFakeTimers();
    vi.mocked(invoke).mockImplementation(async (command) => {
      if (command === "desktop_auth_status")
        return {
          signedIn: false,
          available: true,
          pending: {
            userCode: "POLL-CODE",
            verificationUri: "https://clerk.example/device",
            interval: 5,
            expiresIn: 600,
          },
        };
      if (command === "desktop_auth_poll") return { status: "pending", retryAfterMs: 10_000 };
      return undefined;
    });
    render(
      <DesktopAuthProvider>
        <AuthControls />
      </DesktopAuthProvider>,
    );
    await act(async () => {});
    await act(async () => {
      fireEvent.focus(window);
    });
    const polls = () =>
      vi.mocked(invoke).mock.calls.filter(([command]) => command === "desktop_auth_poll");
    expect(polls()).toHaveLength(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(9999);
    });
    expect(polls()).toHaveLength(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(polls()).toHaveLength(2);
  });

  it("bounds automatic checks when DNS stays unavailable", async () => {
    vi.useFakeTimers();
    vi.mocked(invoke).mockImplementation(async (command) => {
      if (command === "desktop_auth_status") return { signedIn: true, available: true };
      if (command === "desktop_auth_profile") throw "ACCOUNT_NETWORK_UNAVAILABLE";
      return undefined;
    });
    render(
      <DesktopAuthProvider>
        <AuthControls />
      </DesktopAuthProvider>,
    );
    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(120_000);
    });
    expect(
      vi.mocked(invoke).mock.calls.filter(([name]) => name === "desktop_auth_profile"),
    ).toHaveLength(4);
    expect(screen.getByText("Saved sign-in")).toBeInTheDocument();
  });

  it("ignores an account check that completes after sign out", async () => {
    let finish!: (person: { id: string; name: string }) => void;
    const request = new Promise((resolve) => {
      finish = resolve;
    });
    vi.mocked(invoke).mockImplementation(async (command) => {
      if (command === "desktop_auth_status") return { signedIn: true, available: true };
      if (command === "desktop_auth_profile") return request;
      if (command === "desktop_auth_sign_out") return { signedIn: false, available: true };
      return undefined;
    });
    function Status() {
      const auth = useDesktopAuth();
      return (
        <>
          <button onClick={() => void auth.signOut()}>Sign out test</button>
          <span>{auth.person?.name ?? "No verified account"}</span>
        </>
      );
    }
    render(
      <DesktopAuthProvider>
        <Status />
      </DesktopAuthProvider>,
    );
    await waitFor(() => expect(invoke).toHaveBeenCalledWith("desktop_auth_profile"));
    fireEvent.click(screen.getByRole("button", { name: "Sign out test" }));
    await act(async () => {
      finish({ id: "previous", name: "Previous account" });
    });
    expect(screen.getByText("No verified account")).toBeInTheDocument();
  });
  it("keeps a saved sign-in distinct from signing out after a DNS failure and recovers on reconnect", async () => {
    let checks = 0;
    vi.mocked(invoke).mockImplementation(async (command) => {
      if (command === "desktop_auth_status") return { signedIn: true, available: true };
      if (command === "desktop_auth_profile") {
        if (checks++ === 0)
          throw "Could not verify JamScript account with Clerk: Dns Failed: resolve dns name 'example.clerk.accounts.dev:443': No such host is known. (os error 11001)";
        return { id: "user_1", name: "Player", email: "player@example.com" };
      }
      return undefined;
    });
    render(
      <DesktopAuthProvider>
        <AuthControls />
      </DesktopAuthProvider>,
    );
    expect(await screen.findByText("Saved sign-in")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Can't reach the account service");
    expect(screen.getByRole("alert")).not.toHaveTextContent("os error");
    expect(screen.queryByRole("button", { name: "Sign in to JamScript" })).not.toBeInTheDocument();
    fireEvent(window, new Event("online"));
    expect(await screen.findByRole("button", { name: "Open account profile" })).toBeInTheDocument();
    expect(invoke).not.toHaveBeenCalledWith("desktop_auth_sign_out");
  });

  it("shows the notice when the desktop session is signed out", async () => {
    vi.mocked(invoke).mockResolvedValue({ signedIn: false, available: true });
    render(
      <DesktopAuthProvider>
        <GuestWorkspaceNotice />
      </DesktopAuthProvider>,
    );
    expect(await screen.findByText("Saved locally · No account required")).toBeInTheDocument();
  });

  it("does not claim a stored token is signed in when its profile cannot be verified", async () => {
    let checks = 0;
    vi.mocked(invoke).mockImplementation(async (command) => {
      if (command === "desktop_auth_status") return { signedIn: true, available: true };
      if (command === "desktop_auth_profile") {
        if (checks++ === 0) throw new Error("Clerk profile unavailable");
        return { id: "user_1", name: "Musician", email: "musician@example.com" };
      }
      return undefined;
    });
    render(
      <DesktopAuthProvider>
        <AuthControls />
        <GuestWorkspaceNotice />
      </DesktopAuthProvider>,
    );
    await waitFor(() => expect(invoke).toHaveBeenCalledWith("desktop_auth_profile"));
    expect(await screen.findByRole("alert")).toHaveTextContent("Clerk profile unavailable");
    expect(screen.queryByText("● Signed in")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in to JamScript" })).toBeInTheDocument();
    expect(screen.getByText("Saved locally · No account required")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry account check" }));
    fireEvent.click(await screen.findByRole("button", { name: "Open account profile" }));
    expect(screen.getByText("musician@example.com")).toBeInTheDocument();
  });

  it("offers a fresh sign-in when the native credential disappeared", async () => {
    let statusChecks = 0;
    vi.mocked(invoke).mockImplementation(async (command) => {
      if (command === "desktop_auth_status")
        return { signedIn: statusChecks++ === 0, available: true };
      if (command === "desktop_auth_profile")
        throw new Error("Sign in to JamScript to collaborate");
      return undefined;
    });
    render(
      <DesktopAuthProvider>
        <AuthControls />
      </DesktopAuthProvider>,
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Browser approval did not create a desktop session. Sign in again.",
    );
    expect(screen.getByRole("button", { name: "Sign in to JamScript" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Retry account check" })).not.toBeInTheDocument();
  });

  it("keeps sign-in available and can clear an unreadable saved session", async () => {
    vi.mocked(invoke).mockImplementation(async (command) => {
      if (command === "desktop_auth_status")
        return {
          signedIn: false,
          available: true,
          warning: "Stored JamScript sign-in is invalid. Clear saved sign-in and try again",
        };
      if (command === "desktop_auth_sign_out") return { signedIn: false, available: true };
      return undefined;
    });
    render(
      <DesktopAuthProvider>
        <AuthControls />
      </DesktopAuthProvider>,
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Stored JamScript sign-in is invalid",
    );
    expect(screen.getByRole("button", { name: "Sign in to JamScript" })).toBeEnabled();
    expect(screen.queryByText("Collaboration unavailable")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear saved sign-in" }));
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    expect(invoke).toHaveBeenCalledWith("desktop_auth_sign_out");
  });

  it("opens account selection in the browser instead of requiring a private window", async () => {
    vi.mocked(invoke).mockImplementation(async (command) => {
      if (command === "desktop_auth_status") return { signedIn: false, available: true };
      if (command === "desktop_auth_begin")
        return {
          userCode: "TEST-CODE",
          verificationUri: "https://example.clerk.accounts.dev/device",
          verificationUriComplete: "https://example.clerk.accounts.dev/device?user_code=TEST-CODE",
          interval: 600,
          expiresIn: 600,
        };
      return undefined;
    });
    render(
      <DesktopAuthProvider>
        <AuthControls />
      </DesktopAuthProvider>,
    );
    fireEvent.click(await screen.findByRole("button", { name: "Sign in to JamScript" }));
    expect(await screen.findByText("TEST-CODE")).toBeInTheDocument();
    expect(invoke).not.toHaveBeenCalledWith("desktop_auth_open_verification");
    fireEvent.click(screen.getByRole("button", { name: "Continue in browser" }));
    await waitFor(() => expect(invoke).toHaveBeenCalledWith("desktop_auth_open_verification"));
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Dismiss sign-in panel" }));
    expect(screen.getByRole("button", { name: "Sign-in pending" })).toBeInTheDocument();
  });

  it("shows the verified account and offers account switching without signing out first", async () => {
    vi.mocked(invoke).mockImplementation(async (command) => {
      if (command === "desktop_auth_status") return { signedIn: true, available: true };
      if (command === "desktop_auth_profile")
        return {
          id: "user_1",
          name: "Musician",
          email: "musician@example.com",
        };
      if (command === "desktop_auth_begin")
        return {
          userCode: "SWITCH-CODE",
          verificationUri: "https://example.clerk.accounts.dev/device",
          interval: 600,
          expiresIn: 600,
        };
      return undefined;
    });
    render(
      <DesktopAuthProvider>
        <AuthControls />
      </DesktopAuthProvider>,
    );
    fireEvent.click(await screen.findByRole("button", { name: "Open account profile" }));
    expect(screen.getByText("musician@example.com")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Switch account" }));
    expect(await screen.findByText("SWITCH-CODE")).toBeInTheDocument();
    expect(invoke).not.toHaveBeenCalledWith("desktop_auth_sign_out");
  });

  it("restores a pending device approval and signs in without the collaboration API", async () => {
    vi.mocked(invoke).mockImplementation(async (command) => {
      if (command === "desktop_auth_status")
        return {
          signedIn: false,
          available: true,
          pending: {
            userCode: "RESTORED-CODE",
            verificationUri: "https://example.clerk.accounts.dev/device",
            interval: 1,
            expiresIn: 600,
          },
        };
      if (command === "desktop_auth_poll") return { status: "complete" };
      if (command === "desktop_auth_profile")
        return {
          id: "user_2",
          name: "Restored player",
          email: "restored@example.com",
        };
      return undefined;
    });
    render(
      <DesktopAuthProvider>
        <AuthControls />
        <GuestWorkspaceNotice />
      </DesktopAuthProvider>,
    );
    expect(await screen.findByText("RESTORED-CODE")).toBeInTheDocument();
    fireEvent.click(
      await screen.findByRole("button", { name: "Open account profile" }, { timeout: 2000 }),
    );
    expect(screen.getByText("restored@example.com")).toBeInTheDocument();
    expect(screen.queryByText("Saved locally · No account required")).not.toBeInTheDocument();
    expect(invoke).not.toHaveBeenCalledWith("desktop_collaboration_request", expect.anything());
  });

  it("keeps polling after a temporary Clerk connection error", async () => {
    let polls = 0;
    vi.mocked(invoke).mockImplementation(async (command) => {
      if (command === "desktop_auth_status")
        return {
          signedIn: false,
          available: true,
          pending: {
            userCode: "RETRY-CODE",
            verificationUri: "https://example.clerk.accounts.dev/device",
            interval: 1,
            expiresIn: 600,
          },
        };
      if (command === "desktop_auth_poll") {
        if (polls++ === 0) throw new Error("Connection interrupted");
        return { status: "complete" };
      }
      if (command === "desktop_auth_profile")
        return {
          id: "user_3",
          name: "Player",
          email: "player@example.com",
        };
      return undefined;
    });
    render(
      <DesktopAuthProvider>
        <AuthControls />
      </DesktopAuthProvider>,
    );
    expect(await screen.findByText("RETRY-CODE")).toBeInTheDocument();
    expect(await screen.findByRole("alert", {}, { timeout: 2000 })).toHaveTextContent(
      "Can't reach the account service",
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Open account profile" }, { timeout: 3000 }),
    );
    expect(screen.getByText("player@example.com")).toBeInTheDocument();
  });

  it("opens verified profile details and signs out through the native account action", async () => {
    vi.mocked(invoke).mockImplementation(async (command) => {
      if (command === "desktop_auth_status") return { signedIn: true, available: true };
      if (command === "desktop_auth_profile")
        return { id: "user_1", name: "Test Player", email: "player@example.com" };
      if (command === "desktop_auth_sign_out") return { signedIn: false, available: true };
      return undefined;
    });
    render(
      <DesktopAuthProvider>
        <AuthControls />
      </DesktopAuthProvider>,
    );
    expect(screen.queryByRole("button", { name: "Sign out" })).not.toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: "Open account profile" }));
    expect(screen.getByRole("dialog", { name: "JamScript profile" })).toBeInTheDocument();
    expect(screen.getByText("Test Player")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(await screen.findByRole("button", { name: "Sign in to JamScript" })).toBeInTheDocument();
    expect(invoke).toHaveBeenCalledWith("desktop_auth_sign_out");
  });
});
