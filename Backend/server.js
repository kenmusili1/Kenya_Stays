const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
require("dotenv").config();

const app = express();

const PORT = process.env.PORT || 5000;
const bookings = [];
const accounts = [
    { account_id: 1, name: "Kennedy Customer", role: "CUSTOMER", status: "active" },
    { account_id: 2, name: "KenyaStays Owner", role: "OWNER", status: "active", approved: true },
    { account_id: 3, name: "KenyaStays Admin", role: "ADMIN", status: "active" },
    { account_id: 4, name: "Customer Care Team", role: "CUSTOMER CARE", status: "active" }
];
const notifications = [];
const paymentRequests = [];
const customerCareMessages = [];
const customerCareStatuses = [
    "NEW",
    "OPEN",
    "IN_PROGRESS",
    "WAITING_FOR_CUSTOMER",
    "RESOLVED",
    "CLOSED"
];
const DATABASE_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_CONNECTION_STRING;
let dbPool = null;

function getDbPool() {
    if (!DATABASE_URL) {
        return null;
    }

    if (!dbPool) {
        dbPool = new Pool({
            connectionString: DATABASE_URL,
            ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false
        });

        dbPool.on("error", error => {
            console.error("PostgreSQL pool error:", error);
        });
    }

    return dbPool;
}

async function persistState() {
    const pool = getDbPool();

    if (!pool) {
        return;
    }

    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        await client.query("DELETE FROM notifications");
        if (notifications.length > 0) {
            await client.query(
                `INSERT INTO notifications (id, user_id, booking_id, title, message, type, is_read, created_at)
                 VALUES ${notifications.map((_, index) => `($${index * 8 + 1}, $${index * 8 + 2}, $${index * 8 + 3}, $${index * 8 + 4}, $${index * 8 + 5}, $${index * 8 + 6}, $${index * 8 + 7}, $${index * 8 + 8})`).join(", ")}`,
                notifications.flatMap(notification => [
                    notification.id,
                    notification.user_id,
                    notification.booking_id,
                    notification.title,
                    notification.message,
                    notification.type,
                    notification.is_read,
                    notification.created_at
                ])
            );
        }

        await client.query("DELETE FROM payment_requests");
        if (paymentRequests.length > 0) {
            await client.query(
                `INSERT INTO payment_requests (
                    payment_request_id,
                    booking_id,
                    customer_id,
                    amount,
                    currency,
                    provider,
                    method,
                    internal_reference,
                    payhero_reference,
                    checkout_request_id,
                    phone_number,
                    status,
                    callback_data,
                    created_at,
                    updated_at,
                    refunded_at,
                    paid_at
                ) VALUES ${paymentRequests.map((_, index) => `(
                    $${index * 17 + 1}, $${index * 17 + 2}, $${index * 17 + 3}, $${index * 17 + 4}, $${index * 17 + 5},
                    $${index * 17 + 6}, $${index * 17 + 7}, $${index * 17 + 8}, $${index * 17 + 9}, $${index * 17 + 10},
                    $${index * 17 + 11}, $${index * 17 + 12}, $${index * 17 + 13}, $${index * 17 + 14}, $${index * 17 + 15},
                    $${index * 17 + 16}, $${index * 17 + 17}
                )`).join(", ")}`,
                paymentRequests.flatMap(request => [
                    request.payment_request_id,
                    request.booking_id,
                    request.customer_id,
                    request.amount,
                    request.currency,
                    request.provider,
                    request.method,
                    request.internal_reference,
                    request.payhero_reference,
                    request.checkout_request_id,
                    request.phone_number,
                    request.status,
                    request.callback_data,
                    request.created_at,
                    request.updated_at,
                    request.refunded_at || null,
                    request.paid_at || null
                ])
            );
        }

        await client.query("DELETE FROM customer_care_messages");
        if (customerCareMessages.length > 0) {
            await client.query(
                `INSERT INTO customer_care_messages (
                    message_id,
                    customer_id,
                    name,
                    email,
                    phone,
                    subject,
                    message,
                    status,
                    assigned_agent,
                    created_at,
                    updated_at
                ) VALUES ${customerCareMessages.map((_, index) => `($${index * 11 + 1}, $${index * 11 + 2}, $${index * 11 + 3}, $${index * 11 + 4}, $${index * 11 + 5}, $${index * 11 + 6}, $${index * 11 + 7}, $${index * 11 + 8}, $${index * 11 + 9}, $${index * 11 + 10}, $${index * 11 + 11})`).join(", ")}`,
                customerCareMessages.flatMap(message => [
                    message.message_id,
                    message.customer_id,
                    message.name,
                    message.email,
                    message.phone,
                    message.subject,
                    message.message,
                    message.status,
                    message.assigned_agent,
                    message.created_at,
                    message.updated_at
                ])
            );
        }

        await client.query("DELETE FROM bookings");
        if (bookings.length > 0) {
            await client.query(
                `INSERT INTO bookings (
                    booking_id,
                    customer_id,
                    property_id,
                    owner_id,
                    location,
                    check_in,
                    check_out,
                    guests,
                    accommodation,
                    amount,
                    status,
                    payment_status,
                    special_request,
                    created_at,
                    updated_at
                ) VALUES ${bookings.map((_, index) => `($${index * 15 + 1}, $${index * 15 + 2}, $${index * 15 + 3}, $${index * 15 + 4}, $${index * 15 + 5}, $${index * 15 + 6}, $${index * 15 + 7}, $${index * 15 + 8}, $${index * 15 + 9}, $${index * 15 + 10}, $${index * 15 + 11}, $${index * 15 + 12}, $${index * 15 + 13}, $${index * 15 + 14}, $${index * 15 + 15})`).join(", ")}`,
                bookings.flatMap(booking => [
                    booking.booking_id,
                    booking.customer_id,
                    booking.property_id,
                    booking.owner_id,
                    booking.location,
                    booking.check_in,
                    booking.check_out,
                    booking.guests,
                    booking.accommodation,
                    booking.amount,
                    booking.status,
                    booking.payment_status,
                    booking.special_request,
                    booking.created_at,
                    booking.updated_at
                ])
            );
        }

        await client.query("DELETE FROM properties");
        if (properties.length > 0) {
            await client.query(
                `INSERT INTO properties (
                    property_id,
                    owner_id,
                    approved,
                    name,
                    location,
                    city,
                    latitude,
                    longitude,
                    nightly_rate,
                    max_guests,
                    accommodation,
                    available,
                    unavailable_dates
                ) VALUES ${properties.map((_, index) => `($${index * 14 + 1}, $${index * 14 + 2}, $${index * 14 + 3}, $${index * 14 + 4}, $${index * 14 + 5}, $${index * 14 + 6}, $${index * 14 + 7}, $${index * 14 + 8}, $${index * 14 + 9}, $${index * 14 + 10}, $${index * 14 + 11}, $${index * 14 + 12}, $${index * 14 + 13}, $${index * 14 + 14})`).join(", ")}`,
                properties.flatMap(property => [
                    property.property_id,
                    property.owner_id,
                    property.approved,
                    property.name,
                    property.location,
                    property.city,
                    property.latitude,
                    property.longitude,
                    property.nightly_rate,
                    property.max_guests,
                    property.accommodation,
                    property.available,
                    JSON.stringify(property.unavailable_dates || [])
                ])
            );
        }

        await client.query("DELETE FROM accounts");
        if (accounts.length > 0) {
            await client.query(
                `INSERT INTO accounts (account_id, name, role, status, approved)
                 VALUES ${accounts.map((_, index) => `($${index * 5 + 1}, $${index * 5 + 2}, $${index * 5 + 3}, $${index * 5 + 4}, $${index * 5 + 5})`).join(", ")}`,
                accounts.flatMap(account => [
                    account.account_id,
                    account.name,
                    account.role,
                    account.status,
                    account.approved ?? null
                ])
            );
        }

        await client.query("COMMIT");
    } catch (error) {
        await client.query("ROLLBACK");
        console.error("Unable to persist the KenyaStays data to PostgreSQL:", error);
    } finally {
        client.release();
    }
}

