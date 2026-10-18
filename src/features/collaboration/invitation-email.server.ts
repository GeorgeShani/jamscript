import nodemailer from "nodemailer";

export interface InvitationMessage {
  to: string;
  workspaceName: string;
  role: "editor" | "viewer";
  url: string;
}

export function invitationEmailText(input: InvitationMessage) {
  return [
    `You have been invited to ${input.workspaceName} on JamScript as ${input.role === "editor" ? "an editor" : "a viewer"}.`,
    "",
    "Open this link and sign in with the invited email address:",
    input.url,
    "",
    "This invitation expires in 7 days. If you did not expect it, you can ignore this email.",
  ].join("\n");
}

/** Returns false when SMTP is entirely unconfigured so the caller can show a manual link. */
export async function sendInvitationEmail(input: InvitationMessage): Promise<boolean> {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;
  if (![SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM].some(Boolean)) return false;
  if (![SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM].every(Boolean))
    throw new Error("SMTP configuration is incomplete");
  const port = Number(SMTP_PORT);
  if (port !== 465 && port !== 587)
    throw new Error("SMTP_PORT must be 465 or 587 for this Cloudflare deployment");
  const transport = nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure: port === 465,
    requireTLS: port === 587,
    auth: { user: SMTP_USER!, pass: SMTP_PASS! },
    connectionTimeout: 15_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
    disableFileAccess: true,
    disableUrlAccess: true,
  });
  try {
    const result = await transport.sendMail({
      from: SMTP_FROM,
      to: input.to,
      subject: `Invitation to ${input.workspaceName} on JamScript`,
      text: invitationEmailText(input),
    });
    if (!result.accepted.includes(input.to))
      throw new Error("SMTP did not accept the invitation recipient");
    return true;
  } finally {
    transport.close();
  }
}
