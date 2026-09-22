const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
require("dotenv").config();

async function main() {
    const databaseUrl = process.env.DATABASE_URL;

    if (!databaseUrl) {
        console.error("DATABASE_URL is not set.");
        process.exit(1);
    }

    const useSsl =
        process.env.NODE_ENV === "production" ||
        /sslmode=require/.test(databaseUrl);

    const pool = new Pool({
        connectionString: databaseUrl,
        ssl: useSsl ? { rejectUnauthorized: false } : false
    });

    const migrationsDir = path.join(__dirname, "..", "migrations");

    const files = fs
        .readdirSync(migrationsDir)
        .filter(file => file.endsWith(".sql"))
        .sort();

    for (const file of files) {
        console.log(`Running migration: ${file}`);

        const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
        await pool.query(sql);
    }

    console.log(`Applied ${files.length} migration file(s).`);
    await pool.end();
}

main().catch(error => {
    console.error("Migration failed:", error);
    process.exit(1);
});