async function initializeDatabase() {
    const pool = getDbPool();

    if (!pool) {
        return;
    }

    await pool.query(`
        CREATE TABLE IF NOT EXISTS accounts (
            account_id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            role TEXT NOT NULL,
            status TEXT NOT NULL,
            approved BOOLEAN
        );

        CREATE TABLE IF NOT EXISTS properties (
            property_id INTEGER PRIMARY KEY,
            owner_id INTEGER NOT NULL,
            approved BOOLEAN NOT NULL DEFAULT TRUE,
            name TEXT NOT NULL,
            location TEXT NOT NULL,
            city TEXT NOT NULL,
            latitude DOUBLE PRECISION,
            longitude DOUBLE PRECISION,
            nightly_rate DOUBLE PRECISION,
            max_guests INTEGER,
            accommodation TEXT,
            available BOOLEAN,
            unavailable_dates JSONB DEFAULT '[]'::jsonb
        );

        CREATE TABLE IF NOT EXISTS bookings (
            booking_id INTEGER PRIMARY KEY,
            customer_id INTEGER,
            property_id INTEGER,
            owner_id INTEGER,
            location TEXT NOT NULL,
            check_in DATE NOT NULL,
            check_out DATE NOT NULL,
            guests INTEGER NOT NULL,
            accommodation TEXT NOT NULL,
            amount DOUBLE PRECISION,
            status TEXT NOT NULL,
            payment_status TEXT NOT NULL,
            special_request TEXT,
            created_at TIMESTAMPTZ,
            updated_at TIMESTAMPTZ
        );

        CREATE TABLE IF NOT EXISTS notifications (
            id INTEGER PRIMARY KEY,
            user_id INTEGER,
            booking_id INTEGER,
            title TEXT,
            message TEXT,
            type TEXT,
            is_read BOOLEAN DEFAULT false,
            created_at TIMESTAMPTZ
        );

        CREATE TABLE IF NOT EXISTS payment_requests (
            payment_request_id INTEGER PRIMARY KEY,
            booking_id INTEGER,
            customer_id INTEGER,
            amount DOUBLE PRECISION,
            currency TEXT,
            provider TEXT,
            method TEXT,
            internal_reference TEXT,
            payhero_reference TEXT,
            checkout_request_id TEXT,
            phone_number TEXT,
            status TEXT,
            callback_data TEXT,
            created_at TIMESTAMPTZ,
            updated_at TIMESTAMPTZ,
            refunded_at TIMESTAMPTZ,
            paid_at TIMESTAMPTZ
        );

        CREATE TABLE IF NOT EXISTS customer_care_messages (
            message_id INTEGER PRIMARY KEY,
            customer_id INTEGER,
            name TEXT,
            email TEXT,
            phone TEXT,
            subject TEXT,
            message TEXT,
            status TEXT,
            assigned_agent TEXT,
            created_at TIMESTAMPTZ,
            updated_at TIMESTAMPTZ
        );
    `);

    const accountCount = await pool.query("SELECT COUNT(*)::int AS count FROM accounts");
    if (accountCount.rows[0].count === 0) {
        await pool.query(
            `INSERT INTO accounts (account_id, name, role, status, approved)
             VALUES ($1, $2, $3, $4, $5), ($6, $7, $8, $9, $10), ($11, $12, $13, $14, $15), ($16, $17, $18, $19, $20)`,
            [
                1, "Kennedy Customer", "CUSTOMER", "active", null,
                2, "KenyaStays Owner", "OWNER", "active", true,
                3, "KenyaStays Admin", "ADMIN", "active", null,
                4, "Customer Care Team", "CUSTOMER CARE", "active", null
            ]
        );
    } else {
        const result = await pool.query("SELECT * FROM accounts ORDER BY account_id");
        accounts.splice(0, accounts.length, ...result.rows.map(row => ({
            ...row,
            approved: row.approved ?? null,
            account_id: Number(row.account_id)
        })));
    }

    const propertyCount = await pool.query("SELECT COUNT(*)::int AS count FROM properties");
    if (propertyCount.rows[0].count === 0) {
        await pool.query(
            `INSERT INTO properties (
                property_id,
                owner_id,
                approved,
                name,
                location,
                city,
                latitude,
                longitude,
                nightly_rate,
                max_guests,
                accommodation,
                available,
                unavailable_dates
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13), ($14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26), ($27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37, $38, $39), ($40, $41, $42, $43, $44, $45, $46, $47, $48, $49, $50, $51, $52)`,
            [
                1, 2, true, "Modern Apartment - Westlands", "Westlands", "Nairobi", -1.2676, 36.8108, 6500, 4, "Apartment", true, JSON.stringify([]),
                2, 2, true, "Quiet House - Kilimani", "Kilimani", "Nairobi", -1.2921, 36.7875, 5000, 5, "House", true, JSON.stringify([]),
                3, 2, true, "Garden Villa - Karen", "Karen", "Nairobi", -1.3197, 36.7073, 8000, 6, "Villa", true, JSON.stringify([]),
                4, 2, true, "Coastal Studio - Nyali", "Nyali", "Mombasa", -4.0228, 39.7211, 4500, 2, "Room", true, JSON.stringify([])
            ]
        );
    } else {
        const result = await pool.query("SELECT * FROM properties ORDER BY property_id");
        properties.splice(0, properties.length, ...result.rows.map(row => ({
            ...row,
            approved: row.approved ?? true,
            property_id: Number(row.property_id),
            owner_id: Number(row.owner_id),
            latitude: Number(row.latitude),
            longitude: Number(row.longitude),
            nightly_rate: Number(row.nightly_rate),
            max_guests: Number(row.max_guests),
            available: row.available ?? true,
            unavailable_dates: Array.isArray(row.unavailable_dates) ? row.unavailable_dates : []
        })));
    }

    const bookingCount = await pool.query("SELECT COUNT(*)::int AS count FROM bookings");
    if (bookingCount.rows[0].count > 0) {
        const result = await pool.query("SELECT * FROM bookings ORDER BY booking_id");
        bookings.splice(0, bookings.length, ...result.rows.map(row => ({
            ...row,
            booking_id: Number(row.booking_id),
            customer_id: row.customer_id == null ? null : Number(row.customer_id),
            property_id: row.property_id == null ? null : Number(row.property_id),
            owner_id: row.owner_id == null ? null : Number(row.owner_id),
            guests: Number(row.guests),
            amount: row.amount == null ? null : Number(row.amount),
            created_at: new Date(row.created_at),
            updated_at: new Date(row.updated_at)
        })));
    }

    const notificationCount = await pool.query("SELECT COUNT(*)::int AS count FROM notifications");
    if (notificationCount.rows[0].count > 0) {
        const result = await pool.query("SELECT * FROM notifications ORDER BY id");
        notifications.splice(0, notifications.length, ...result.rows.map(row => ({
            ...row,
            id: Number(row.id),
            user_id: row.user_id == null ? null : Number(row.user_id),
            booking_id: row.booking_id == null ? null : Number(row.booking_id),
            is_read: row.is_read ?? false,
            created_at: new Date(row.created_at)
        })));
    }

    const paymentRequestCount = await pool.query("SELECT COUNT(*)::int AS count FROM payment_requests");
    if (paymentRequestCount.rows[0].count > 0) {
        const result = await pool.query("SELECT * FROM payment_requests ORDER BY payment_request_id");
        paymentRequests.splice(0, paymentRequests.length, ...result.rows.map(row => ({
            ...row,
            payment_request_id: Number(row.payment_request_id),
            booking_id: Number(row.booking_id),
            customer_id: row.customer_id == null ? null : Number(row.customer_id),
            amount: Number(row.amount),
            created_at: new Date(row.created_at),
            updated_at: new Date(row.updated_at),
            paid_at: row.paid_at ? new Date(row.paid_at) : null,
            refunded_at: row.refunded_at ? new Date(row.refunded_at) : null
        })));
    }

    const customerMessageCount = await pool.query("SELECT COUNT(*)::int AS count FROM customer_care_messages");
    if (customerMessageCount.rows[0].count > 0) {
        const result = await pool.query("SELECT * FROM customer_care_messages ORDER BY message_id");
        customerCareMessages.splice(0, customerCareMessages.length, ...result.rows.map(row => ({
            ...row,
            message_id: Number(row.message_id),
            customer_id: row.customer_id == null ? null : Number(row.customer_id),
            created_at: new Date(row.created_at),
            updated_at: new Date(row.updated_at)
        })));
    }
}

