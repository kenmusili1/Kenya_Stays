const express = require("express");
const { asyncHandler } = require("../middleware/errorHandler");
const { optionalAuthenticate, authenticate, requireRole } = require("../middleware/auth");
const db = require("../db");

const router = express.Router();

const CUSTOMER_CARE_STATUSES = ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_CUSTOMER", "RESOLVED", "CLOSED"];

router.post("/", optionalAuthenticate, asyncHandler(async (req, res) => {
    const { name, email, phone, subject, message } = req.body;

    if (!name || !email || !phone || !subject || !message) {
        return res.status(400).json({
            success: false,
            message: "Name, email, phone, subject, and message are required."
        });
    }

    const result = await db.query(
        `INSERT INTO customer_care_messages (customer_id, name, email, phone, subject, message)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [
            req.user?.account_id || null,
            String(name).trim(),
            String(email).trim(),
            String(phone).trim(),
            String(subject).trim(),
            String(message).trim()
        ]
    );

    return res.status(201).json({
        success: true,
        message: "Your message has been received.",
        customerMessage: result.rows[0]
    });
}));

// Listing every customer's contact message is only for staff - this used
// to be a fully public route.
router.get("/", authenticate, requireRole("ADMIN", "CUSTOMER CARE"), asyncHandler(async (_req, res) => {
    const result = await db.query(
        "SELECT * FROM customer_care_messages ORDER BY created_at DESC"
    );

    return res.json({
        success: true,
        statuses: CUSTOMER_CARE_STATUSES,
        messages: result.rows
    });
}));

module.exports = router;
