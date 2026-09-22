const db = require("../db");
const { hashPassword } = require("../utils/password");

// Only roles a person can self-register as. ADMIN and CUSTOMER CARE
// accounts are created by an existing admin (see admin.routes.js) or by
// the bootstrap seed script - never through public registration.
const SELF_REGISTERABLE_ROLES = ["CUSTOMER", "OWNER"];

function serializeAccount(row) {
    if (!row) {
        return null;
    }

    return {
        account_id: row.account_id,
        name: row.name,
        email: row.email,
        role: row.role,
        status: row.status,
        approved: row.approved,
        created_at: row.created_at,
        updated_at: row.updated_at
    };
}

async function createAccount({ name, email, password, role }) {
    const passwordHash = await hashPassword(password);

    // New OWNER accounts start unapproved - an admin has to approve them
    // (via /api/admin/owners/:accountId/approval) before their listings
    // go live. Not applicable to any other role.
    const approved = role === "OWNER" ? false : null;

    const result = await db.query(
        `INSERT INTO accounts (name, email, password_hash, role, approved)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [name, email.toLowerCase().trim(), passwordHash, role, approved]
    );

    return result.rows[0];
}

async function findAccountByEmail(email) {
    const result = await db.query(
        "SELECT * FROM accounts WHERE email = $1",
        [String(email || "").toLowerCase().trim()]
    );

    return result.rows[0] || null;
}

async function findAccountById(accountId) {
    const result = await db.query(
        "SELECT * FROM accounts WHERE account_id = $1",
        [accountId]
    );

    return result.rows[0] || null;
}

module.exports = {
    SELF_REGISTERABLE_ROLES,
    serializeAccount,
    createAccount,
    findAccountByEmail,
    findAccountById
};
