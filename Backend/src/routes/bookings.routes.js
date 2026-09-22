const express = require("express");
const { asyncHandler } = require("../middleware/errorHandler");
const { authenticate } = require("../middleware/auth");
const {
    createBooking,
    findBookingById
} = require("../bookings/bookingService");
const {
    findPaymentRequestByBookingId,
    serializePaymentRequest
} = require("../payments/paymentService");
const { findPropertyRecommendations } = require("../properties/propertyService");

const router = express.Router();

router.post("/", authenticate, asyncHandler(async (req, res) => {
    const {
        location,
        checkIn,
        checkOut,
        guests,
        accommodation,
        specialRequest,
        property_id: propertyId
    } = req.body;

    const result = await createBooking({
        customerId: req.user.account_id,
        location,
        checkIn,
        checkOut,
        guests,
        accommodation,
        specialRequest,
        propertyId
    });

    if (result.error) {
        return res.status(result.status || 400).json({
            success: false,
            message: result.error
        });
    }

    const recommendations = await findPropertyRecommendations({
        location,
        checkIn,
        checkOut,
        guests: Number(guests),
        accommodation
    });

    return res.status(201).json({
        success: true,
        message: "Booking submitted. Please complete payment.",
        booking: result.booking,
        payment_request: result.paymentRequest,
        recommendations: recommendations.recommendations
    });
}));

// A booking's payment details are only visible to the customer who made
// it, the property owner, or an admin.
function canViewBooking(user, booking) {
    return (
        user.role === "ADMIN" ||
        user.account_id === booking.customer_id ||
        user.account_id === booking.owner_id
    );
}

router.get("/:bookingId/payment", authenticate, asyncHandler(async (req, res) => {
    const bookingId = Number(req.params.bookingId);

    if (!Number.isInteger(bookingId) || bookingId <= 0) {
        return res.status(400).json({ success: false, message: "Invalid booking ID." });
    }

    const booking = await findBookingById(bookingId);

    if (!booking) {
        return res.status(404).json({ success: false, message: "Booking not found." });
    }

    if (!canViewBooking(req.user, booking)) {
        return res.status(403).json({
            success: false,
            message: "You do not have permission to view this booking's payment."
        });
    }

    const paymentRequest = await findPaymentRequestByBookingId(bookingId);

    if (!paymentRequest) {
        return res.status(404).json({
            success: false,
            message: "No payment request exists for this booking."
        });
    }

    return res.json({ success: true, payment: serializePaymentRequest(paymentRequest) });
}));

module.exports = { router, canViewBooking };