initializeDatabase().catch(error => {
    console.error("Database initialization failed:", error);
});
const locationCoordinates = {
    "westlands, nairobi": { latitude: -1.2676, longitude: 36.8108 },
    "kilimani, nairobi": { latitude: -1.2921, longitude: 36.7875 },
    "karen, nairobi": { latitude: -1.3197, longitude: 36.7073 },
    "nairobi": { latitude: -1.2864, longitude: 36.8172 },
    "mombasa": { latitude: -4.0435, longitude: 39.6682 }
};
const properties = [
    {
        property_id: 1,
        owner_id: 2,
        approved: true,
        name: "Modern Apartment - Westlands",
        location: "Westlands",
        city: "Nairobi",
        latitude: -1.2676,
        longitude: 36.8108,
        nightly_rate: 6500,
        max_guests: 4,
        accommodation: "Apartment",
        available: true,
        unavailable_dates: []
    },
    {
        property_id: 2,
        owner_id: 2,
        approved: true,
        name: "Quiet House - Kilimani",
        location: "Kilimani",
        city: "Nairobi",
        latitude: -1.2921,
        longitude: 36.7875,
        nightly_rate: 5000,
        max_guests: 5,
        accommodation: "House",
        available: true,
        unavailable_dates: []
    },
    {
        property_id: 3,
        owner_id: 2,
        approved: true,
        name: "Garden Villa - Karen",
        location: "Karen",
        city: "Nairobi",
        latitude: -1.3197,
        longitude: 36.7073,
        nightly_rate: 8000,
        max_guests: 6,
        accommodation: "Villa",
        available: true,
        unavailable_dates: []
    },
    {
        property_id: 4,
        owner_id: 2,
        approved: true,
        name: "Coastal Studio - Nyali",
        location: "Nyali",
        city: "Mombasa",
        latitude: -4.0228,
        longitude: 39.7211,
        nightly_rate: 4500,
        max_guests: 2,
        accommodation: "Room",
        available: true,
        unavailable_dates: []
    }
];

