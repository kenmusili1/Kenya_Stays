// Creates the first ADMIN account from ADMIN_NAME / ADMIN_EMAIL /
// ADMIN_PASSWORD env vars. Safe to re-run - does nothing if an account
// with that email already exists.
//
// Usage:
//   ADMIN_NAME="Your Name" ADMIN_EMAIL="you@example.com" ADMIN_PASSWORD="a-strong-password" node scripts/seed-admin.js

require("dotenv").config();
const db = require("../src/db");
const { createAccount, findAccountByEmail } = require("../src/accounts/accountService");

async function main() {
    const name = process.env.ADMIN_NAME;
    const email = process.env.ADMIN_EMAIL;
    const password = process.env.ADMIN_PASSWORD;

    if (!name || !email || !password) {
        console.error("Set ADMIN_NAME, ADMIN_EMAIL, and ADMIN_PASSWORD before running this script.");
        process.exit(1);
    }

    if (password.length < 8) {
        console.error("ADMIN_PASSWORD must be at least 8 characters.");
        process.exit(1);
    }

    const existing = await findAccountByEmail(email);

    if (existing) {
        console.log(`An account with email ${email} already exists (role: ${existing.role}) - nothing to do.`);
        await db.pool.end();
        return;
    }

    const account = await createAccount({ name, email, password, role: "ADMIN" });

    console.log(`Created ADMIN account #${account.account_id} (${account.email}).`);
    await db.pool.end();
}

main().catch(error => {
    console.error("Seeding admin account failed:", error);
    process.exit(1);
});
