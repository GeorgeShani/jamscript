import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { desktopVersionPlan, nextDesktopVersion } from "../../scripts/desktop-version";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function fixture(cargoVersion = "0.3.0") {
  const root = mkdtempSync(join(tmpdir(), "jamscript-version-"));
  roots.push(root);
  mkdirSync(join(root, "src-tauri"));
  writeFileSync(join(root, "src-tauri/tauri.conf.json"), '{"version":"0.3.0"}\n');
  writeFileSync(
    join(root, "src-tauri/Cargo.toml"),
    `[package]\nname = "jamscript"\nversion = "${cargoVersion}"\n\n[dependencies]\nother = "0.3.0"\n`,
  );
  writeFileSync(
    join(root, "src-tauri/Cargo.lock"),
    'version = 4\n\n[[package]]\nname = "jamscript"\nversion = "0.3.0"\n\n[[package]]\nname = "other"\nversion = "0.3.0"\n',
  );
  return root;
}

it("increments stable versions and resets lower components", () => {
  expect(nextDesktopVersion("0.3.0", "patch")).toBe("0.3.1");
  expect(nextDesktopVersion("0.3.9", "minor")).toBe("0.4.0");
  expect(nextDesktopVersion("0.3.9", "major")).toBe("1.0.0");
  expect(nextDesktopVersion("0.3.0", "0.5.2")).toBe("0.5.2");
});

it.each(["0.3.0", "0.2.9", "v0.4.0", "01.4.0", "0.4.0-beta.1", "--check", "9007199254740992.0.0"])(
  "rejects unsafe target %s",
  (target) => {
    expect(() => nextDesktopVersion("0.3.0", target)).toThrow();
  },
);

it("plans all three version changes without changing unrelated dependencies or writing files", () => {
  const root = fixture();
  const plan = desktopVersionPlan(root, "patch");
  expect(plan.next).toBe("0.3.1");
  expect(plan.changes).toHaveLength(3);
  expect(plan.changes[1]!.source).toContain('other = "0.3.0"');
  expect(plan.changes[2]!.source).toContain('name = "other"\nversion = "0.3.0"');
  for (const change of plan.changes)
    expect(readFileSync(change.path, "utf8")).not.toBe(change.source);
  for (const change of plan.changes) writeFileSync(change.path, change.source);
  expect(desktopVersionPlan(root).current).toBe("0.3.1");
});

it("rejects mismatched files before writing", () => {
  const root = fixture("0.2.0");
  expect(() => desktopVersionPlan(root, "patch")).toThrow(/versions disagree/);
  expect(readFileSync(join(root, "src-tauri/tauri.conf.json"), "utf8")).toContain("0.3.0");
});
