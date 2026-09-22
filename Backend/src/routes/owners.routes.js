const express = require("express");
const { asyncHandler } = require("../middleware/errorHandler");
const { authenticate } = require("../middleware/auth");
const { findAccountById } = require("../accounts/accountService");
const db = require("../db");
const { listBookingsForOwner, decideOwnerBooking } = require("../bookings/bookingService");

const router = express.Router();

function requireSelfOrAdmin(req, res, next) {
    const ownerId = Number(req.params.ownerId);

    if (req.user.role !== "ADMIN" && req.user.account_id !== ownerId) {
        return res.status(403).json({
            success: false,
            message: "You do not have permission to view this owner's data."
        });
    }

    return next();
}

router.get("/:ownerId/dashboard", authenticate, requireSelfOrAdmin, asyncHandler(async (req, res) => {
    const ownerId = Number(req.params.ownerId);

    const owner = await findAccountById(ownerId);

    if (!owner || owner.role !== "OWNER") {
        return res.status(404).json({ success: false, message: "Owner account not found." });
    }

    const ownerBookings = await listBookingsForOwner(ownerId);

    const propertiesResult = await db.query(
        "SELECT * FROM properties WHERE owner_id = $1",
        [ownerId]
    );

    const expectedEarnings = ownerBookings
        .filter(booking => booking.status === "accepted" || booking.status === "confirmed")
        .reduce((total, booking) => total + Number(booking.amount || 0), 0);

    return res.json({
        success: true,
        owner: { account_id: owner.account_id, name: owner.name, status: owner.status, approved: owner.approved },
        summary: {
            properties: propertiesResult.rows.length,
            pending_requests: ownerBookings.filter(b => b.status === "pending").length,
            confirmed_bookings: ownerBookings.filter(b => b.status === "accepted" || b.status === "confirmed").length,
            expected_earnings: expectedEarnings
        },
        bookings: ownerBookings,
        properties: propertiesResult.rows
    });
}));

router.patch("/:ownerId/bookings/:bookingId", authenticate, requireSelfOrAdmin, asyncHandler(async (req, res) => {
    const ownerId = Number(req.params.ownerId);
    const bookingId = Number(req.params.bookingId);
    const action = String(req.body.action || "").toLowerCase();

    const result = await decideOwnerBooking({ bookingId, ownerId, action });

    if (result.error) {
        return res.status(result.status || 400).json({ success: false, message: result.error });
    }

    return res.json({
        success: true,
        message: action === "accept" ? "Booking accepted." : "Booking declined.",
        booking: result.booking,
        notification: result.notification
    });
}));

module.exports = router;
