const db = require("../db");
const { PAYMENT_STATUSES, TERMINAL_PAYMENT_STATUSES } = require("./paymentStatuses");

function serializePaymentRequest(row) {
    if (!row) {
        return null;
    }

    return {
        payment_request_id: row.payment_request_id,
        booking_id: row.booking_id,
        amount: Number(row.amount),
        currency: row.currency,
        provider: row.provider,
        method: row.method,
        status: row.status,
        reference: row.internal_reference,
        payhero_reference: row.payhero_reference,
        checkout_request_id: row.checkout_request_id,
        transaction_id: row.payhero_transaction_id,
        result_description: row.result_description,
        created_at: row.created_at,
        updated_at: row.updated_at,
        paid_at: row.paid_at,
        refunded_at: row.refunded_at
    };
}

async function createPaymentRequest(client, { bookingId, customerId, amount }) {
    const internalReference = `KS-${bookingId}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;

    const result = await client.query(
        `INSERT INTO payment_requests
            (booking_id, customer_id, amount, currency, provider, internal_reference, status)
         VALUES ($1, $2, $3, 'KES', 'PAYHERO', $4, $5)
         RETURNING *`,
        [bookingId, customerId, amount, internalReference, PAYMENT_STATUSES.PENDING]
    );

    return result.rows[0];
}

async function findPaymentRequestById(paymentRequestId) {
    const result = await db.query(
        "SELECT * FROM payment_requests WHERE payment_request_id = $1",
        [paymentRequestId]
    );

    return result.rows[0] || null;
}

async function findPaymentRequestByBookingId(bookingId) {
    const result = await db.query(
        "SELECT * FROM payment_requests WHERE booking_id = $1 ORDER BY payment_request_id DESC LIMIT 1",
        [bookingId]
    );

    return result.rows[0] || null;
}

async function findPaymentRequestByReference(reference) {
    if (!reference) {
        return null;
    }

    const result = await db.query(
        "SELECT * FROM payment_requests WHERE payhero_reference = $1 OR internal_reference = $1",
        [reference]
    );

    return result.rows[0] || null;
}

// The only safe way to change a payment request's status. Executes a
// single atomic UPDATE ... WHERE status NOT IN (terminal), optionally
// setting other columns (audit fields, failure_reason, etc.) in the same
// statement - so on a payment that's already terminal, ABSOLUTELY NOTHING
// about the row changes: not the status, and not any of the extra fields
// either, since the WHERE clause blocks the whole UPDATE from matching.
//
// This replaces the in-memory version's "check the JS object, then
// mutate it" approach with something that's actually safe under real
// concurrency - two server instances (or two requests in the same
// instance) racing to update the same row can no longer both succeed;
// Postgres serializes the two UPDATEs and the second one simply won't
// match any row once the first has already moved the status.
//
// `executor` is anything with a .query(text, params) method - either the
// pool (db) for a standalone call, or a transaction client when this
// needs to participate in a larger atomic operation (see
// markPaymentSuccessful below).
async function transitionPaymentStatus(executor, paymentRequestId, nextStatus, extraFields = {}) {
    const setClauses = ["status = $1", "updated_at = NOW()"];
    const values = [nextStatus];
    let paramIndex = 2;

    for (const [column, value] of Object.entries(extraFields)) {
        setClauses.push(`${column} = $${paramIndex}`);
        values.push(value);
        paramIndex += 1;
    }

    values.push(paymentRequestId);
    const idParamIndex = paramIndex;
    paramIndex += 1;

    let whereExtra;

    if (nextStatus === PAYMENT_STATUSES.REFUNDED) {
        // The one sanctioned exception to "terminal states never change":
        // an admin issuing a refund on a successfully paid payment.
        values.push(PAYMENT_STATUSES.SUCCESS);
        whereExtra = `status = $${paramIndex}`;
    } else {
        values.push(TERMINAL_PAYMENT_STATUSES);
        whereExtra = `status <> ALL($${paramIndex}::text[])`;
    }

    const result = await executor.query(
        `UPDATE payment_requests
         SET ${setClauses.join(", ")}
         WHERE payment_request_id = $${idParamIndex}
           AND ${whereExtra}
         RETURNING *`,
        values
    );

    if (result.rowCount === 0) {
        console.warn(
            `Blocked payment transition to ${nextStatus} for payment_request_id=${paymentRequestId}: already terminal.`
        );
    }

    return {
        changed: result.rowCount > 0,
        paymentRequest: result.rows[0] || null
    };
}

// Marks a payment SUCCESS and confirms the associated booking, atomically.
// Safe to call repeatedly - the guarded UPDATE inside is the only thing
// that decides whether anything happens.
async function markPaymentSuccessful(paymentRequestId, callbackFields = {}) {
    return db.withTransaction(async client => {
        const transition = await transitionPaymentStatus(
            client,
            paymentRequestId,
            PAYMENT_STATUSES.SUCCESS,
            {
                paid_at: new Date(),
                callback_data: callbackFields.callback_data ?? null,
                payhero_transaction_id: callbackFields.transactionId ?? null,
                checkout_request_id: callbackFields.checkoutRequestId ?? null,
                payhero_status: callbackFields.status ?? null,
                result_code: callbackFields.resultCode ?? null,
                result_description: callbackFields.resultDescription ?? null
            }
        );

        if (!transition.changed) {
            const current = await findPaymentRequestById(paymentRequestId);

            return {
                success: current?.status === PAYMENT_STATUSES.SUCCESS,
                alreadyProcessed: true,
                message: current
                    ? `Payment is already ${current.status}; success callback ignored.`
                    : "Payment request not found."
            };
        }

        const paymentRequest = transition.paymentRequest;

        const bookingResult = await client.query(
            `UPDATE bookings
             SET payment_status = 'paid', status = 'confirmed', updated_at = NOW()
             WHERE booking_id = $1
             RETURNING *`,
            [paymentRequest.booking_id]
        );

        const booking = bookingResult.rows[0];

        if (!booking) {
            return {
                success: false,
                alreadyProcessed: false,
                message: "Booking associated with payment was not found."
            };
        }

        await client.query(
            `INSERT INTO notifications (user_id, booking_id, title, message, type)
             VALUES ($1, $2, $3, $4, $5)`,
            [
                booking.customer_id,
                booking.booking_id,
                "Payment successful",
                `Payment for booking #${booking.booking_id} was successful.`,
                "payment_successful"
            ]
        );

        await client.query(
            `INSERT INTO notifications (user_id, booking_id, title, message, type)
             VALUES ($1, $2, $3, $4, $5)`,
            [
                booking.owner_id,
                booking.booking_id,
                "Booking confirmed",
                `Booking #${booking.booking_id} has been confirmed after successful payment.`,
                "booking_confirmed"
            ]
        );

        return {
            success: true,
            alreadyProcessed: false,
            booking,
            paymentRequest
        };
    });
}

