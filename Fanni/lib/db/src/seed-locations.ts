import pg from "pg";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { EGYPT_LOCATIONS } = await import(
  path.resolve(__dirname, "../../../artifacts/mobile/constants/egyptLocations.ts")
);

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();

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
