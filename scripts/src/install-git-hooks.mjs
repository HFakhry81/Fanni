/**
 * Copies tracked hook scripts into .git/hooks so every local commit
 * updates PROJECT_DEVELOPMENT_REVIEW.md without changing git config.
 */
import { copyFileSync, chmodSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const gitHooksDir = path.join(repoRoot, ".git", "hooks");
const srcDir = path.join(repoRoot, "scripts", "git-hooks");

if (!existsSync(path.join(repoRoot, ".git"))) {
  process.exit(0);
}
if (!existsSync(gitHooksDir)) {
  mkdirSync(gitHooksDir, { recursive: true });
}

for (const name of ["post-commit", "prepare-commit-msg"]) {
  const src = path.join(srcDir, name);
  const dest = path.join(gitHooksDir, name);
  if (!existsSync(src)) continue;
  copyFileSync(src, dest);
  try {
    chmodSync(dest, 0o755);
  } catch {
    /* Windows may ignore chmod */
  }
}
