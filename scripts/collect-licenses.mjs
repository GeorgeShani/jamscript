import { createHash } from "node:crypto";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appRequire = createRequire(path.join(root, "package.json"));
const packages = new Map();
const texts = new Map();
const unresolved = new Set();

function sourceFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return entry.name === "test" ? [] : sourceFiles(fullPath);
    return /\.(ts|tsx)$/.test(entry.name) ? [fullPath] : [];
  });
}

function packageDirectory(name, requester) {
  // Some packages export neither their manifest nor a default entry point.
  for (const directory of requester.resolve.paths(name) ?? []) {
    const candidate = path.join(directory, name, "package.json");
    if (fs.existsSync(candidate)) return fs.realpathSync(path.dirname(candidate));
  }
  try {
    let directory = path.dirname(requester.resolve(name));
    while (directory !== path.dirname(directory)) {
      const candidate = path.join(directory, "package.json");
      if (fs.existsSync(candidate)) {
        const manifest = JSON.parse(fs.readFileSync(candidate, "utf8"));
        if (manifest.name === name) return directory;
      }
      directory = path.dirname(directory);
    }
  } catch {
    // The report records missing packages rather than inventing licence text.
  }
  return null;
}

function visit(name, requester) {
  const directory = packageDirectory(name, requester);
  if (!directory) {
    unresolved.add(name);
    return;
  }
  const manifest = JSON.parse(fs.readFileSync(path.join(directory, "package.json"), "utf8"));
  const key = `${manifest.name}@${manifest.version}`;
  if (packages.has(key)) return;
  const noticeFiles = fs.readdirSync(directory).filter((file) => {
    return (
      /^(licen[cs]e|copying|notice)(\.|$)/i.test(file) &&
      fs.statSync(path.join(directory, file)).isFile()
    );
  });
  const ids = [];
  for (const file of noticeFiles) {
    const content = fs.readFileSync(path.join(directory, file), "utf8");
    const id = createHash("sha256").update(content).digest("hex").slice(0, 12);
    ids.push(id);
    if (!texts.has(id)) texts.set(id, { content, packages: [] });
    texts.get(id).packages.push(`${key} (${file})`);
  }
  packages.set(key, {
    license:
      typeof manifest.license === "string"
        ? manifest.license
        : JSON.stringify(manifest.license ?? manifest.licenses ?? "See upstream"),
    source:
      typeof manifest.repository === "string"
        ? manifest.repository
        : (manifest.repository?.url ?? manifest.homepage ?? ""),
    texts: ids,
  });
  const nestedRequire = createRequire(path.join(directory, "package.json"));
  for (const dependency of Object.keys(manifest.dependencies ?? {}))
    visit(dependency, nestedRequire);
}

const runtimeRoots = new Set(["react-dom"]);
for (const file of sourceFiles(path.join(root, "src"))) {
  const { importedFiles } = ts.preProcessFile(fs.readFileSync(file, "utf8"), true, true);
  for (const { fileName } of importedFiles) {
    if (
      fileName.startsWith(".") ||
      fileName.startsWith("@/") ||
      fileName.startsWith("node:") ||
      fileName.startsWith("cloudflare:")
    )
      continue;
    runtimeRoots.add(
      fileName.startsWith("@") ? fileName.split("/").slice(0, 2).join("/") : fileName.split("/")[0],
    );
  }
}
for (const name of [...runtimeRoots].sort()) visit(name, appRequire);

if (unresolved.size) {
  throw new Error(`Cannot resolve declared dependencies: ${[...unresolved].sort().join(", ")}`);
}

