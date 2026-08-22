import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const reviewPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../PROJECT_DEVELOPMENT_REVIEW.md");
const args = process.argv.slice(2).filter((argument, index) => !(index === 0 && argument === "--"));
const [summary, remaining = "لا يوجد"] = args;

if (!summary) {
  console.error('Usage: pnpm review:update -- "completed summary" "remaining work"');
  process.exit(1);
}

const now = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Africa/Cairo",
  day: "2-digit",
  month: "long",
  year: "numeric",
}).format(new Date());

const date = now
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

let content = await readFile(reviewPath, "utf8");
content = content.replace(/^آخر مراجعة:.*$/m, `آخر مراجعة: ${date}`);

const marker = "| التاريخ | المرحلة | ما تم | المتبقي |\n|---|---|---|---|";
const entry = `| ${date} | تحديث المشروع | ${summary} | ${remaining} |`;
if (!content.includes(marker)) {
  throw new Error("سجل التحديثات غير موجود أو تغيّر تنسيقه.");
}
content = content.replace(marker, `${marker}\n${entry}`);

await writeFile(reviewPath, content);
console.log(`تم تحديث PROJECT_DEVELOPMENT_REVIEW.md بتاريخ ${date}`);
