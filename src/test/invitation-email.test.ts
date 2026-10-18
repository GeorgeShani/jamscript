// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";

const mailer = vi.hoisted(() => ({
  sendMail: vi.fn(),
  close: vi.fn(),
  createTransport: vi.fn(),
}));
vi.mock("nodemailer", () => ({
  default: { createTransport: mailer.createTransport },
}));

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

const smtpNames = [
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_USER",
  "SMTP_PASSWORD",
  "SMTP_PASS",
  "MAIL_FROM",
  "SMTP_FROM",
];

function clearSmtp() {
  for (const name of smtpNames) vi.stubEnv(name, "");
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

it("keeps a manual invite link when SMTP is not configured", async () => {
  clearSmtp();
  expect(await sendInvitationEmail(invitation)).toBe(false);
  expect(mailer.createTransport).not.toHaveBeenCalled();
  expect(invitationEmailText(invitation)).toContain(invitation.url);
});

it("sends through authenticated TLS SMTP and closes the transport", async () => {
  clearSmtp();
  vi.stubEnv("SMTP_HOST", "smtp.example.com");
  vi.stubEnv("SMTP_PORT", "587");
  vi.stubEnv("SMTP_USER", "user");
  vi.stubEnv("SMTP_PASS", "test-password");
  vi.stubEnv("SMTP_FROM", "JamScript <invite@example.com>");
  mailer.createTransport.mockReturnValue({ sendMail: mailer.sendMail, close: mailer.close });
  mailer.sendMail.mockResolvedValue({ accepted: [invitation.to] });
  expect(await sendInvitationEmail(invitation)).toBe(true);
  expect(mailer.createTransport).toHaveBeenCalledWith(
    expect.objectContaining({ host: "smtp.example.com", port: 587, requireTLS: true }),
  );
  expect(mailer.sendMail).toHaveBeenCalledWith(
    expect.objectContaining({ to: invitation.to, text: expect.stringContaining(invitation.url) }),
  );
  expect(mailer.close).toHaveBeenCalled();
});

it("accepts SMTP_PASSWORD and MAIL_FROM for the deployed configuration", async () => {
  clearSmtp();
  vi.stubEnv("SMTP_HOST", "smtp.example.com");
  vi.stubEnv("SMTP_PORT", "465");
  vi.stubEnv("SMTP_USER", "user");
  vi.stubEnv("SMTP_PASSWORD", "configured-password");
  vi.stubEnv("MAIL_FROM", "JamScript <invite@example.com>");
  mailer.createTransport.mockReturnValue({ sendMail: mailer.sendMail, close: mailer.close });
  mailer.sendMail.mockResolvedValue({ accepted: [invitation.to] });
  expect(await sendInvitationEmail(invitation)).toBe(true);
  expect(mailer.createTransport).toHaveBeenCalledWith(
    expect.objectContaining({
      port: 465,
      secure: true,
      auth: { user: "user", pass: "configured-password" },
    }),
  );
  expect(mailer.sendMail).toHaveBeenCalledWith(
    expect.objectContaining({ from: "JamScript <invite@example.com>" }),
  );
});

it("rejects partial configuration before trying to send", async () => {
  clearSmtp();
  vi.stubEnv("SMTP_HOST", "smtp.example.com");
  await expect(sendInvitationEmail(invitation)).rejects.toThrow(/incomplete/);
  expect(await deliverInvitation(invitation)).toEqual({
    delivery: "link",
    url: invitation.url,
    invitationError: expect.stringContaining(
      "SMTP_PORT, SMTP_USER, SMTP_PASSWORD (or SMTP_PASS), MAIL_FROM (or SMTP_FROM)",
    ),
  });
});

it("keeps a usable link and reports a safe reason after SMTP authentication fails", async () => {
  clearSmtp();
  vi.stubEnv("SMTP_HOST", "smtp.example.com");
  vi.stubEnv("SMTP_PORT", "587");
  vi.stubEnv("SMTP_USER", "user");
  vi.stubEnv("SMTP_PASS", "test-password");
  vi.stubEnv("SMTP_FROM", "invite@example.com");
  mailer.createTransport.mockReturnValue({ sendMail: mailer.sendMail, close: mailer.close });
  mailer.sendMail.mockRejectedValue({ code: "EAUTH", response: "do not expose raw server text" });
  const result = await deliverInvitation(invitation);
  expect(result).toEqual({
    delivery: "link",
    url: invitation.url,
    invitationError:
      "SMTP authentication failed. Check SMTP_USER and SMTP_PASSWORD (or SMTP_PASS).",
  });
  expect(JSON.stringify(result)).not.toContain("do not expose raw server text");
  expect(mailer.close).toHaveBeenCalled();
});
