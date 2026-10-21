export interface InvitationMessage {
  to: string;
  workspaceName: string;
  role: "editor" | "viewer";
  url: string;
}

/** Trim and drop wrapping quotes so `.env` values like `"re_…"` still resolve. */
function mailEnv(name: string) {
  const raw = process.env[name]?.trim();
  if (!raw) return undefined;
  if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'")))
    return raw.slice(1, -1).trim() || undefined;
  return raw;
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

/** Safe for an owner-facing response. Never return raw provider text or credentials. */
export function invitationEmailFailure(cause: unknown): string {
  const missing: string[] = [];
  if (!mailEnv("RESEND_API_KEY")) missing.push("RESEND_API_KEY");
  if (!(mailEnv("MAIL_FROM") || mailEnv("RESEND_FROM"))) missing.push("MAIL_FROM (or RESEND_FROM)");
  if (missing.length)
    return `Email delivery is not configured. Set ${missing.join(", ")} on the server.`;
  if (cause instanceof Error && cause.message.startsWith("Resend rejected")) return cause.message;
  if (cause instanceof Error && /fetch failed|network|ECONNREFUSED|ETIMEDOUT/i.test(cause.message))
    return "Could not reach Resend. Check network access and try again, or share the invitation link below.";
  return "Email delivery failed. Check RESEND_API_KEY and MAIL_FROM on the server.";
}

/**
 * Sends through Resend's HTTP API (Worker-safe). Returns false when mail is
 * entirely unconfigured so the caller can show a manual invite link.
 */
export async function sendInvitationEmail(input: InvitationMessage): Promise<boolean> {
  const apiKey = mailEnv("RESEND_API_KEY");
  const from = mailEnv("MAIL_FROM") || mailEnv("RESEND_FROM");
  if (!apiKey && !from) return false;
  if (!apiKey || !from) throw new Error("Email configuration is incomplete");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: `Invitation to ${input.workspaceName} on JamScript`,
      text: invitationEmailText(input),
    }),
  });
  if (response.ok) return true;
  const body = (await response.json().catch(() => null)) as {
    message?: unknown;
    name?: unknown;
  } | null;
  const detail = typeof body?.message === "string" ? body.message : `HTTP ${response.status}`;
  if (/only send testing emails|only.*your own email address/i.test(detail))
    throw new Error(
      "Resend rejected delivery from its testing sender. Verify a sending domain in Resend and set MAIL_FROM to an address on that domain. You can still share the invitation link.",
    );
  if (
    body?.name === "invalid_permission" ||
    (body?.name === "restricted_api_key" && /only send emails|permission|scope/i.test(detail))
  )
    throw new Error(
      "Resend rejected email sending permissions. Give RESEND_API_KEY Sending access for the MAIL_FROM domain.",
    );
  if (
    response.status === 401 ||
    body?.name === "suspended_api_key" ||
    /api key.*(?:invalid|not active|suspended)/i.test(detail)
  )
    throw new Error("Resend rejected the API key. Check RESEND_API_KEY on the server.");
  if (/from|domain|verified/i.test(detail))
    throw new Error(
      "Resend rejected the sender. Verify MAIL_FROM on a Resend domain and use an address on that verified domain.",
    );
  throw new Error(`Resend rejected the invitation email (HTTP ${response.status}).`);
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