const strudelDirectory = packageDirectory("@strudel/web", appRequire);
const strudel = JSON.parse(fs.readFileSync(path.join(strudelDirectory, "package.json"), "utf8"));
const licenseUrl = `https://cdn.jsdelivr.net/npm/@strudel/web@${strudel.version}/LICENSE`;
const response = await fetch(licenseUrl, { signal: AbortSignal.timeout(20_000) });
if (!response.ok) throw new Error(`Strudel licence download failed: ${response.status}`);
const agpl = await response.text();
const normalize = (value) => value.replace(/\r\n/g, "\n").trim();
const installed = fs.readFileSync(path.join(strudelDirectory, "LICENSE"), "utf8");
const audiocnLicense = fs.readFileSync(
  path.join(root, "public", "licenses", "audiocn-MIT.txt"),
  "utf8",
);
const shadcnLicense = fs.readFileSync(
  path.join(root, "public", "licenses", "shadcn-ui-MIT.txt"),
  "utf8",
);
if (!shadcnLicense.includes("Copyright (c) 2023 shadcn") || !shadcnLicense.includes("MIT License"))
  throw new Error("shadcn/ui licence text is missing or incomplete");
if (
  !audiocnLicense.includes("Copyright (c) 2026 OrcDev") ||
  !audiocnLicense.includes("MIT License")
) {
  throw new Error("audiocn licence text is missing or incomplete");
}
if (
  !agpl.includes("GNU AFFERO GENERAL PUBLIC LICENSE") ||
  !agpl.includes("END OF TERMS AND CONDITIONS") ||
  normalize(agpl) !== normalize(installed)
) {
  throw new Error("Fetched Strudel licence is incomplete or differs from the installed version");
}

const sections = [
  "JamScript third-party notices",
  `Collected ${new Date().toISOString().slice(0, 10)} from source imports and their declared dependency graph.`,
  "The project licence is AGPL-3.0-or-later; the full text is in LICENSE.",
  `Root LICENSE source: ${licenseUrl}, matched against the installed package.`,
  "Strudel: https://strudel.cc/ | source: https://codeberg.org/uzu/strudel",
  "Strudel dependency source files retain their original contributor copyright and licence headers.",
  "Copied/adapted audiocn Knob, Parameter Slider, Pan Control, Fader, Channel Toggle, Channel Strip, Mixer, Level Meter, Spectrum, Bar Visualizer, Smooth Waveform, Sound Pad, Waveform and supporting utilities: https://github.com/audiocn/ui | MIT; full text: public/licenses/audiocn-MIT.txt.",
  "Copied/adapted shadcn/ui Message Scroller, Message, Bubble, and Input Group components: https://github.com/shadcn-ui/ui | MIT; full text: public/licenses/shadcn-ui-MIT.txt.",
  "Available top-level dependency licence/notice texts are reproduced below; trailing spaces are normalized.",
  "A package without a top-level text is listed as such; that is not a claim that it has no licence.",
  "Font notice: public/brand/Schibsted-Grotesk-OFL.txt (the wordmark is outlined).",
  "External sample recordings and soundfonts are not vendored by this cleanup; their asset licences are separate.",
  "",
  "Runtime dependency inventory",
];
sections.push("", "Copied component licence: audiocn", "-".repeat(72), audiocnLicense);
sections.push("", "Copied component licence: shadcn/ui", "-".repeat(72), shadcnLicense);
for (const [key, record] of [...packages].sort(([a], [b]) => a.localeCompare(b))) {
  sections.push(
    `${key} | ${record.license} | ${record.source} | ${record.texts.length ? `texts ${record.texts.join(", ")}` : "no top-level licence text in installed package; see source"}`,
  );
}
for (const [id, record] of texts) {
  sections.push(
    `\n${"=".repeat(72)}`,
    `Licence/notice ${id}`,
    record.packages.join("\n"),
    "-".repeat(72),
    record.content.replace(/[ \t]+$/gm, ""),
  );
}

// Write only after resolving the graph and verifying the upstream licence.
fs.writeFileSync(path.join(root, "LICENSE"), agpl);
fs.writeFileSync(path.join(root, "THIRD_PARTY_NOTICES.txt"), `${sections.join("\n")}\n`);
const publicLicenses = path.join(root, "public", "licenses");
fs.mkdirSync(publicLicenses, { recursive: true });
fs.writeFileSync(path.join(publicLicenses, "AGPL-3.0.txt"), agpl);
fs.writeFileSync(path.join(publicLicenses, "THIRD_PARTY_NOTICES.txt"), `${sections.join("\n")}\n`);
console.log(
  `Matched Strudel ${strudel.version} licence; ${packages.size} packages, ${texts.size} notice texts.`,
);