//Payment statuses
const PAYMENT_STATUSES = Object.freeze({
    PENDING: "PENDING",
    STK_INITIATED: "STK_INITIATED",
    PROCESSING: "PROCESSING",
    SUCCESS: "SUCCESS",
    FAILED: "FAILED",
    CANCELLED: "CANCELLED",
    REFUNDED: "REFUNDED"
});

function calculateDistanceInKilometres(first, second) {

    const earthRadius = 6371;
    const latitudeDifference = (second.latitude - first.latitude) * Math.PI / 180;
    const longitudeDifference = (second.longitude - first.longitude) * Math.PI / 180;
    const firstLatitude = first.latitude * Math.PI / 180;
    const secondLatitude = second.latitude * Math.PI / 180;
    const haversine = Math.sin(latitudeDifference / 2) ** 2
        + Math.cos(firstLatitude) * Math.cos(secondLatitude)
        * Math.sin(longitudeDifference / 2) ** 2;

    return earthRadius * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));

}

function datesOverlap(checkIn, checkOut, unavailableDates) {

    return unavailableDates.some(date => date >= checkIn && date < checkOut);

}

function calculateNights(checkIn, checkOut) {

    return Math.ceil((new Date(`${checkOut}T00:00:00`) - new Date(`${checkIn}T00:00:00`)) / 86400000);

}

function findPropertyRecommendations({ location, latitude, longitude, checkIn, checkOut, guests, maxPrice, accommodation }) {

    const requestedCoordinates = latitude && longitude
        ? { latitude: Number(latitude), longitude: Number(longitude) }
        : locationCoordinates[String(location).trim().toLowerCase()];

    if (!requestedCoordinates) {
        return { requestedCoordinates: null, recommendations: [] };
    }

    const recommendations = properties
        .filter(property => property.approved !== false)
        .filter(property => property.available)
        .filter(property => property.max_guests >= guests)
        .filter(property => !maxPrice || property.nightly_rate <= Number(maxPrice))
        .filter(property => !accommodation || property.accommodation === accommodation)
        .filter(property => !datesOverlap(checkIn, checkOut, property.unavailable_dates))
        .map(property => ({
            ...property,
            distance_km: Number(calculateDistanceInKilometres(requestedCoordinates, property).toFixed(1)),
            total_amount: Number((calculateNights(checkIn, checkOut) * property.nightly_rate).toFixed(2))
        }))
        .sort((first, second) => first.distance_km - second.distance_km || first.nightly_rate - second.nightly_rate);

    return { requestedCoordinates, recommendations };

}

