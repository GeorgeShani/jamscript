import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { invitationEmailHtml } from "../src/features/collaboration/invitation-email.server";

const directory = new URL("../dist/email-preview/", import.meta.url);
mkdirSync(directory, { recursive: true });
const output = new URL("workspace-invitation.html", directory);
writeFileSync(
  output,
  invitationEmailHtml({
    to: "you@example.com",
    workspaceName: "Night bus",
    role: "editor",
    url: "https://jamscript.dev/app/invitations/preview",
  }),
);
console.log(`Email preview: ${fileURLToPath(output)}`);
