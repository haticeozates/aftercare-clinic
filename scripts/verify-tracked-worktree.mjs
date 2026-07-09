#!/usr/bin/env node

import { execFileSync } from "node:child_process";

function listLines(command, args) {
  const output = execFileSync(command, args, { encoding: "utf8" }).trim();
  return output ? output.split("\n") : [];
}

function main() {
  const changed = listLines("git", ["diff", "--name-only"]);
  const untracked = listLines("git", ["ls-files", "--others", "--exclude-standard"]);
  const problems = [...changed, ...untracked].sort();

  if (problems.length > 0) {
    console.error("tracked worktree integrity failed:");
    for (const path of problems) {
      console.error(`- ${path}`);
    }
    process.exit(1);
  }

  console.log("tracked worktree integrity pass");
}

main();
