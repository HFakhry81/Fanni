import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(here, "../../../.env") });
dotenv.config({ path: path.resolve(here, "../.env") });

if (!process.env.PORT && process.env.NODE_ENV !== "production") {
  process.env.PORT = "3000";
}
