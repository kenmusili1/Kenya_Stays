const express = require("express");
const { asyncHandler } = require("../middleware/errorHandler");
const { authenticate } = require("../middleware/auth");
const { callbackLimiter } = require("../middleware/rateLimiters");
const { findBookingById } = require("../bookings/bookingService");
const { findAccountById } = require("../accounts/accountService");
const { normalizeKenyanPhoneNumber } = require("../utils/phone");
const { initiateMpesaStkPush, buildCallbackUrl, verifyCallbackToken } = require("../payments/payhero");
const {
    PAYMENT_STATUSES
} = require("../payments/paymentStatuses");
const {
    findPaymentRequestById,
    serializePaymentRequest,
    transitionPaymentStatus,
    processPayHeroCallback
} = require("../payments/paymentService");
const db = require("../db");
const { canViewBooking } = require("./bookings.routes");

const router = express.Router();

// Public - Pay Hero calls this. Protected by a shared-secret token (Pay
// Hero has no HMAC/signature verification of its own) plus a rate limit,
// since it can't require a login.
router.post("/payhero/callback", callbackLimiter, asyncHandler(async (req, res) => {
    if (!verifyCallbackToken(req)) {
        console.warn("Pay Hero callback rejected: missing or invalid token.", {
            ip: req.ip,
            query: req.query
        });

        return res.status(401).json({ success: false, message: "Unauthorized." });
    }

    console.log("Pay Hero callback received:", JSON.stringify(req.body));

    const result = await processPayHeroCallback(req.body);

    return res.status(200).json(result);
}));

router.get("/:paymentRequestId", authenticate, asyncHandler(async (req, res) => {
    const paymentRequestId = Number(req.params.paymentRequestId);

    if (!Number.isInteger(paymentRequestId) || paymentRequestId <= 0) {
        return res.status(400).json({ success: false, message: "Invalid payment request ID." });
    }

    const paymentRequest = await findPaymentRequestById(paymentRequestId);

    if (!paymentRequest) {
        return res.status(404).json({ success: false, message: "Payment request not found." });
    }

    const booking = await findBookingById(paymentRequest.booking_id);

    if (!booking || !canViewBooking(req.user, booking)) {
        return res.status(403).json({
            success: false,
            message: "You do not have permission to view this payment."
        });
    }

    return res.json({ success: true, payment: serializePaymentRequest(paymentRequest) });
}));

router.post("/:paymentRequestId/stk-push", authenticate, asyncHandler(async (req, res) => {
    const paymentRequestId = Number(req.params.paymentRequestId);

    const paymentRequest = await findPaymentRequestById(paymentRequestId);

    if (!paymentRequest) {
        return res.status(404).json({ success: false, message: "Payment request not found." });
    }

    const booking = await findBookingById(paymentRequest.booking_id);

    // Only the customer who made the booking (or an admin) can trigger
    // payment for it - not even the property owner.
    if (!booking || (req.user.role !== "ADMIN" && req.user.account_id !== booking.customer_id)) {
        return res.status(403).json({
            success: false,
            message: "You do not have permission to pay for this booking."
        });
    }

    if (paymentRequest.status !== PAYMENT_STATUSES.PENDING) {
        return res.status(409).json({
            success: false,
            message: `Payment cannot be initiated from ${paymentRequest.status} status.`
        });
    }

    const phoneNumber = normalizeKenyanPhoneNumber(req.body.phoneNumber ?? req.body.phone_number);

    if (!phoneNumber) {
        return res.status(400).json({
            success: false,
            message: "Enter a valid Kenyan M-Pesa phone number."
        });
    }

    if (!paymentRequest.amount || Number(paymentRequest.amount) <= 0) {
        return res.status(400).json({ success: false, message: "Invalid payment amount." });
    }

    // Move PENDING -> PROCESSING up front. This UPDATE...WHERE is atomic,
    // so two simultaneous stk-push requests for the same payment can't
    // both pass this check - only one will actually change the row.
    const processingTransition = await transitionPaymentStatus(
        db,
        paymentRequestId,
        PAYMENT_STATUSES.PROCESSING,
        { phone_number: phoneNumber, method: "MPESA", provider: "PAYHERO" }
    );

    if (!processingTransition.changed) {
        return res.status(409).json({
            success: false,
            message: `Payment cannot be initiated from ${paymentRequest.status} status.`
        });
    }

    try {
        const customer = await findAccountById(booking.customer_id);

        const payHeroResponse = await initiateMpesaStkPush({
            amount: paymentRequest.amount,
            phoneNumber,
            reference: paymentRequest.internal_reference,
            customerName: customer?.name,
            callbackUrl: buildCallbackUrl()
        });

        if (!payHeroResponse || payHeroResponse.success !== true) {
            throw new Error("Pay Hero did not accept the STK request.");
        }

        // A callback may have already arrived and settled this payment
        // (to SUCCESS or FAILED) while we were waiting on Pay Hero's HTTP
        // response - the guarded transition simply won't apply in that
        // case, and we still record the STK metadata either way.
        const stkTransition = await transitionPaymentStatus(
            db,
            paymentRequestId,
            PAYMENT_STATUSES.STK_INITIATED,
            {
                payhero_reference: payHeroResponse.reference || null,
                checkout_request_id: payHeroResponse.CheckoutRequestID || null,
                payhero_status: payHeroResponse.status || null
            }
        );

        const finalPaymentRequest = stkTransition.paymentRequest
            || await findPaymentRequestById(paymentRequestId);

        return res.status(202).json({
            success: true,
            message: "M-Pesa payment request initiated. Check your phone and enter your M-Pesa PIN.",
            payment: serializePaymentRequest(finalPaymentRequest)
        });

    } catch (error) {
        console.error("Pay Hero STK Push error:", error);

        await transitionPaymentStatus(
            db,
            paymentRequestId,
            PAYMENT_STATUSES.FAILED,
            { failure_reason: error.message }
        );

        return res.status(502).json({
            success: false,
            message: "Unable to initiate the M-Pesa payment."
        });
    }
}));

module.exports = router;
