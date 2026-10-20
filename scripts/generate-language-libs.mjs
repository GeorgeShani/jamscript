import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const root = dirname(require.resolve("typescript"));
const files = {};
function include(name) {
  if (files[name]) return;
  const source = readFileSync(join(root, name), "utf8");
  files[name] = source;
  for (const match of source.matchAll(/<reference lib="([^"]+)"/g)) include(`lib.${match[1]}.d.ts`);
}
include("lib.es2022.d.ts");
include("lib.dom.d.ts");
writeFileSync(
  new URL("../src/features/language/typescript-libs.generated.json", import.meta.url),
  `${JSON.stringify(files)}\n`,
);
console.log(`Bundled ${Object.keys(files).length} offline TypeScript standard libraries`);
