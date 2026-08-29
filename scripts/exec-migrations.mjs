import { readdir } from "node:fs/promises";
import { resolve } from "node:path";
import postgres from "postgres";

const databaseUrl = process.env.DB_POSTGRES_URL;
if (!databaseUrl) {
  throw new Error("DB_POSTGRES_URL is required to run database migrations.");
}

const sql = postgres(databaseUrl, { max: 1 });
const migrationsDirectory = resolve(process.cwd(), "migrations");

try {
  await sql`
    CREATE TABLE IF NOT EXISTS marsbank_schema_migrations (
      filename text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  const filenames = (await readdir(migrationsDirectory))
    .filter((filename) => filename.endsWith(".sql"))
    .sort();

  for (const filename of filenames) {
    const [applied] = await sql`
      SELECT filename
      FROM marsbank_schema_migrations
      WHERE filename = ${filename}
    `;
    if (applied) continue;

    await sql.begin(async (transaction) => {
      await transaction.file(resolve(migrationsDirectory, filename));
      await transaction`
        INSERT INTO marsbank_schema_migrations (filename)
        VALUES (${filename})
      `;
    });
  }
} finally {
  await sql.end();
}
