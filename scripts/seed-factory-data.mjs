import fs from "fs";
import pg from "pg";

const { Pool } = pg;

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const envFile = fs.readFileSync(filePath, "utf8");
  for (const line of envFile.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) {
      continue;
    }

    const [, key, rawValue] = match;
    const value = rawValue.trim().replace(/^['"]|['"]$/g, "");
    process.env[key] ??= value;
  }
}

loadEnvFile(".env.local");

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("DATABASE_URL not found in .env.local or the environment.");
  process.exit(1);
}

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: /localhost|127\.0\.0\.1/i.test(databaseUrl)
    ? false
    : { rejectUnauthorized: process.env.PGSSL_INSECURE !== "true" },
});

async function count(client, table) {
  const result = await client.query(`SELECT COUNT(*)::int AS count FROM ${table}`);
  return Number(result.rows[0]?.count ?? 0);
}

async function seedData() {
  const client = await pool.connect();

  try {
    const [workers, items, workEntries] = await Promise.all([
      count(client, "factory_workers"),
      count(client, "factory_items"),
      count(client, "factory_daily_work"),
    ]);

    console.log(`Current factory data: ${workers} workers, ${items} items, ${workEntries} work entries.`);

    if ((workers > 0 || items > 0 || workEntries > 0) && process.env.FORCE_FACTORY_SEED !== "true") {
      console.log("Factory data already exists. Skipping demo seed.");
      console.log("Set FORCE_FACTORY_SEED=true only when you intentionally want demo rows inserted.");
      return;
    }

    await client.query("BEGIN");

    await client.query(`
      INSERT INTO factory_workers (id, name, worker_type, category, monthly_salary, status, created_at, updated_at)
      VALUES
        ('seed-worker-upper-1', 'Raj Kumar', 'piece_rate', 'Upper', NULL, 'active', NOW(), NOW()),
        ('seed-worker-fiber-1', 'Santosh Sharma', 'piece_rate', 'Fibermen', NULL, 'active', NOW(), NOW()),
        ('seed-worker-staff-1', 'Factory Staff', 'monthly_staff', 'Staff', 15000, 'active', NOW(), NOW())
      ON CONFLICT (id) DO NOTHING
    `);

    await client.query(`
      INSERT INTO factory_items (id, name, code, status, created_at, updated_at)
      VALUES
        ('seed-item-flatpatta', 'Flatpatta', 'FP001', 'active', NOW(), NOW()),
        ('seed-item-sandal', 'Sandal', 'SD001', 'active', NOW(), NOW())
      ON CONFLICT (id) DO NOTHING
    `);

    await client.query(`
      INSERT INTO factory_rates (id, item_id, worker_category, rate_per_pair, effective_date, created_at)
      VALUES
        ('seed-rate-flatpatta-upper', 'seed-item-flatpatta', 'Upper', 12, CURRENT_DATE, NOW()),
        ('seed-rate-flatpatta-fiber', 'seed-item-flatpatta', 'Fibermen', 8, CURRENT_DATE, NOW()),
        ('seed-rate-sandal-upper', 'seed-item-sandal', 'Upper', 10, CURRENT_DATE, NOW()),
        ('seed-rate-sandal-fiber', 'seed-item-sandal', 'Fibermen', 6, CURRENT_DATE, NOW())
      ON CONFLICT (id) DO NOTHING
    `);

    await client.query(`
      INSERT INTO factory_daily_work
        (id, date, worker_id, item_id, pairs_count, status, rate_applied, amount_earned, created_at, updated_at)
      VALUES
        ('seed-work-1', CURRENT_DATE, 'seed-worker-upper-1', 'seed-item-flatpatta', 25, 'completed', 12, 300, NOW(), NOW()),
        ('seed-work-2', CURRENT_DATE, 'seed-worker-fiber-1', 'seed-item-flatpatta', 15, 'completed', 8, 120, NOW(), NOW())
      ON CONFLICT (id) DO NOTHING
    `);

    await client.query("COMMIT");

    const [finalWorkers, finalItems, finalWorkEntries] = await Promise.all([
      count(client, "factory_workers"),
      count(client, "factory_items"),
      count(client, "factory_daily_work"),
    ]);

    console.log("Factory demo seed complete.");
    console.log(`Final factory data: ${finalWorkers} workers, ${finalItems} items, ${finalWorkEntries} work entries.`);
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Error seeding factory data:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

seedData();
