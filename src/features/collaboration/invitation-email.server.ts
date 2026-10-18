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

/** Safe for an owner-facing response. Never return raw SMTP server text or credentials. */
export function invitationEmailFailure(cause: unknown): string {
  const missing = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER"].filter((name) => !process.env[name]);
  if (!(process.env["SMTP_PASSWORD"] || process.env["SMTP_PASS"]))
    missing.push("SMTP_PASSWORD (or SMTP_PASS)");
  if (!(process.env["MAIL_FROM"] || process.env["SMTP_FROM"]))
    missing.push("MAIL_FROM (or SMTP_FROM)");
  if (missing.length)
    return `Email delivery is not configured. Set ${missing.join(", ")} on the server.`;
  if (cause instanceof Error && cause.message.startsWith("SMTP_PORT must be"))
    return "SMTP_PORT must be 465 or 587.";
  const smtp = cause as { code?: unknown; responseCode?: unknown } | null;
  if (smtp?.code === "EAUTH" || smtp?.responseCode === 535)
    return "SMTP authentication failed. Check SMTP_USER and SMTP_PASSWORD (or SMTP_PASS).";
  if (["ETIMEDOUT", "ECONNECTION", "ECONNREFUSED", "ESOCKET"].includes(String(smtp?.code)))
    return "Could not connect to the SMTP server. Check SMTP_HOST, SMTP_PORT and network access.";
  if (smtp?.code === "EENVELOPE" || smtp?.responseCode === 550 || smtp?.responseCode === 553)
    return "The SMTP server rejected the sender or recipient. Check MAIL_FROM (or SMTP_FROM) and sender verification.";
  return "SMTP delivery failed. Check the server email settings.";
}

/** Returns false when SMTP is entirely unconfigured so the caller can show a manual link. */
export async function sendInvitationEmail(input: InvitationMessage): Promise<boolean> {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER } = process.env;
  const password = process.env["SMTP_PASSWORD"] || process.env["SMTP_PASS"];
  const from = process.env["MAIL_FROM"] || process.env["SMTP_FROM"];
  if (![SMTP_HOST, SMTP_PORT, SMTP_USER, password, from].some(Boolean)) return false;
  if (![SMTP_HOST, SMTP_PORT, SMTP_USER, password, from].every(Boolean))
    throw new Error("SMTP configuration is incomplete");
  const port = Number(SMTP_PORT);
  if (port !== 465 && port !== 587)
    throw new Error("SMTP_PORT must be 465 or 587 for this Cloudflare deployment");
  const transport = nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure: port === 465,
    requireTLS: port === 587,
    auth: { user: SMTP_USER!, pass: password! },
    connectionTimeout: 15_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
    disableFileAccess: true,
    disableUrlAccess: true,
  });
  try {
    const result = await transport.sendMail({
      from,
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

/** Preserve the invite when mail is unavailable; only the authenticated owner sees its link. */
export async function deliverInvitation(input: InvitationMessage) {
  try {
    const sent = await sendInvitationEmail(input);
    return sent ? { delivery: "email" as const } : { delivery: "link" as const, url: input.url };
  } catch (cause) {
    return {
      delivery: "link" as const,
      url: input.url,
      invitationError: invitationEmailFailure(cause),
    };
  }
}
