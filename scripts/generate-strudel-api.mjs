import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const packageRoot = fileURLToPath(new URL("../node_modules/@strudel/web/", import.meta.url));
const pkg = JSON.parse(readFileSync(`${packageRoot}package.json`, "utf8"));
const bundle = readFileSync(`${packageRoot}dist/index.mjs`, "utf8");
const exports = bundle.slice(bundle.lastIndexOf("\nexport {"));
const names = [...exports.matchAll(/\b(?:as\s+)?([A-Za-z_$][\w$]*)\s*,?\s*(?=\n)/g)]
  .map((match) => match[1])
  .filter((name) => /^[a-z][a-zA-Z0-9]*$/.test(name));
const output = {
  package: "@strudel/web",
  version: pkg.version,
  names: [...new Set([...names, "setcps", "setcpm", "setbpm", "hush"])].sort(),
};
writeFileSync(
  fileURLToPath(new URL("../src/features/language/strudel-api.generated.json", import.meta.url)),
  `${JSON.stringify(output, null, 2)}\n`,
);