function createNotification({ userId, title, message, type, bookingId = null }) {

    const notification = {
        id: notifications.length + 1,
        user_id: userId,
        booking_id: bookingId,
        title,
        message,
        type,
        is_read: false,
        created_at: new Date()
    };

    notifications.push(notification);
    return notification;

}

function isAdmin(request) {

    const body = request.body || {};
    const query = request.query || {};
    const adminId = Number(query.admin_id ?? body.admin_id ?? request.params.adminId ?? 0);
    const role = String(query.role || body.role || "").toUpperCase();

    return adminId === 3 || role === "ADMIN" || role === "OWNER";

}

function isOwner(request) {

    const body = request.body || {};
    const query = request.query || {};
    const ownerId = Number(query.owner_id ?? body.owner_id ?? request.params.ownerId ?? 0);
    const role = String(query.role || body.role || "").toUpperCase();

    return ownerId === 2 || role === "OWNER";

}

// Middleware

app.use(cors());

app.use(express.json());

// Test route

app.get("/", (req, res) => {

    res.json({
        success: true,
        message: "KenyaStays backend is running"
    });

});

// Test API

app.get("/api/status", (req, res) => {

    res.json({
        status: "online",
        service: "KenyaStays API",
        timestamp: new Date()
    });

});

app.get("/api/accounts/roles", (_req, res) => {

    return res.json({
        success: true,
        roles: ["CUSTOMER", "OWNER", "ADMIN", "CUSTOMER CARE"]
    });

});

app.get("/api/admin/dashboard", (req, res) => {

    if (!isAdmin(req)) {
        return res.status(403).json({ success: false, message: "Admin access is required." });
    }

    const paidRevenue = bookings
        .filter(booking => booking.payment_status === "paid")
        .reduce((total, booking) => total + Number(booking.amount || 0), 0);
    const recentBookings = [...bookings].reverse().slice(0, 10).map(booking => ({
        ...booking,
        property: properties.find(property => property.property_id === booking.property_id)?.name || "Unassigned"
    }));

    return res.json({
        success: true,
        summary: {
            users: accounts.length,
            property_owners: accounts.filter(account => account.role === "OWNER").length,
            properties: properties.length,
            bookings: bookings.length,
            pending_requests: bookings.filter(booking => booking.status === "pending").length,
            customer_messages: customerCareMessages.filter(message => !["RESOLVED", "CLOSED"].includes(message.status)).length,
            revenue: paidRevenue
        },
        recent_bookings: recentBookings,
        accounts,
        properties,
        customer_messages: customerCareMessages,
        payments: paymentRequests
    });

});

app.patch("/api/admin/owners/:accountId/approval", (req, res) => {

    if (!isAdmin(req)) {
        return res.status(403).json({ success: false, message: "Admin access is required." });
    }

    const owner = accounts.find(account => account.account_id === Number(req.params.accountId) && account.role === "OWNER");

    if (!owner) {
        return res.status(404).json({ success: false, message: "Property owner not found." });
    }

    owner.approved = req.body.approved !== false;

    return res.json({ success: true, owner });

});

app.patch("/api/admin/properties/:propertyId/approval", (req, res) => {

    if (!isAdmin(req)) {
        return res.status(403).json({ success: false, message: "Admin access is required." });
    }

    const property = properties.find(item => item.property_id === Number(req.params.propertyId));

    if (!property) {
        return res.status(404).json({ success: false, message: "Property not found." });
    }

    property.approved = req.body.approved !== false;

    return res.json({ success: true, property });

});

app.patch("/api/admin/accounts/:accountId/status", (req, res) => {

    if (!isAdmin(req)) {
        return res.status(403).json({ success: false, message: "Admin access is required." });
    }

    const account = accounts.find(item => item.account_id === Number(req.params.accountId));
    const status = String(req.body.status || "").toLowerCase();

    if (!account || !["active", "suspended"].includes(status)) {
        return res.status(400).json({ success: false, message: "Account and status must be valid." });
    }

    account.status = status;

    return res.json({ success: true, account });

});

app.patch("/api/admin/customer-care/messages/:messageId", (req, res) => {

    if (!isAdmin(req)) {
        return res.status(403).json({ success: false, message: "Admin access is required." });
    }

    const customerMessage = customerCareMessages.find(item => item.message_id === Number(req.params.messageId));

    if (!customerMessage) {
        return res.status(404).json({ success: false, message: "Customer-care message not found." });
    }

    if (req.body.status && customerCareStatuses.includes(req.body.status)) {
        customerMessage.status = req.body.status;
    }

    if (Object.prototype.hasOwnProperty.call(req.body, "assigned_agent")) {
        customerMessage.assigned_agent = req.body.assigned_agent;
    }

    customerMessage.updated_at = new Date();

    return res.json({ success: true, customerMessage });

});

