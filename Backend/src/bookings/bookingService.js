const db = require("../db");
const { datesOverlap, calculateNights } = require("../utils/dates");
const { findPropertyById } = require("../properties/propertyService");
const { createPaymentRequest, serializePaymentRequest } = require("../payments/paymentService");
const { createNotification } = require("../notifications/notificationService");

function serializeBooking(row) {
    if (!row) {
        return null;
    }

    return {
        booking_id: row.booking_id,
        customer_id: row.customer_id,
        property_id: row.property_id,
        owner_id: row.owner_id,
        location: row.location,
        check_in: row.check_in,
        check_out: row.check_out,
        guests: row.guests,
        accommodation: row.accommodation,
        amount: Number(row.amount),
        status: row.status,
        payment_status: row.payment_status,
        special_request: row.special_request,
        created_at: row.created_at,
        updated_at: row.updated_at
    };
}

// Returns { error: "..." } on validation failure, or { booking, paymentRequest }
// on success. customerId comes from the authenticated user, never the body.
async function createBooking({
    customerId,
    location,
    checkIn,
    checkOut,
    guests,
    accommodation,
    specialRequest = "",
    propertyId
}) {
    if (!location || !checkIn || !checkOut || !guests || !accommodation || !propertyId) {
        return {
            error: "Location, dates, guests, accommodation, and property are required."
        };
    }

    if (new Date(checkOut) <= new Date(checkIn)) {
        return { error: "Check-out must be after check-in." };
    }

    const guestCount = Number(guests);

    if (!Number.isInteger(guestCount) || guestCount < 1) {
        return { error: "Guests must be a whole number greater than zero." };
    }

    const property = await findPropertyById(Number(propertyId));

    if (!property || !property.approved || !property.available) {
        return { error: "The selected property is not available." };
    }

    if (property.max_guests < guestCount) {
        return { error: "The selected property cannot accommodate this number of guests." };
    }

    if (datesOverlap(checkIn, checkOut, property.unavailable_dates)) {
        return { error: "The selected property is not available for those dates.", status: 409 };
    }

    const nights = calculateNights(checkIn, checkOut);

    if (!Number.isInteger(nights) || nights <= 0) {
        return { error: "The selected stay dates are invalid." };
    }

    const amount = Number((nights * property.nightly_rate).toFixed(2));

    if (!Number.isFinite(amount) || amount <= 0) {
        return { error: "Unable to calculate the booking amount.", status: 500 };
    }

    return db.withTransaction(async client => {
        const bookingResult = await client.query(
            `INSERT INTO bookings
                (customer_id, property_id, owner_id, location, check_in, check_out,
                 guests, accommodation, amount, special_request)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             RETURNING *`,
            [
                customerId,
                property.property_id,
                property.owner_id,
                String(location).trim(),
                checkIn,
                checkOut,
                guestCount,
                accommodation,
                amount,
                String(specialRequest).trim()
            ]
        );

        const booking = bookingResult.rows[0];

        const paymentRequest = await createPaymentRequest(client, {
            bookingId: booking.booking_id,
            customerId,
            amount
        });

        await createNotification(client, {
            userId: property.owner_id,
            title: "New booking request",
            message: `A customer has requested your ${booking.accommodation.toLowerCase()} in ${booking.location}.`,
            type: "booking_request",
            bookingId: booking.booking_id
        });

        await createNotification(client, {
            userId: customerId,
            title: "Booking submitted",
            message: `Booking #${booking.booking_id} has been submitted. Please complete payment to confirm your reservation.`,
            type: "booking_submitted",
            bookingId: booking.booking_id
        });

        return {
            booking: serializeBooking(booking),
            paymentRequest: serializePaymentRequest(paymentRequest)
        };
    });
}

async function findBookingById(bookingId) {
    const result = await db.query(
        "SELECT * FROM bookings WHERE booking_id = $1",
        [bookingId]
    );

    return serializeBooking(result.rows[0]);
}

async function listBookingsForOwner(ownerId) {
    const result = await db.query(
        "SELECT * FROM bookings WHERE owner_id = $1 ORDER BY created_at DESC",
        [ownerId]
    );

    return result.rows.map(serializeBooking);
}

async function listBookingsForCustomer(customerId) {
    const result = await db.query(
        "SELECT * FROM bookings WHERE customer_id = $1 ORDER BY created_at DESC",
        [customerId]
    );

    return result.rows.map(serializeBooking);
}

async function decideOwnerBooking({ bookingId, ownerId, action }) {
    if (!["accept", "decline"].includes(action)) {
        return { error: "Action must be accept or decline." };
    }

    return db.withTransaction(async client => {
        const bookingResult = await client.query(
            `UPDATE bookings
             SET status = $3, updated_at = NOW()
             WHERE booking_id = $1 AND owner_id = $2
             RETURNING *`,
            [bookingId, ownerId, action === "accept" ? "accepted" : "declined"]
        );

        const booking = bookingResult.rows[0];

        if (!booking) {
            return { error: "Booking was not found for this owner.", status: 404 };
        }

        let notification = null;

        if (action === "accept") {
            notification = await createNotification(client, {
                userId: booking.customer_id,
                title: "Booking accepted",
                message: "Your accommodation request was accepted.",
                type: "booking_accepted",
                bookingId: booking.booking_id
            });
        }

        return { booking: serializeBooking(booking), notification };
    });
}

module.exports = {
    serializeBooking,
    createBooking,
    findBookingById,
    listBookingsForOwner,
    listBookingsForCustomer,
    decideOwnerBooking
};
