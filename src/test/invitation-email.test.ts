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
  invitationEmailText,
  sendInvitationEmail,
} from "@/features/collaboration/invitation-email.server";

const invitation = {
  to: "guest@example.com",
  workspaceName: "Coastline",
  role: "editor" as const,
  url: "https://jamscript.example/app/invitations/token",
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

it("keeps a manual invite link when SMTP is not configured", async () => {
  for (const name of ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "SMTP_FROM"])
    vi.stubEnv(name, "");
  expect(await sendInvitationEmail(invitation)).toBe(false);
  expect(mailer.createTransport).not.toHaveBeenCalled();
  expect(invitationEmailText(invitation)).toContain(invitation.url);
});

it("sends through authenticated TLS SMTP and closes the transport", async () => {
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

it("rejects partial configuration before trying to send", async () => {
  vi.stubEnv("SMTP_HOST", "smtp.example.com");
  for (const name of ["SMTP_PORT", "SMTP_USER", "SMTP_PASS", "SMTP_FROM"]) vi.stubEnv(name, "");
  await expect(sendInvitationEmail(invitation)).rejects.toThrow(/incomplete/);
});