app.get("/api/properties", (_req, res) => {

    return res.json({
        success: true,
        properties
    });

});

app.post("/api/properties", (req, res) => {

    const isAllowed = isAdmin(req) || isOwner(req);

    if (!isAllowed) {
        return res.status(403).json({ success: false, message: "Admin or owner access is required." });
    }

    const {
        name,
        location,
        city,
        latitude,
        longitude,
        nightly_rate,
        max_guests,
        accommodation,
        owner_id,
        approved,
        available
    } = req.body;

    if (!name || !location || !city || !accommodation || !nightly_rate || !max_guests) {
        return res.status(400).json({
            success: false,
            message: "Property name, location, city, accommodation, nightly rate, and max guests are required."
        });
    }

    const parsedNightlyRate = Number(nightly_rate);
    const parsedMaxGuests = Number(max_guests);
    const parsedLatitude = Number(latitude ?? 0);
    const parsedLongitude = Number(longitude ?? 0);

    if (!Number.isFinite(parsedNightlyRate) || parsedNightlyRate <= 0) {
        return res.status(400).json({ success: false, message: "Nightly rate must be a positive number." });
    }

    if (!Number.isFinite(parsedMaxGuests) || parsedMaxGuests < 1) {
        return res.status(400).json({ success: false, message: "Maximum guests must be at least 1." });
    }

const isOwnerSubmission = !isAdmin(req);
    const fallbackApprovedState = isOwnerSubmission ? false : true;

    const newProperty = {
        property_id: properties.length + 1,
        owner_id: Number(owner_id ?? 2),
        approved: Object.prototype.hasOwnProperty.call(req.body, "approved") ? approved !== false : fallbackApprovedState,
        name: String(name).trim(),
        location: String(location).trim(),
        city: String(city).trim(),
        latitude: parsedLatitude,
        longitude: parsedLongitude,
        nightly_rate: parsedNightlyRate,
        max_guests: parsedMaxGuests,
        accommodation: String(accommodation).trim(),
        available: available !== false,
        unavailable_dates: []
    };

    properties.push(newProperty);

    return res.status(201).json({
        success: true,
        message: "Property added successfully.",
        property: newProperty
    });

});

app.post("/api/properties/recommendations", (req, res) => {

    const {
        location,
        latitude,
        longitude,
        checkIn,
        checkOut,
        guests,
        maxPrice,
        accommodation
    } = req.body;

    if (!location && !(latitude && longitude)) {

        return res.status(400).json({
            success: false,
            message: "Provide a location or latitude and longitude."
        });

    }

    if (!checkIn || !checkOut || new Date(checkOut) <= new Date(checkIn)) {

        return res.status(400).json({
            success: false,
            message: "Valid check-in and check-out dates are required."
        });

    }

    const guestCount = Number(guests || 1);

    if (!Number.isInteger(guestCount) || guestCount < 1) {

        return res.status(400).json({
            success: false,
            message: "Guests must be a whole number greater than zero."
        });

    }

    const result = findPropertyRecommendations({
        location,
        latitude,
        longitude,
        checkIn,
        checkOut,
        guests: guestCount,
        maxPrice,
        accommodation
    });

    return res.json({
        success: true,
        message: result.requestedCoordinates
            ? "Property recommendations found."
            : "Location coordinates are not available yet.",
        requested_location: location || null,
        requested_coordinates: result.requestedCoordinates,
        recommendations: result.recommendations
    });

});

app.post("/api/bookings", (req, res) => {

    const {
        location,
        checkIn,
        checkOut,
        guests,
        accommodation,
        specialRequest = ""
    } = req.body;

    if (!location || !checkIn || !checkOut || !guests || !accommodation) {

        return res.status(400).json({
            success: false,
            message: "Location, dates, guests, and accommodation are required."
        });

    }

    if (new Date(checkOut) <= new Date(checkIn)) {

        return res.status(400).json({
            success: false,
            message: "Check-out must be after check-in."
        });

    }

    const now = new Date();
    const booking = {
        booking_id: bookings.length + 1,
        customer_id: req.body.customer_id || null,
        property_id: req.body.property_id || null,
        owner_id: req.body.owner_id || null,
        location: String(location).trim(),
        check_in: checkIn,
        check_out: checkOut,
        guests: Number(guests),
        accommodation,
        amount: null,
        status: "pending",
        payment_status: "unpaid",
        special_request: String(specialRequest).trim(),
        created_at: now,
        updated_at: now
    };

    if (!Number.isInteger(booking.guests) || booking.guests < 1) {

        return res.status(400).json({
            success: false,
            message: "Guests must be a whole number greater than zero."
        });

    }

    const propertyMatches = findPropertyRecommendations({
        location: booking.location,
        checkIn: booking.check_in,
        checkOut: booking.check_out,
        guests: booking.guests,
        accommodation: booking.accommodation
    });

    const recommendedProperty = propertyMatches.recommendations[0];
    booking.property_id = req.body.property_id || recommendedProperty?.property_id || null;
    booking.owner_id = req.body.owner_id || recommendedProperty?.owner_id || null;
    booking.amount = recommendedProperty?.total_amount || null;

    bookings.push(booking);

    const ownerNotification = booking.owner_id
        ? createNotification({
            userId: booking.owner_id,
            title: "New booking request",
            message: `A customer has requested your ${booking.accommodation.toLowerCase()} in ${booking.location}.`,
            type: "booking_request",
            bookingId: booking.booking_id
        })
        : null;

    return res.status(201).json({
        success: true,
        message: "Stay request received.",
        booking,
        recommendations: propertyMatches.recommendations,
        notification: ownerNotification
    });

});

