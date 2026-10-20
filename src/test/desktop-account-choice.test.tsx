import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AccountChoice } from "@/features/account/DesktopConnect";
import { DeviceSignInPanel } from "../../desktop/DeviceSignInPanel";

const clerk = vi.hoisted(() => ({
  user: {
    isLoaded: true,
    isSignedIn: true,
    user: {
      fullName: "Musician",
      imageUrl: "",
      primaryEmailAddress: { emailAddress: "player@example.com" },
    },
  },
  signOut: vi.fn(),
  props: vi.fn(),
}));
vi.mock("@clerk/tanstack-react-start", () => ({
  useUser: () => clerk.user,
  useClerk: () => ({ signOut: clerk.signOut }),
  SignIn: (props: unknown) => {
    clerk.props(props);
    return <div>Clerk sign-in methods</div>;
  },
  OAuthDeviceVerification: () => <div>Clerk device consent</div>,
  SignUp: (props: unknown) => {
    clerk.props(props);
    return <div>Clerk registration methods</div>;
  },
}));
beforeEach(() => {
  clerk.user.isSignedIn = true;
  clerk.signOut.mockReset().mockResolvedValue(undefined);
  clerk.props.mockClear();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("asks which browser account to use before rendering consent", () => {
  render(<AccountChoice userCode="TEST-CODE" />);
  expect(screen.getByText("player@example.com")).toBeInTheDocument();
  expect(screen.queryByText("Clerk device consent")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Continue with this account" }));
  expect(screen.getByText("Clerk device consent")).toBeInTheDocument();
  expect(clerk.signOut).not.toHaveBeenCalled();
});

it("opens Clerk sign-in methods after an explicit browser account change", async () => {
  const { rerender } = render(<AccountChoice userCode="TEST-CODE" />);
  expect(screen.getByText(/This signs you out/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Use another account" }));
  expect(clerk.signOut).toHaveBeenCalledWith({
    redirectUrl: "/desktop/connect?user_code=TEST-CODE",
  });
  clerk.user.isSignedIn = false;
  rerender(<AccountChoice userCode="TEST-CODE" />);
  expect(screen.getByText("Clerk sign-in methods")).toBeInTheDocument();
  expect(clerk.props).toHaveBeenCalledWith(
    expect.objectContaining({
      forceRedirectUrl: "/desktop/connect?user_code=TEST-CODE",
      oidcPrompt: "select_account",
      signUpForceRedirectUrl: "/desktop/connect?user_code=TEST-CODE",
    }),
  );
  await act(async () => {});
});

it("recovers when changing the browser account fails", async () => {
  clerk.signOut.mockRejectedValueOnce(new Error("offline"));
  render(<AccountChoice userCode="TEST-CODE" />);
  fireEvent.click(screen.getByRole("button", { name: "Use another account" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't switch accounts");
  expect(screen.getByRole("button", { name: "Use another account" })).toBeEnabled();
});

it("copies the account chooser link and exposes a selectable fallback if clipboard access fails", async () => {
  const writeText = vi.fn().mockRejectedValueOnce(new Error("denied")).mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
  const link = "https://jamscript.example/desktop/connect?user_code=TEST-CODE";
  render(
    <DeviceSignInPanel
      code="TEST-CODE"
      link={link}
      switching
      error={null}
      openBrowser={async () => {}}
      dismiss={() => {}}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Copy sign-in link" }));
  expect(await screen.findByRole("textbox", { name: "Copy this sign-in link" })).toHaveValue(link);
  fireEvent.click(screen.getByRole("button", { name: "Copy sign-in link" }));
  expect(await screen.findByRole("button", { name: "Link copied" })).toBeInTheDocument();
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  expect(writeText).toHaveBeenCalledWith(link);
});
