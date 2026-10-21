// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";

import {
  deliverInvitation,
  invitationEmailHtml,
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
    html: string;
  };
  expect(body).toMatchObject({
    from: "JamScript <onboarding@resend.dev>",
    to: [invitation.to],
  });
  expect(body.text).toContain(invitation.url);
  expect(body.html).toContain("Accept invitation");
  expect(body.html).toContain(`href="${invitation.url}"`);
  expect(body.html).not.toContain("<mjml");
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

it("escapes dynamic email content and substitutes values in one pass", () => {
  const html = invitationEmailHtml({
    ...invitation,
    workspaceName: '<img src=x onerror="alert(1)"> & {{roleLabel}}',
    to: 'guest+"quoted"@example.com',
    url: "https://jamscript.dev/app/invitations/token?first=1&second=2",
  });
  expect(html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; {{roleLabel}}");
  expect(html).not.toContain('<img src=x onerror="alert(1)">');
  expect(html).toContain("guest+&quot;quoted&quot;@example.com");
  expect(html).toContain('href="https://jamscript.dev/app/invitations/token?first=1&amp;second=2"');
  expect(html).toContain("an editor");
  expect(html).toContain("expires in 7 days");
});

it("uses viewer access copy and rejects executable invitation URLs", () => {
  expect(invitationEmailHtml({ ...invitation, role: "viewer" })).toContain("a viewer");
  expect(() => invitationEmailHtml({ ...invitation, url: "javascript:alert(1)" })).toThrow(
    /HTTP or HTTPS/,
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

it.each([
  [
    "You can only send testing emails to your own email address (owner@example.com). To send emails to other recipients, please verify a domain.",
    /testing sender.*Verify a sending domain/,
  ],
  ["The jamscript.dev domain is not verified", /Verify MAIL_FROM on a Resend domain/],
])("does not mislabel sender restrictions as invalid keys: %s", async (message, expected) => {
  clearMail();
  vi.stubEnv("RESEND_API_KEY", "re_valid");
  vi.stubEnv("MAIL_FROM", "JamScript <onboarding@resend.dev>");
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ name: "validation_error", message }), { status: 403 }),
      ),
  );
  const result = await deliverInvitation(invitation);
  expect(result).toMatchObject({ delivery: "link", url: invitation.url });
  expect(result.invitationError).toMatch(expected);
  expect(result.invitationError).not.toContain("Check RESEND_API_KEY");
  expect(result.invitationError).not.toContain("owner@example.com");
});

it("does not expose raw provider messages for unknown rejections", async () => {
  clearMail();
  vi.stubEnv("RESEND_API_KEY", "re_valid");
  vi.stubEnv("MAIL_FROM", "JamScript <invite@jamscript.dev>");
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ message: "Internal detail re_valid" }), { status: 500 }),
      ),
  );
  const result = await deliverInvitation(invitation);
  expect(result.invitationError).toContain("HTTP 500");
  expect(result.invitationError).not.toContain("Internal detail");
  expect(result.invitationError).not.toContain("re_valid");
});

it.each([
  ["restricted_api_key", "API key is not active", /Check RESEND_API_KEY/],
  ["suspended_api_key", "This API key is suspended", /Check RESEND_API_KEY/],
  ["invalid_permission", "Access token is missing required scopes", /Sending access/],
  ["validation_error", "Unexpected provider detail", /HTTP 403/],
])(
  "classifies forbidden responses without guessing from status alone: %s",
  async (name, message, expected) => {
    clearMail();
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("MAIL_FROM", "JamScript <invite@jamscript.dev>");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ name, message }), { status: 403 })),
    );
    const result = await deliverInvitation(invitation);
    expect(result).toMatchObject({ delivery: "link", url: invitation.url });
    expect(result.invitationError).toMatch(expected);
  },
);
