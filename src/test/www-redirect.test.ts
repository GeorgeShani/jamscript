// @vitest-environment node
import { expect, it } from "vitest";
import redirect from "../../workers/www-redirect";

it.each([
  ["https://www.jamscript.dev/", "https://jamscript.dev/"],
  ["http://www.jamscript.dev/app/library", "https://jamscript.dev/app/library"],
  [
    "https://www.jamscript.dev/desktop/connect?user_code=ABCD-EFGH&mode=sign-in",
    "https://jamscript.dev/desktop/connect?user_code=ABCD-EFGH&mode=sign-in",
  ],
  ["https://www.jamscript.dev/brand/logo.svg", "https://jamscript.dev/brand/logo.svg"],
])("permanently redirects %s while preserving the destination", (source, destination) => {
  const response = redirect.fetch(new Request(source));
  expect(response.status).toBe(308);
  expect(response.headers.get("location")).toBe(destination);
});
