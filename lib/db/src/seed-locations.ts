import "dotenv/config";
import pg from "pg";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url"; // تم استيراد pathToFileURL هنا

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// تحويل المسار إلى تنسيق file:// متوافق مع نظام التشغيل ويندوز لتجنب خطأ ESM
const egyptLocationsPath = path.resolve(__dirname, "../../../artifacts/mobile/constants/egyptLocations.ts");
const importedModule = await import(pathToFileURL(egyptLocationsPath).href);

// جلب البيانات بمرونة بناءً على طريقة التصدير المستخدمة في الملف
// جلب البيانات بمرونة بناءً على طريقة التصدير المستخدمة في الملف
// جلب البيانات بمرونة بناءً على طريقة التصدير المستخدمة في الملف
const EGYPT_LOCATIONS = 
  importedModule.EGYPT_LOCATIONS || // تأكد أن هذا السطر هو الأول تماماً
  importedModule.default || 
  importedModule.egyptLocations;

// التحقق من أن البيانات التي جلبناها هي مصفوفة بالفعل
if (!EGYPT_LOCATIONS || !Array.isArray(EGYPT_LOCATIONS)) {
  console.error("خطأ: لم يتم العثور على مصفوفة المواقع داخل ملف egyptLocations.ts.");
  console.error("المفاتيح المصدرة المتوفرة في الملف هي:", Object.keys(importedModule));
  process.exit(1);
}

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();
console.log("العنصر الأول في المصفوفة المستوردة:", EGYPT_LOCATIONS[0]);

try {
  await client.query("BEGIN");
  let g = 0, a = 0, n = 0;
  for (const gov of EGYPT_LOCATIONS) {
    await client.query(
      `INSERT INTO locations (id, type, name_ar, name_en, parent_id, slug)
       VALUES ($1,'governorate',$2,$3,NULL,$4)
       ON CONFLICT (id) DO NOTHING`,
      [gov.id, gov.ar, gov.en, gov.id],
    );
    g++;
    for (const area of gov.areas ?? []) {
      await client.query(
        `INSERT INTO locations (id, type, name_ar, name_en, parent_id, slug)
         VALUES ($1,'area',$2,$3,$4,$5)
         ON CONFLICT (id) DO NOTHING`,
        [area.id, area.ar, area.en, gov.id, area.id],
      );
      a++;
      for (const nbh of area.neighborhoods ?? []) {
        await client.query(
          `INSERT INTO locations (id, type, name_ar, name_en, parent_id, slug)
           VALUES ($1,'neighborhood',$2,$3,$4,$5)
           ON CONFLICT (id) DO NOTHING`,
          [nbh.id, nbh.ar, nbh.en, area.id, nbh.id],
        );
        n++;
      }
    }
  }
  await client.query("COMMIT");
  console.log(`Seeded: ${g} governorates, ${a} areas, ${n} neighborhoods.`);
} catch (e) {
  await client.query("ROLLBACK");
  console.error("Seed failed:", e);
  process.exit(1);
} finally {
  client.release();
  await pool.end();
}