app.get("/api/owners/:ownerId/dashboard", (req, res) => {

    const ownerId = Number(req.params.ownerId);
    const owner = accounts.find(account => account.account_id === ownerId && account.role === "OWNER");

    if (!owner) {

        return res.status(404).json({
            success: false,
            message: "Owner account not found."
        });

    }

    const ownerBookings = bookings.filter(booking => booking.owner_id === ownerId);
    const ownerProperties = properties.filter(property => property.owner_id === ownerId);
    const expectedEarnings = ownerBookings
        .filter(booking => booking.status === "accepted" || booking.status === "confirmed")
        .reduce((total, booking) => total + Number(booking.amount || 0), 0);

    return res.json({
        success: true,
        owner,
        summary: {
            properties: ownerProperties.length,
            pending_requests: ownerBookings.filter(booking => booking.status === "pending").length,
            confirmed_bookings: ownerBookings.filter(booking => booking.status === "accepted" || booking.status === "confirmed").length,
            expected_earnings: expectedEarnings
        },
        bookings: ownerBookings,
        properties: ownerProperties
    });

});

app.patch("/api/owners/:ownerId/bookings/:bookingId", (req, res) => {

    const ownerId = Number(req.params.ownerId);
    const bookingId = Number(req.params.bookingId);
    const action = String(req.body.action || "").toLowerCase();
    const booking = bookings.find(item => item.booking_id === bookingId && item.owner_id === ownerId);

    if (!booking) {

        return res.status(404).json({
            success: false,
            message: "Booking was not found for this owner."
        });

    }

    if (!["accept", "decline"].includes(action)) {

        return res.status(400).json({
            success: false,
            message: "Action must be accept or decline."
        });

    }

    const now = new Date();
    booking.status = action === "accept" ? "accepted" : "declined";
    booking.updated_at = now;

    if (action === "accept") {

        booking.payment_status = "pending";
        createNotification({
            userId: booking.customer_id,
            title: "Booking accepted",
            message: "Your accommodation request was accepted. Please complete payment to confirm your reservation.",
            type: "booking_accepted",
            bookingId: booking.booking_id
        });
        paymentRequests.push({
                payment_request_id: paymentRequests.length + 1,

                booking_id: booking.booking_id,
                customer_id: booking.customer_id,

                amount: Number(booking.amount),
                currency: "KES",

                provider: null,
                method: null,

                internal_reference: `KS-PAY-${Date.now()}-${booking.booking_id}`,

                payhero_reference: null,
                checkout_request_id: null,

                phone_number: null,

                status: PAYMENT_STATUSES.PENDING,

                callback_data: null,

                created_at: now,
                updated_at: now
        });

    }

    return res.json({
        success: true,
        message: action === "accept" ? "Booking accepted and payment requested." : "Booking declined.",
        booking,
        notification: notifications.at(-1) || null,
        payment_request: paymentRequests.at(-1) || null
    });

});

app.get("/api/notifications", (req, res) => {

    const userId = Number(req.query.user_id);
    const userNotifications = Number.isInteger(userId) && userId > 0
        ? notifications.filter(notification => notification.user_id === userId)
        : notifications;

    return res.json({
        success: true,
        unread_count: userNotifications.filter(notification => !notification.is_read).length,
        notifications: userNotifications
    });

});

app.patch("/api/notifications/:notificationId/read", (req, res) => {

    const notification = notifications.find(item => item.id === Number(req.params.notificationId));

    if (!notification) {

        return res.status(404).json({
            success: false,
            message: "Notification not found."
        });

    }

    notification.is_read = true;

    return res.json({
        success: true,
        notification
    });

});

