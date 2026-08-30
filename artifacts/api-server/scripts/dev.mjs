/**
 * Local API dev entry: set NODE_ENV then build + start.
 * Avoids broken cross-env bin links on Windows/pnpm.
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const cwd = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(cwd, "..");

process.env.NODE_ENV = "development";

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    env: process.env,
    stdio: "inherit",
    shell: true,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

run("pnpm", ["run", "build"]);
run("pnpm", ["run", "start"]);
