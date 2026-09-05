/**
 * E2E quality loop: run → summarize → exit non-zero on failures.
 *
 * Usage (from repo root):
 *   node e2e/quality-loop.mjs
 *   node e2e/quality-loop.mjs --suite smoke
 *   node e2e/quality-loop.mjs --suite ui-safe   (no prod writes)
 *   node e2e/quality-loop.mjs --suite full
 *
 * Env:
 *   E2E_USE_LOCAL=1                 prefer local API/app
 *   E2E_ALLOW_PROD_WRITES=0|1
 *   PLAYWRIGHT_BROWSERS_PATH=...
 *   QUALITY_LOOP_MAX=1              (agent re-invokes after fixes)
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const e2eDir = __dirname;
const browsers = path.join(e2eDir, ".playwright-browsers");
const outDir = path.join(e2eDir, "quality-loop-out");
const resultsJson = path.join(outDir, "results.json");
const summaryMd = path.join(outDir, "SUMMARY.md");

const args = process.argv.slice(2);
const suiteArg = (() => {
  const i = args.indexOf("--suite");
  return i >= 0 ? args[i + 1] : "ui-safe";
})();

fs.mkdirSync(outDir, { recursive: true });

const env = {
  ...process.env,
  PLAYWRIGHT_BROWSERS_PATH: process.env.PLAYWRIGHT_BROWSERS_PATH || browsers,
  E2E_RECORD: process.env.E2E_RECORD || "1",
  E2E_ALLOW_PROD_WRITES: process.env.E2E_ALLOW_PROD_WRITES || "0",
  NODE_OPTIONS: process.env.NODE_OPTIONS?.includes("use-system-ca")
    ? process.env.NODE_OPTIONS
    : `${process.env.NODE_OPTIONS || ""} --use-system-ca`.trim(),
};

if (!env.E2E_USE_LOCAL) {
  // Prefer local when LAN URLs are configured; agent/scripts can override.
  env.E2E_USE_LOCAL = process.env.E2E_LOCAL_API_URL ? "1" : "0";
}

/** @type {string[]} */
let playwrightArgs = ["exec", "playwright", "test"];

switch (suiteArg) {
  case "smoke":
    playwrightArgs.push("--project=local-chrome", "tests/smoke.spec.ts");
    break;
  case "logic":
    playwrightArgs.push("--project=logic-suite");
    break;
  case "full":
    playwrightArgs.push("--project=full-recorded");
    break;
  case "ui-safe":
  default:
    // Recorded UI + hubs + register; wallet/order matrix still skipped on prod without writes
    playwrightArgs.push(
      "--project=full-recorded",
      "tests/full-app/00-public-surfaces.spec.ts",
      "tests/full-app/10-role-hubs.spec.ts",
      "tests/full-app/30-bonus-register.spec.ts",
    );
    break;
}

env.E2E_QUALITY_LOOP = "1";
// Ensure output dir exists before Playwright json reporter writes
fs.mkdirSync(path.join(e2eDir, "quality-loop-out"), { recursive: true });
if (fs.existsSync(resultsJson)) fs.unlinkSync(resultsJson);

console.log(`[quality-loop] suite=${suiteArg}`);
console.log(`[quality-loop] E2E_USE_LOCAL=${env.E2E_USE_LOCAL} ALLOW_PROD_WRITES=${env.E2E_ALLOW_PROD_WRITES}`);
console.log(`[quality-loop] browsers=${env.PLAYWRIGHT_BROWSERS_PATH}`);

const shellBin = process.platform === "win32" ? true : false;
const run = spawnSync("pnpm", playwrightArgs, {
  cwd: e2eDir,
  env,
  encoding: "utf8",
  shell: shellBin,
  stdio: ["inherit", "pipe", "pipe"],
  maxBuffer: 20 * 1024 * 1024,
});

const stdout = run.stdout || "";
const stderr = run.stderr || "";
process.stdout.write(stdout);
process.stderr.write(stderr);

fs.writeFileSync(path.join(outDir, "last-run.log"), `${stdout}\n${stderr}`);

/** @type {{ passed: number, failed: number, skipped: number, flaky: number, failures: Array<{ title: string, file: string, error: string }> }} */
const summary = {
  passed: 0,
  failed: 0,
  skipped: 0,
  flaky: 0,
  failures: [],
};