/*app.post("/api/payments/:paymentRequestId/confirm", (req, res) => {

    const paymentRequest = paymentRequests.find(item => item.payment_request_id === Number(req.params.paymentRequestId));
    const supportedMethods = ["mpesa", "card", "bank_transfer"];
    const method = String(req.body.method || "").toLowerCase();

    if (!paymentRequest) {

        return res.status(404).json({
            success: false,
            message: "Payment request not found."
        });

    }

    if (!supportedMethods.includes(method)) {

        return res.status(400).json({
            success: false,
            message: "Payment method must be mpesa, card, or bank_transfer."
        });

    }

    if (paymentRequest.status === "PAID") {

        return res.status(409).json({
            success: false,
            message: "Payment has already been confirmed."
        });

    }

    const booking = bookings.find(item => item.booking_id === paymentRequest.booking_id);
    const now = new Date();
    paymentRequest.status = "PAID";
    paymentRequest.method = method;
    paymentRequest.paid_at = now;
    paymentRequest.updated_at = now;

    if (booking) {

        booking.payment_status = "paid";
        booking.status = "confirmed";
        booking.updated_at = now;

        createNotification({
            userId: booking.customer_id,
            title: "Booking confirmed",
            message: "Your payment was received and your reservation is confirmed.",
            type: "booking_confirmed",
            bookingId: booking.booking_id
        });
        createNotification({
            userId: booking.owner_id,
            title: "Payment received",
            message: `Payment was received for booking #${booking.booking_id}.`,
            type: "payment_received",
            bookingId: booking.booking_id
        });

    }

    return res.json({
        success: true,
        message: "Payment confirmed and booking confirmed.",
        payment_request: paymentRequest,
        booking
    });

});   */
// Mark payment as successful and update booking status
function markPaymentSuccessful(paymentRequest) {
    const now = new Date();

    if (paymentRequest.status === PAYMENT_STATUSES.SUCCESS) {
        return {
            alreadyProcessed: true
        };
    }

    paymentRequest.status = PAYMENT_STATUSES.SUCCESS;
    paymentRequest.updated_at = now;
    paymentRequest.paid_at = now;

    const booking = bookings.find(
        booking => booking.booking_id === paymentRequest.booking_id
    );

    if (!booking) {
        return {
            alreadyProcessed: false,
            booking: null
        };
    }

    booking.payment_status = "paid";
    booking.status = "confirmed";
    booking.updated_at = now;

    createNotification({
        userId: booking.customer_id,
        title: "Booking confirmed",
        message: "Your payment was received and your reservation is confirmed.",
        type: "booking_confirmed",
        bookingId: booking.booking_id
    });

    createNotification({
        userId: booking.owner_id,
        title: "Payment received",
        message: `Payment was received for booking #${booking.booking_id}.`,
        type: "payment_received",
        bookingId: booking.booking_id
    });

    return {
        alreadyProcessed: false,
        booking
    };
}


// Payment initiation endpoint
app.post("/api/payments/:paymentRequestId/stk-push", (req, res) => {
    const paymentRequestId = Number(req.params.paymentRequestId);

    const paymentRequest = paymentRequests.find(
        item => item.payment_request_id === paymentRequestId
    );

    if (!paymentRequest) {
        return res.status(404).json({
            success: false,
            message: "Payment request not found."
        });
    }

    if (paymentRequest.status !== PAYMENT_STATUSES.PENDING) {
        return res.status(409).json({
            success: false,
            message: `Payment cannot be initiated from ${paymentRequest.status} status.`
        });
    }

    const phoneNumber = String(req.body.phoneNumber || "").trim();

    if (!phoneNumber) {
        return res.status(400).json({
            success: false,
            message: "M-Pesa phone number is required."
        });
    }

    paymentRequest.method = "MPESA";
    paymentRequest.provider = "PAYHERO";
    paymentRequest.phone_number = phoneNumber;
    paymentRequest.status = PAYMENT_STATUSES.STK_INITIATED;
    paymentRequest.updated_at = new Date();

    return res.status(202).json({
        success: true,
        message: "Payment initiation accepted.",
        payment: {
            payment_request_id: paymentRequest.payment_request_id,
            internal_reference: paymentRequest.internal_reference,
            amount: paymentRequest.amount,
            currency: paymentRequest.currency,
            status: paymentRequest.status
        }
    });
});

app.patch("/api/admin/payments/:paymentRequestId/refund", (req, res) => {

    if (!isAdmin(req)) {
        return res.status(403).json({ success: false, message: "Admin access is required." });
    }

    const paymentRequest = paymentRequests.find(item => item.payment_request_id === Number(req.params.paymentRequestId));

    if (!paymentRequest || paymentRequest.status !== "PAID") {
        return res.status(404).json({ success: false, message: "A paid payment request is required." });
    }

    const booking = bookings.find(item => item.booking_id === paymentRequest.booking_id);
    paymentRequest.status = "REFUNDED";
    paymentRequest.refunded_at = new Date();

    if (booking) {
        booking.payment_status = "refunded";
        booking.status = "refunded";
        booking.updated_at = new Date();
    }

    return res.json({ success: true, payment_request: paymentRequest, booking });

});

app.post("/api/customer-care/messages", (req, res) => {

    const {
        name,
        email,
        phone,
        subject,
        message
    } = req.body;

    if (!name || !email || !phone || !subject || !message) {

        return res.status(400).json({
            success: false,
            message: "Name, email, phone, subject, and message are required."
        });

    }

    const now = new Date();
    const customerMessage = {
        message_id: customerCareMessages.length + 1,
        customer_id: req.body.customer_id || null,
        name: String(name).trim(),
        email: String(email).trim(),
        phone: String(phone).trim(),
        subject: String(subject).trim(),
        message: String(message).trim(),
        status: "NEW",
        assigned_agent: null,
        created_at: now,
        updated_at: now
    };

    customerCareMessages.push(customerMessage);

    return res.status(201).json({
        success: true,
        message: "Your message has been received.",
        customerMessage
    });

});

app.get("/api/customer-care/messages", (_req, res) => {

    return res.json({
        success: true,
        statuses: customerCareStatuses,
        messages: customerCareMessages
    });

});

if (require.main === module) {
    app.listen(PORT, () => {

        console.log(
            `KenyaStays backend running on port ${PORT}`
        );

    });
}

module.exports = app;
