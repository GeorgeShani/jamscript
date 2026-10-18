// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";

import {
  deliverInvitation,
  invitationEmailText,
  sendInvitationEmail,
} from "@/features/collaboration/invitation-email.server";

const invitation = {
  to: "guest@example.com",
  workspaceName: "Coastline",
  role: "editor" as const,
  url: "https://jamscript.example/app/invitations/token",
};

const mailNames = ["RESEND_API_KEY", "MAIL_FROM", "RESEND_FROM"];

function clearMail() {
  for (const name of mailNames) vi.stubEnv(name, "");
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

it("keeps a manual invite link when Resend is not configured", async () => {
  clearMail();
  expect(await sendInvitationEmail(invitation)).toBe(false);
  expect(invitationEmailText(invitation)).toContain(invitation.url);
});

it("sends through the Resend HTTP API", async () => {
  clearMail();
  vi.stubEnv("RESEND_API_KEY", "re_test");
  vi.stubEnv("MAIL_FROM", "JamScript <onboarding@resend.dev>");
  const fetchMock = vi
    .fn()
    .mockResolvedValue(new Response(JSON.stringify({ id: "email_123" }), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  expect(await sendInvitationEmail(invitation)).toBe(true);
  expect(fetchMock).toHaveBeenCalledWith(
    "https://api.resend.com/emails",
    expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({ Authorization: "Bearer re_test" }),
    }),
  );
  const body = JSON.parse((fetchMock.mock.calls[0]?.[1] as RequestInit).body as string) as {
    to: string[];
    text: string;
    from: string;
  };
  expect(body).toMatchObject({
    from: "JamScript <onboarding@resend.dev>",
    to: [invitation.to],
  });
  expect(body.text).toContain(invitation.url);
});

it("accepts RESEND_FROM and quoted env values", async () => {
  clearMail();
  vi.stubEnv("RESEND_API_KEY", '"re_quoted"');
  vi.stubEnv("RESEND_FROM", "JamScript <invite@example.com>");
  const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  expect(await sendInvitationEmail(invitation)).toBe(true);
  expect(fetchMock.mock.calls[0]?.[1]).toEqual(
    expect.objectContaining({
      headers: expect.objectContaining({ Authorization: "Bearer re_quoted" }),
    }),
  );
});

it("rejects partial configuration before trying to send", async () => {
  clearMail();
  vi.stubEnv("RESEND_API_KEY", "re_test");
  await expect(sendInvitationEmail(invitation)).rejects.toThrow(/incomplete/);
  expect(await deliverInvitation(invitation)).toEqual({
    delivery: "link",
    url: invitation.url,
    invitationError: expect.stringContaining("MAIL_FROM (or RESEND_FROM)"),
  });
});

it("keeps a usable link and reports a safe reason after Resend rejects the key", async () => {
  clearMail();
  vi.stubEnv("RESEND_API_KEY", "re_bad");
  vi.stubEnv("MAIL_FROM", "JamScript <onboarding@resend.dev>");
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: "API key is invalid", name: "validation_error" }), {
        status: 401,
      }),
    ),
  );
  const result = await deliverInvitation(invitation);
  expect(result).toEqual({
    delivery: "link",
    url: invitation.url,
    invitationError: "Resend rejected the API key. Check RESEND_API_KEY on the server.",
  });
  expect(JSON.stringify(result)).not.toContain("API key is invalid");
});

it("explains unverified sender domains without exposing raw provider text", async () => {
  clearMail();
  vi.stubEnv("RESEND_API_KEY", "re_test");
  vi.stubEnv("MAIL_FROM", "JamScript <no-reply@jamscript.dev>");
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: "The jamscript.dev domain is not verified" }), {
        status: 422,
      }),
    ),
  );
  expect(await deliverInvitation(invitation)).toEqual({
    delivery: "link",
    url: invitation.url,
    invitationError: expect.stringContaining("Verify MAIL_FROM on a Resend domain"),
  });
});
