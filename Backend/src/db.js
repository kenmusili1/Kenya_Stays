const { Pool } = require("pg");
const config = require("./config");

// Render's managed Postgres (and most hosted Postgres providers) requires
// SSL, and typically presents a certificate that Node's default TLS
// validation won't chain to a known root - rejectUnauthorized: false is
// the standard, documented workaround for this class of provider (the
// connection is still encrypted; this only relaxes certificate-chain
// validation, which is normal for platform-managed Postgres).
const useSsl =
    config.isProduction ||
    /sslmode=require/.test(config.databaseUrl);

const pool = new Pool({
    connectionString: config.databaseUrl,
    ssl: useSsl ? { rejectUnauthorized: false } : false
});

pool.on("error", error => {
    // A background/idle client error should never crash the whole
    // process - log it and let the pool recover.
    console.error("Unexpected error on idle Postgres client:", error);
});

async function query(text, params) {
    return pool.query(text, params);
}

// Runs fn with a single checked-out client inside BEGIN/COMMIT, rolling
// back on any error. Every multi-statement write in this codebase (mark a
// payment SUCCESS + confirm the booking + create notifications, for
// example) goes through this so the whole thing either fully happens or
// fully doesn't.
async function withTransaction(fn) {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");
        const result = await fn(client);
        await client.query("COMMIT");
        return result;
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}

module.exports = {
    pool,
    query,
    withTransaction
};