// Normalizes a Pay Hero callback body to a consistent shape. Pay Hero's
// real M-Pesa payload names the receipt MpesaReceiptNumber (not
// TransactionID/transaction_id) - confirmed against their docs.
function normalizePayHeroCallback(callbackData) {
    const response = callbackData?.response || callbackData;

    if (!response || typeof response !== "object") {
        return null;
    }

    return {
        amount: Number(response.Amount),

        checkoutRequestId:
            response.CheckoutRequestID || response.checkout_request_id || null,

        externalReference:
            response.ExternalReference || response.external_reference || null,

        merchantRequestId:
            response.MerchantRequestID || response.merchant_request_id || null,

        resultCode: response.ResultCode ?? response.result_code ?? null,

        resultDescription:
            response.ResultDesc || response.result_desc || null,

        status: response.Status || response.status || null,

        transactionId:
            response.MpesaReceiptNumber ||
            response.mpesa_receipt_number ||
            response.TransactionID ||
            response.transaction_id ||
            null,

        phone: response.Phone || response.phone || null
    };
}

function validateSuccessfulPayHeroPayment(paymentRequest, normalizedCallback) {
    if (!paymentRequest) {
        return { valid: false, message: "Payment request not found." };
    }

    if (!normalizedCallback) {
        return { valid: false, message: "Invalid Pay Hero callback." };
    }

    if (
        normalizedCallback.externalReference &&
        normalizedCallback.externalReference !== paymentRequest.internal_reference
    ) {
        return { valid: false, message: "Payment reference does not match." };
    }

    if (
        Number.isFinite(normalizedCallback.amount) &&
        normalizedCallback.amount !== Number(paymentRequest.amount)
    ) {
        return { valid: false, message: "Payment amount does not match." };
    }

    const resultCode = Number(normalizedCallback.resultCode);

    const successful =
        resultCode === 0 ||
        String(normalizedCallback.status).toLowerCase() === "success";

    if (!successful) {
        return {
            valid: false,
            message:
                normalizedCallback.resultDescription ||
                "Pay Hero reported an unsuccessful payment."
        };
    }

    return { valid: true };
}

