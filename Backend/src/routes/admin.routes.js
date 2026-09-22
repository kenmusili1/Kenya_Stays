const express = require("express");
const { asyncHandler } = require("../middleware/errorHandler");
const { authenticate, requireRole } = require("../middleware/auth");
const db = require("../db");
const { serializeAccount, createAccount, findAccountByEmail } = require("../accounts/accountService");
const { PAYMENT_STATUSES } = require("../payments/paymentStatuses");
const { transitionPaymentStatus, findPaymentRequestById } = require("../payments/paymentService");
const { findBookingById } = require("../bookings/bookingService");

const router = express.Router();

// Every route in this file is admin-only.
router.use(authenticate, requireRole("ADMIN"));

router.get("/dashboard", asyncHandler(async (_req, res) => {
    const [accounts, properties, bookings, messages, payments] = await Promise.all([
        db.query("SELECT account_id, name, role, status, approved FROM accounts"),
        db.query("SELECT * FROM properties"),
        db.query("SELECT * FROM bookings ORDER BY created_at DESC"),
        db.query("SELECT * FROM customer_care_messages ORDER BY created_at DESC"),
        db.query("SELECT * FROM payment_requests ORDER BY created_at DESC")
    ]);

    const paidRevenue = bookings.rows
        .filter(b => b.payment_status === "paid")
        .reduce((total, b) => total + Number(b.amount || 0), 0);

    const recentBookings = bookings.rows.slice(0, 10).map(booking => {
        const property = properties.rows.find(p => p.property_id === booking.property_id);
        return { ...booking, property: property?.name || "Unassigned" };
    });

    return res.json({
        success: true,
        summary: {
            users: accounts.rows.length,
            property_owners: accounts.rows.filter(a => a.role === "OWNER").length,
            properties: properties.rows.length,
            bookings: bookings.rows.length,
            pending_requests: bookings.rows.filter(b => b.status === "pending").length,
            customer_messages: messages.rows.filter(m => !["RESOLVED", "CLOSED"].includes(m.status)).length,
            revenue: paidRevenue
        },
        recent_bookings: recentBookings,
        accounts: accounts.rows,
        properties: properties.rows,
        customer_messages: messages.rows,
        payments: payments.rows
    });
}));

router.patch("/owners/:accountId/approval", asyncHandler(async (req, res) => {
    const result = await db.query(
        `UPDATE accounts SET approved = $2, updated_at = NOW()
         WHERE account_id = $1 AND role = 'OWNER'
         RETURNING *`,
        [Number(req.params.accountId), req.body.approved !== false]
    );

    if (result.rowCount === 0) {
        return res.status(404).json({ success: false, message: "Property owner not found." });
    }

    return res.json({ success: true, owner: serializeAccount(result.rows[0]) });
}));

router.patch("/properties/:propertyId/approval", asyncHandler(async (req, res) => {
    const result = await db.query(
        `UPDATE properties SET approved = $2, updated_at = NOW()
         WHERE property_id = $1
         RETURNING *`,
        [Number(req.params.propertyId), req.body.approved !== false]
    );

    if (result.rowCount === 0) {
        return res.status(404).json({ success: false, message: "Property not found." });
    }

    return res.json({ success: true, property: result.rows[0] });
}));

router.patch("/accounts/:accountId/status", asyncHandler(async (req, res) => {
    const status = String(req.body.status || "").toLowerCase();

    if (!["active", "suspended"].includes(status)) {
        return res.status(400).json({ success: false, message: "Status must be active or suspended." });
    }

    const result = await db.query(
        `UPDATE accounts SET status = $2, updated_at = NOW()
         WHERE account_id = $1
         RETURNING *`,
        [Number(req.params.accountId), status]
    );

    if (result.rowCount === 0) {
        return res.status(404).json({ success: false, message: "Account not found." });
    }

    return res.json({ success: true, account: serializeAccount(result.rows[0]) });
}));

// Bootstraps additional ADMIN / CUSTOMER CARE staff accounts - the only
// way these roles get created besides the one-time seed script, since
// public registration only allows CUSTOMER/OWNER.
router.post("/accounts", asyncHandler(async (req, res) => {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password || !["ADMIN", "CUSTOMER CARE"].includes(role)) {
        return res.status(400).json({
            success: false,
            message: "Name, email, password, and role (ADMIN or CUSTOMER CARE) are required."
        });
    }

    if (String(password).length < 8) {
        return res.status(400).json({ success: false, message: "Password must be at least 8 characters." });
    }

    if (await findAccountByEmail(email)) {
        return res.status(409).json({ success: false, message: "An account with this email already exists." });
    }

    const account = await createAccount({ name: String(name).trim(), email: String(email).trim(), password, role });

    return res.status(201).json({ success: true, account: serializeAccount(account) });
}));

const CUSTOMER_CARE_STATUSES = ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_CUSTOMER", "RESOLVED", "CLOSED"];

router.patch("/customer-care/messages/:messageId", asyncHandler(async (req, res) => {
    const setClauses = ["updated_at = NOW()"];
    const values = [Number(req.params.messageId)];
    let paramIndex = 2;

    if (req.body.status && CUSTOMER_CARE_STATUSES.includes(req.body.status)) {
        setClauses.push(`status = $${paramIndex}`);
        values.push(req.body.status);
        paramIndex += 1;
    }

    if (Object.prototype.hasOwnProperty.call(req.body, "assigned_agent")) {
        setClauses.push(`assigned_agent = $${paramIndex}`);
        values.push(req.body.assigned_agent);
        paramIndex += 1;
    }

    const result = await db.query(
        `UPDATE customer_care_messages SET ${setClauses.join(", ")} WHERE message_id = $1 RETURNING *`,
        values
    );

    if (result.rowCount === 0) {
        return res.status(404).json({ success: false, message: "Customer-care message not found." });
    }

    return res.json({ success: true, customerMessage: result.rows[0] });
}));

router.patch("/payments/:paymentRequestId/refund", asyncHandler(async (req, res) => {
    const paymentRequestId = Number(req.params.paymentRequestId);

    const existing = await findPaymentRequestById(paymentRequestId);

    if (!existing) {
        return res.status(404).json({ success: false, message: "Payment request not found." });
    }

    const transition = await transitionPaymentStatus(
        db,
        paymentRequestId,
        PAYMENT_STATUSES.REFUNDED,
        { refunded_at: new Date() }
    );

    if (!transition.changed) {
        return res.status(400).json({ success: false, message: "Only successful payments can be refunded." });
    }

    const existingBooking = await findBookingById(transition.paymentRequest.booking_id);

    let booking = existingBooking;

    if (existingBooking) {
        const bookingUpdateResult = await db.query(
            `UPDATE bookings SET payment_status = 'refunded', status = 'refunded', updated_at = NOW()
             WHERE booking_id = $1
             RETURNING *`,
            [existingBooking.booking_id]
        );

        booking = bookingUpdateResult.rows[0];
    }

    return res.json({
        success: true,
        payment_request: transition.paymentRequest,
        booking
    });
}));

module.exports = router;
