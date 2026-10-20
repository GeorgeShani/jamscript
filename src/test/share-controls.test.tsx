import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("@clerk/tanstack-react-start", () => ({ useAuth: () => ({ isSignedIn: true }) }));
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => vi.fn() }));

import { ShareControls } from "@/features/collaboration/ShareControls";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

it("shows a selectable link and a safe reason when Resend cannot deliver an invite", async () => {
  vi.stubEnv("VITE_CLERK_PUBLISHABLE_KEY", "pk_test_share_controls");
  const url = "https://jamscript.example/app/invitations/test-token";
  const fetcher = vi.fn(async (input: string, init?: RequestInit) => {
    if (!init?.method) return Response.json({ members: [], invitations: [] });
    return Response.json({
      invitationId: "invite",
      delivery: "link",
      url,
      invitationError:
        "Email delivery is not configured. Set RESEND_API_KEY, MAIL_FROM on the server.",
    });
  });
  vi.stubGlobal("fetch", fetcher);
  const document = {
    id: "song",
    workspaceId: "workspace",
    name: "song.js",
    source: 's("bd")',
    createdAt: 1,
    updatedAt: 1,
    shared: { workspaceId: "workspace", documentId: "song", role: "owner" as const },
  };
  render(
    <ShareControls
      document={document}
      documents={[document]}
      workspaceName="My songs"
      onShared={vi.fn()}
    />,
  );
  fireEvent.click(screen.getByText("Collaborators"));
  fireEvent.change(screen.getByLabelText("Collaborator email"), {
    target: { value: "editor@example.com" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Send invite" }));
  expect(await screen.findByRole("status")).toHaveTextContent("Set RESEND_API_KEY, MAIL_FROM");
  expect(screen.getByLabelText("Invitation link")).toHaveValue(url);
  expect(screen.getByLabelText("Collaborator email")).toHaveValue("editor@example.com");
  await waitFor(() =>
    expect(fetcher).toHaveBeenCalledWith(
      "/api/shared-projects",
      expect.objectContaining({ method: "POST" }),
    ),
  );
});
