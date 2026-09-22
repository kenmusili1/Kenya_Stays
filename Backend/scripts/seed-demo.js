// Seeds demo data for LOCAL DEVELOPMENT / TESTING ONLY:
// one demo owner account and the four sample properties from the
// original prototype. Idempotent - skips anything that already exists
// by email/name. Do not run this against a real production database.
//
// Usage: node scripts/seed-demo.js

require("dotenv").config();
const db = require("../src/db");
const { createAccount, findAccountByEmail } = require("../src/accounts/accountService");

const DEMO_PROPERTIES = [
    { name: "Modern Apartment - Westlands", location: "Westlands", city: "Nairobi", latitude: -1.2676, longitude: 36.8108, nightly_rate: 6500, max_guests: 4, accommodation: "Apartment" },
    { name: "Quiet House - Kilimani", location: "Kilimani", city: "Nairobi", latitude: -1.2921, longitude: 36.7875, nightly_rate: 5000, max_guests: 5, accommodation: "House" },
    { name: "Garden Villa - Karen", location: "Karen", city: "Nairobi", latitude: -1.3197, longitude: 36.7073, nightly_rate: 8000, max_guests: 6, accommodation: "Villa" },
    { name: "Coastal Studio - Nyali", location: "Nyali", city: "Mombasa", latitude: -4.0228, longitude: 39.7211, nightly_rate: 4500, max_guests: 2, accommodation: "Room" }
];

async function main() {
    let owner = await findAccountByEmail("demo-owner@kenyastays.example");

    if (!owner) {
        owner = await createAccount({
            name: "KenyaStays Demo Owner",
            email: "demo-owner@kenyastays.example",
            password: "demo-password-change-me",
            role: "OWNER"
        });

        await db.query(
            "UPDATE accounts SET approved = TRUE WHERE account_id = $1",
            [owner.account_id]
        );

        console.log(`Created demo owner #${owner.account_id}.`);
    } else {
        console.log("Demo owner already exists - reusing it.");
    }

    for (const property of DEMO_PROPERTIES) {
        const existing = await db.query(
            "SELECT property_id FROM properties WHERE name = $1",
            [property.name]
        );

        if (existing.rowCount > 0) {
            console.log(`Property "${property.name}" already exists - skipping.`);
            continue;
        }

        await db.query(
            `INSERT INTO properties
                (owner_id, approved, name, location, city, latitude, longitude, nightly_rate, max_guests, accommodation)
             VALUES ($1, TRUE, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [
                owner.account_id,
                property.name,
                property.location,
                property.city,
                property.latitude,
                property.longitude,
                property.nightly_rate,
                property.max_guests,
                property.accommodation
            ]
        );

        console.log(`Created property "${property.name}".`);
    }

    await db.pool.end();
}

main().catch(error => {
    console.error("Seeding demo data failed:", error);
    process.exit(1);
});
