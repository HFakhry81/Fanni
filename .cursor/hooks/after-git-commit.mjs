#!/usr/bin/env node
/**
 * Cursor afterShellExecution: if the agent just ran git commit, append HEAD to the review dictionary.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);
let payload = {};
try {
  payload = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
} catch {
  payload = {};
}

const command = String(payload.command ?? payload.commandLine ?? "");
const looksLikeCommit = /\bgit\b[\s\S]*\bcommit\b/.test(command);

if (looksLikeCommit) {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  spawnSync(process.execPath, [path.join(repoRoot, "scripts/src/log-commit-to-review.mjs"), "--head"], {
    cwd: repoRoot,
    stdio: "ignore",
  });
}

process.stdout.write("{}\n");
