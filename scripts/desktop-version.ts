import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const versionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

export function nextDesktopVersion(current: string, bump: string): string {
  if (!versionPattern.test(current)) throw new Error(`Invalid desktop version: ${current}`);
  const parts = current.split(".").map(Number);
  const index = ["major", "minor", "patch"].indexOf(bump);
  let next = bump;
  if (index !== -1) {
    next = parts
      .map((part, position) => (position < index ? part : position === index ? part + 1 : 0))
      .join(".");
  }
  if (!versionPattern.test(next))
    throw new Error("Use patch, minor, major, or a stable version such as 0.3.1");
  const values = next.split(".").map(Number);
  if ([...parts, ...values].some((part) => !Number.isSafeInteger(part)))
    throw new Error("Version component is too large");
  const different = values.findIndex((part, position) => part !== parts[position]);
  if (different === -1 || values[different]! < parts[different]!)
    throw new Error("The next version must be greater than the current version");
  return next;
}

export function desktopVersionPlan(root: string, bump?: string) {
  const configPath = resolve(root, "src-tauri/tauri.conf.json");
  const configSource = readFileSync(configPath, "utf8");
  const current: unknown = JSON.parse(configSource).version;
  if (typeof current !== "string" || !versionPattern.test(current))
    throw new Error("Tauri must declare a stable desktop version");
  const files = [
    { path: configPath, source: configSource, pattern: /("version"\s*:\s*")([^"]+)(")/g },
    {
      path: resolve(root, "src-tauri/Cargo.toml"),
      pattern: /(\[package\][\s\S]*?^version\s*=\s*")([^"]+)(")/gm,
    },
    {
      path: resolve(root, "src-tauri/Cargo.lock"),
      pattern: /(\[\[package\]\]\r?\nname = "jamscript"\r?\nversion = ")([^"]+)(")/g,
    },
  ];
  const next = bump === undefined ? current : nextDesktopVersion(current, bump);
  // Read and validate every file before writing any of them.
  const changes = files.map((file) => {
    const source = "source" in file ? file.source! : readFileSync(file.path, "utf8");
    const matches = [...source.matchAll(file.pattern)];
    if (matches.length !== 1 || matches[0]![2] !== current)
      throw new Error(`Desktop versions disagree in ${file.path}; expected ${current}`);
    return {
      path: file.path,
      source: source.replace(
        file.pattern,
        (_, before, _version, after) => `${before}${next}${after}`,
      ),
    };
  });
  return { current, next, changes };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    if (args[0] === "--check" && args.length === 1) {
      console.log(`Desktop versions agree: ${desktopVersionPlan(process.cwd()).current}`);
    } else {
      if (args.length < 1 || args.length > 2 || (args[1] && args[1] !== "--dry-run"))
        throw new Error(
          "Usage: bun run desktop:version <patch|minor|major|version> [--dry-run], or --check",
        );
      const plan = desktopVersionPlan(process.cwd(), args[0]);
      if (args[1] !== "--dry-run")
        for (const change of plan.changes) writeFileSync(change.path, change.source);
      console.log(
        `${args[1] === "--dry-run" ? "Would bump" : "Bumped"} desktop ${plan.current} → ${plan.next}`,
      );
    }
  } catch (cause) {
    console.error(cause instanceof Error ? cause.message : String(cause));
    process.exitCode = 1;
  }
}