async function processPayHeroCallback(rawCallbackData) {
    const normalized = normalizePayHeroCallback(rawCallbackData);

    if (!normalized) {
        return {
            success: false,
            processed: false,
            message: "Invalid Pay Hero callback."
        };
    }

    const paymentRequest = await findPaymentRequestByReference(normalized.externalReference);

    if (!paymentRequest) {
        console.error("Pay Hero callback could not be matched:", normalized.externalReference);

        return {
            success: false,
            processed: false,
            message: "Payment request could not be matched."
        };
    }

    const validation = validateSuccessfulPayHeroPayment(paymentRequest, normalized);

    if (validation.valid) {
        const result = await markPaymentSuccessful(paymentRequest.payment_request_id, {
            callback_data: rawCallbackData,
            transactionId: normalized.transactionId,
            checkoutRequestId: normalized.checkoutRequestId,
            status: normalized.status,
            resultCode: normalized.resultCode,
            resultDescription: normalized.resultDescription
        });

        return {
            success: result.success,
            processed: !result.alreadyProcessed,
            alreadyProcessed: result.alreadyProcessed || false,
            message: result.message
        };
    }

    // Not a successful payment per this callback - try to move to FAILED,
    // writing the audit fields in the SAME atomic statement so a payment
    // that's already terminal has nothing at all overwritten (0 rows
    // affected means the status AND every descriptive field stay exactly
    // as they were when the transaction concluded).
    const transition = await transitionPaymentStatus(
        db,
        paymentRequest.payment_request_id,
        PAYMENT_STATUSES.FAILED,
        {
            callback_data: rawCallbackData,
            payhero_transaction_id: normalized.transactionId,
            checkout_request_id: normalized.checkoutRequestId,
            payhero_status: normalized.status,
            result_code: normalized.resultCode,
            result_description: normalized.resultDescription
        }
    );

    if (!transition.changed) {
        const current = await findPaymentRequestById(paymentRequest.payment_request_id);

        return {
            success: current?.status === PAYMENT_STATUSES.SUCCESS,
            processed: false,
            alreadyProcessed: true,
            message: `Payment is already ${current?.status}; callback acknowledged without further action.`
        };
    }

    return {
        success: false,
        processed: true,
        message: validation.message
    };
}

module.exports = {
    serializePaymentRequest,
    createPaymentRequest,
    findPaymentRequestById,
    findPaymentRequestByBookingId,
    findPaymentRequestByReference,
    transitionPaymentStatus,
    markPaymentSuccessful,
    normalizePayHeroCallback,
    validateSuccessfulPayHeroPayment,
    processPayHeroCallback
};
