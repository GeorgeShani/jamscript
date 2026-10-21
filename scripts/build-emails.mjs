import { readFileSync, writeFileSync } from "node:fs";
import mjml2html from "mjml";

const source = new URL("../emails/workspace-invitation.mjml", import.meta.url);
const { html } = await mjml2html(readFileSync(source, "utf8"), {
  validationLevel: "strict",
  minify: true,
  fonts: {},
  ignoreIncludes: true,
});

for (const name of ["workspaceName", "roleLabel", "invitedEmail", "invitationUrl"]) {
  if (!html.includes(`{{${name}}}`)) throw new Error(`Missing email placeholder: ${name}`);
}

writeFileSync(
  new URL("../src/features/collaboration/invitation-email.generated.json", import.meta.url),
  `${JSON.stringify(html)}\n`,
);
console.log(`Compiled invitation MJML: ${Buffer.byteLength(html)} bytes`);
