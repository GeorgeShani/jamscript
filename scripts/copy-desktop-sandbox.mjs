import { copyFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

if (process.argv.includes("--dev")) {
  copyFileSync(
    fileURLToPath(new URL("../dist/desktop-sandbox/sandbox.generated.js", import.meta.url)),
    fileURLToPath(new URL("../desktop/sandbox.generated.js", import.meta.url)),
  );
  process.exit(0);
}

for (const name of ["sandbox.html", "sandbox.generated.js"]) {
  copyFileSync(
    fileURLToPath(
      new URL(
        `../${name === "sandbox.html" ? "desktop" : "dist/desktop-sandbox"}/${name}`,
        import.meta.url,
      ),
    ),
    fileURLToPath(new URL(`../dist/desktop/${name}`, import.meta.url)),
  );
}