function walkSuites(suite, parents = []) {
  const titles = [...parents, suite.title].filter(Boolean);
  for (const spec of suite.specs || []) {
    const ok = spec.ok !== false && (spec.tests || []).every((t) => (t.results || []).every((r) => r.status === "passed" || r.status === "skipped"));
    for (const t of spec.tests || []) {
      for (const r of t.results || []) {
        if (r.status === "passed") summary.passed += 1;
        else if (r.status === "skipped") summary.skipped += 1;
        else if (r.status === "failed" || r.status === "timedOut" || r.status === "interrupted") {
          summary.failed += 1;
          const err = r.error?.message || r.errors?.[0]?.message || "unknown";
          summary.failures.push({
            title: [...titles, spec.title].filter(Boolean).join(" › "),
            file: spec.file || suite.file || "",
            error: String(err).slice(0, 1200),
          });
        }
      }
    }
  }
  for (const child of suite.suites || []) walkSuites(child, titles);
}

if (fs.existsSync(resultsJson)) {
  try {
    const raw = JSON.parse(fs.readFileSync(resultsJson, "utf8"));
    for (const s of raw.suites || []) walkSuites(s);
    if (raw.stats) {
      // Prefer stats when present
      summary.passed = raw.stats.expected ?? summary.passed;
      summary.failed = raw.stats.unexpected ?? summary.failed;
      summary.skipped = raw.stats.skipped ?? summary.skipped;
      summary.flaky = raw.stats.flaky ?? 0;
    }
  } catch (e) {
    console.warn("[quality-loop] could not parse results.json", e);
  }
} else {
  // Fallback parse from list reporter lines
  const lines = `${stdout}\n${stderr}`.split(/\r?\n/);
  for (const line of lines) {
    if (/\bok\b/.test(line) && /›/.test(line)) summary.passed += 1;
    if (/\bx\b/.test(line) && /›/.test(line)) summary.failed += 1;
    if (/\b-\b/.test(line) && /›/.test(line)) summary.skipped += 1;
  }
}

const grade =
  summary.failed === 0 && summary.passed > 0
    ? "EXCELLENT"
    : summary.failed === 0
      ? "EMPTY"
      : summary.failed <= 2
        ? "NEEDS_FIX"
        : "POOR";

const md = [
  `# E2E Quality Loop Summary`,
  ``,
  `- **When:** ${new Date().toISOString()}`,
  `- **Suite:** \`${suiteArg}\``,
  `- **Grade:** **${grade}**`,
  `- **Passed:** ${summary.passed}`,
  `- **Failed:** ${summary.failed}`,
  `- **Skipped:** ${summary.skipped}`,
  `- **Flaky:** ${summary.flaky}`,
  `- **Exit code:** ${run.status ?? 1}`,
  `- **Media:** \`e2e/test-results/**/video.webm\` + \`screenshots/\``,
  `- **HTML:** \`e2e/playwright-report/index.html\``,
  ``,
  `## Failures to fix`,
  ``,
];

if (summary.failures.length === 0) {
  md.push(`_None._`);
} else {
  for (const f of summary.failures) {
    md.push(`### ${f.title}`);
    md.push(``);
    md.push(`- File: \`${f.file}\``);
    md.push(``);
    md.push("```");
    md.push(f.error);
    md.push("```");
    md.push(``);
  }
}

md.push(``);
md.push(`## Agent instructions`);
md.push(``);
md.push(`1. Read failures above (English errors).`);
md.push(`2. Fix product gaps / flaky expects / missing routes.`);
md.push(`3. Re-run: \`node e2e/quality-loop.mjs --suite ${suiteArg}\``);
md.push(`4. Repeat until Grade is EXCELLENT.`);
md.push(``);

fs.writeFileSync(summaryMd, md.join("\n"));
fs.writeFileSync(path.join(outDir, "summary.json"), JSON.stringify({ grade, ...summary, suite: suiteArg }, null, 2));

console.log(`\n[quality-loop] grade=${grade} passed=${summary.passed} failed=${summary.failed} skipped=${summary.skipped}`);
console.log(`[quality-loop] wrote ${summaryMd}`);

process.exit(summary.failed > 0 || (run.status ?? 1) !== 0 ? 1 : 0);
