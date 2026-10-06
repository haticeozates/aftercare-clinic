import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function runMigrationIntegrity(args: string[] = []) {
  return execFileSync("node", ["scripts/verify-migration-integrity.mjs", ...args], {
    cwd: root,
    encoding: "utf8"
  });
}

function expectMigrationFailure(args: string[]) {
  expect(() => runMigrationIntegrity(args)).toThrow();
}

describe("phase 9a stage3 release gates", () => {
  it("passes for the current frozen migration manifest", () => {
    const output = runMigrationIntegrity([]);
    expect(output).toMatch(/migration integrity pass/i);
  });

  it("passes for fixture manifests with unchanged frozen files", () => {
    const output = runMigrationIntegrity([
      "--manifest",
      "tests/fixtures/migration-integrity/manifest.json",
      "--migrations-dir",
      "tests/fixtures/migration-integrity/valid"
    ]);
    expect(output).toMatch(/migration integrity pass/i);
  });

  it("fails when frozen migration content changes", () => {
    expectMigrationFailure([
      "--manifest",
      "tests/fixtures/migration-integrity/manifest.json",
      "--migrations-dir",
      "tests/fixtures/migration-integrity/mutated"
    ]);
  });

  it("fails when a frozen migration is deleted", () => {
    expectMigrationFailure([
      "--manifest",
      "tests/fixtures/migration-integrity/manifest.json",
      "--migrations-dir",
      "tests/fixtures/migration-integrity/deleted"
    ]);
  });

  it("fails when a frozen migration is renamed", () => {
    expectMigrationFailure([
      "--manifest",
      "tests/fixtures/migration-integrity/manifest.json",
      "--migrations-dir",
      "tests/fixtures/migration-integrity/rename"
    ]);
  });

  it("allows new forward migrations after the frozen set", () => {
    const output = runMigrationIntegrity([
      "--manifest",
      "tests/fixtures/migration-integrity/forward-manifest.json",
      "--migrations-dir",
      "tests/fixtures/migration-integrity/forward"
    ]);
    expect(output).toMatch(/migration integrity pass/i);
  });

  it("fails for duplicate manifest entries", () => {
    expectMigrationFailure([
      "--manifest",
      "tests/fixtures/migration-integrity/duplicate-manifest.json",
      "--migrations-dir",
      "tests/fixtures/migration-integrity/valid"
    ]);
  });

  it("fails for unsafe manifest paths", () => {
    expectMigrationFailure([
      "--manifest",
      "tests/fixtures/migration-integrity/unsafe-manifest.json",
      "--migrations-dir",
      "tests/fixtures/migration-integrity/valid"
    ]);
  });

  it("passes repository hygiene on the current tree", () => {
    const output = execFileSync("node", ["scripts/verify-repository-hygiene.mjs"], {
      cwd: root,
      encoding: "utf8"
    });
    expect(output).toMatch(/repository hygiene pass/i);
  });

  it("does not print secret-like values from hygiene failures", () => {
    const output = execFileSync("node", ["scripts/verify-repository-hygiene.mjs"], {
      cwd: root,
      encoding: "utf8"
    });
    expect(output).not.toMatch(/sk_live_|BEGIN PRIVATE KEY/);
  });

  it("validates canonical next-env.d.ts", () => {
    const output = execFileSync("node", ["scripts/verify-next-env-dts.mjs"], {
      cwd: root,
      encoding: "utf8"
    });
    expect(output).toMatch(/next-env\.d\.ts pass/i);
  });

  it("documents the predeploy gate steps without echoing secrets", () => {
    const script = readFileSync(join(root, "scripts/verify-predeploy.mjs"), "utf8");
    expect(script).toMatch(/verify-repository-hygiene/);
    expect(script).toMatch(/verify-migration-integrity/);
    expect(script).toMatch(/verify-tracked-worktree/);
    expect(script).not.toMatch(/console\.log\([^)]*SECRET/);
  });

  it("keeps stage 2 security header behavior in middleware", () => {
    const middleware = readFileSync(join(root, "middleware.ts"), "utf8");
    expect(middleware).toContain("getBaselineSecurityHeaders");
    expect(middleware).toContain("_next/static");
    expect(middleware.indexOf("withPathSpecificSecurityHeaders")).toBeGreaterThan(
      middleware.indexOf("getBaselineSecurityHeaders")
    );
    expect(middleware).toContain("withPathSpecificSecurityHeaders({}, request.nextUrl.pathname)");
  });

  it("documents production-only high audit policy without claiming a clean full tree", () => {
    const security = readFileSync(join(root, "SECURITY.md"), "utf8");
    expect(security).toMatch(/npm audit --omit=dev --audit-level=high/);
    expect(security).toMatch(/eslint-config-next/);
    expect(security).toMatch(/micromatch/);
    expect(security).toMatch(/braces/);
    expect(security).toMatch(/npm audit fix --force/);
    expect(security).toMatch(/development-only ESLint toolchain/);
  });

  it("disables Next.js agentRules instead of gitignoring AGENTS.md", () => {
    const gitignore = readFileSync(join(root, ".gitignore"), "utf8").split(/\r?\n/);
    const nextConfig = readFileSync(join(root, "next.config.ts"), "utf8");
    expect(nextConfig).toMatch(/agentRules:\s*false/);
    expect(gitignore).not.toContain("AGENTS.md");
  });
});
