import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const desktop = "C:/Users/Sam/Desktop";
const file = fs
  .readdirSync(desktop)
  .find((name) => name.includes("29-08-2026") && name.endsWith(".docx"));
if (!file) {
  console.error("docx not found");
  process.exit(1);
}

const zipPath = path.join(desktop, file);
const buf = fs.readFileSync(zipPath);
// Minimal zip reader for single file word/document.xml
const localName = "word/document.xml";
const textDecoder = new TextDecoder("utf8");
let offset = 0;
let xml = null;
while (offset < buf.length - 4) {
  const sig = buf.readUInt32LE(offset);
  if (sig !== 0x04034b50) {
    offset += 1;
    continue;
  }
  const compMethod = buf.readUInt16LE(offset + 8);
  const compSize = buf.readUInt32LE(offset + 18);
  const fileNameLen = buf.readUInt16LE(offset + 26);
  const extraLen = buf.readUInt16LE(offset + 28);
  const nameStart = offset + 30;
  const name = buf.slice(nameStart, nameStart + fileNameLen).toString("utf8");
  const dataStart = nameStart + fileNameLen + extraLen;
  const data = buf.slice(dataStart, dataStart + compSize);
  if (name === localName) {
    if (compMethod === 0) xml = data;
    else if (compMethod === 8) {
      const zlib = await import("node:zlib");
      xml = zlib.inflateRawSync(data);
    }
    break;
  }
  offset = dataStart + compSize;
}

if (!xml) {
  console.error("document.xml not found in zip");
  process.exit(1);
}

const raw = textDecoder.decode(xml);
const paras = raw
  .split(/<w:p[\s>]/)
  .slice(1)
  .map((chunk) => {
    const texts = [...chunk.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]);
    return texts.join("");
  })
  .filter((p) => p.trim());

console.log(paras.join("\n"));
