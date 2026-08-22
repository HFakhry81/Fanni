/**
 * Appends the latest git commit to PROJECT_DEVELOPMENT_REVIEW.md
 * (قاموس الـ Commits). Safe to run more than once: duplicate hashes are skipped.
 *
 * Usage:
 *   node scripts/src/log-commit-to-review.mjs --head
 *   node scripts/src/log-commit-to-review.mjs --seed [limit]
 */
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SKIP = process.env.SKIP_REVIEW_LOG === "1";
const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../..");
const reviewPath = path.join(repoRoot, "PROJECT_DEVELOPMENT_REVIEW.md");

function git(args, cwd) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
}

function arabicDate(isoDate) {
  const d = new Date(`${isoDate}T12:00:00`);
  const formatted = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Cairo",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(Number.isNaN(d.getTime()) ? new Date() : d);
  return formatted
    .replace("January", "يناير")
    .replace("February", "فبراير")
    .replace("March", "مارس")
    .replace("April", "أبريل")
    .replace("May", "مايو")
    .replace("June", "يونيو")
    .replace("July", "يوليو")
    .replace("August", "أغسطس")
    .replace("September", "سبتمبر")
    .replace("October", "أكتوبر")
    .replace("November", "نوفمبر")
    .replace("December", "ديسمبر");
}

function sanitizeCell(text) {
  return String(text ?? "")
    .replace(/\r?\n/g, " ")
    .replace(/\|/g, "/")
    .trim()
    .slice(0, 220);
}

const DICT_HEADER = "## قاموس الـ Commits";
const DICT_TABLE = "| التاريخ | الهاش | الرسالة | أبرز الملفات |\n|---|---|---|---|";

function ensureDictionary(content) {
  if (content.includes(DICT_HEADER) && content.includes("| الهاش |")) {
    return content;
  }
  const block = `\n${DICT_HEADER}\n\nسجل تلقائي بعد كل \`git commit\`. لا يُعاد كتابة الصفوف السابقة؛ يُضاف صف جديد لكل هاش فريد.\n\n${DICT_TABLE}\n`;
  return `${content.trimEnd()}\n${block}`;
}

async function appendEntries(entries) {
  let content = await readFile(reviewPath, "utf8");
  content = ensureDictionary(content);
  const unique = [];
  for (const entry of entries) {
    if (!entry.hash || content.includes(`| \`${entry.hash}\` |`)) continue;
    unique.push(entry);
  }
  if (unique.length === 0) return 0;

  const rows = unique
    .map(
      (entry) =>
        `| ${arabicDate(entry.date)} | \`${entry.hash}\` | ${sanitizeCell(entry.subject)} | ${sanitizeCell(entry.files)} |`,
    )
    .join("\n");

  content = content.replace(DICT_TABLE, `${DICT_TABLE}\n${rows}`);

  const today = arabicDate(new Date().toISOString().slice(0, 10));
  content = content.replace(/^آخر مراجعة:.*$/m, `آخر مراجعة: ${today}`);

  await writeFile(reviewPath, content.endsWith("\n") ? content : `${content}\n`);
  return unique.length;
}

function parseLogLine(line) {
  const [hash, date, ...rest] = line.split("|");
  if (!hash || !date || rest.length === 0) return null;
  return { hash, date, subject: rest.join("|") };
}

function filesFor(hash, cwd) {
  const raw = git(["diff-tree", "--no-commit-id", "--name-only", "-r", hash], cwd);
  const names = raw.split(/\r?\n/).filter(Boolean);
  if (names.length === 0) return "—";
  if (names.length <= 4) return names.join(", ");
  return `${names.slice(0, 4).join(", ")} +${names.length - 4}`;
}

const cwd = existsSync(path.join(process.cwd(), ".git")) ? process.cwd() : repoRoot;

if (SKIP) {
  process.exit(0);
}

try {
  const mode = process.argv[2] ?? "--head";
  if (mode === "--seed") {
    const limit = process.argv[3] ?? "40";
    const log = git(["log", "-n", String(limit), "--pretty=format:%h|%ad|%s", "--date=short"], cwd);
    const entries = log
      .split(/\r?\n/)
      .map(parseLogLine)
      .filter(Boolean)
      .map((entry) => ({ ...entry, files: filesFor(entry.hash, cwd) }));
    const added = await appendEntries(entries);
    console.log(`قاموس الـ Commits: أُضيف ${added} صفًا.`);
  } else {
    const hash = git(["rev-parse", "--short", "HEAD"], cwd);
    const subject = git(["log", "-1", "--pretty=%s"], cwd);
    const date = git(["log", "-1", "--pretty=%ad", "--date=short"], cwd);
    const names = git(["diff-tree", "--no-commit-id", "--name-only", "-r", "HEAD"], cwd)
      .split(/\r?\n/)
      .filter(Boolean);
    if (names.length === 1 && names[0] === "PROJECT_DEVELOPMENT_REVIEW.md") {
      process.exit(0);
    }
    const added = await appendEntries([{ hash, date, subject, files: filesFor(hash, cwd) }]);
    if (added > 0) {
      console.log(`سُجّل الالتزام ${hash} في PROJECT_DEVELOPMENT_REVIEW.md`);
    }
  }
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(0);
}
