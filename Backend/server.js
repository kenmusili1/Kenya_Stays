


const express = require("express");
const cors = require("cors");
require("dotenv").config();

const {
    payHeroRequest,
    initiateMpesaStkPush
} = require("./services/payhero");


validatePayHeroConfiguration();

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


const customerCareMessages = [];
const customerCareStatuses = [
    "NEW",
    "OPEN",
    "IN_PROGRESS",
    "WAITING_FOR_CUSTOMER",
    "RESOLVED",
    "CLOSED"
];
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



function updatePaymentStatus(paymentRequest, status) {
    if (!paymentRequest) {
        return false;
    }

    paymentRequest.status = status;
    paymentRequest.updated_at = new Date();

    return true;
}


function createPaymentRequest({
    booking,
    amount
}) {

    const now =
        new Date();

    const paymentRequestId =
        paymentRequests.length + 1;

    const internalReference =
        `KS-${booking.booking_id}-${Date.now()}-${paymentRequestId}`;

    const paymentRequest = {
        payment_request_id:
            paymentRequestId,

        booking_id:
            booking.booking_id,

        customer_id:
            booking.customer_id,

        amount:
            Number(amount),

        currency:
            "KES",

        method:
            null,

        provider:
            "PAYHERO",

        internal_reference:
            internalReference,

        payhero_reference:
            null,

        checkout_request_id:
            null,

        payhero_transaction_id:
            null,

        status:
            PAYMENT_STATUSES.PENDING,

        phone_number:
            null,

        callback_data:
            null,

        payhero_status:
            null,

        result_code:
            null,

        result_description:
            null,

        created_at:
            now,

        updated_at:
            now
    };

    paymentRequests.push(
        paymentRequest
    );

    return paymentRequest;
}


function markPaymentSuccessful(
    paymentRequest
) {

    if (!paymentRequest) {

        return {
            success: false,
            message:
                "Payment request not found."
        };
    }

    if (
        paymentRequest.status ===
        PAYMENT_STATUSES.SUCCESS
    ) {

        return {
            success: true,
            alreadyProcessed: true,
            message:
                "Payment was already processed."
        };
    }

    const booking =
        bookings.find(
            item =>
                item.booking_id ===
                paymentRequest.booking_id
        );

    if (!booking) {

        return {
            success: false,
            message:
                "Booking associated with payment was not found."
        };
    }

    const now =
        new Date();

    paymentRequest.status =
        PAYMENT_STATUSES.SUCCESS;

    paymentRequest.paid_at =
        now;

    paymentRequest.updated_at =
        now;

    booking.payment_status =
        "paid";

    booking.status =
        "confirmed";

    booking.updated_at =
        now;

    createNotification({

        userId:
            booking.customer_id,

        title:
            "Payment successful",

        message:
            `Payment for booking #${booking.booking_id} was successful.`,

        type:
            "payment_successful",

        bookingId:
            booking.booking_id
    });

    createNotification({

        userId:
            booking.owner_id,

        title:
            "Booking confirmed",

        message:
            `Booking #${booking.booking_id} has been confirmed after successful payment.`,

        type:
            "booking_confirmed",

        bookingId:
            booking.booking_id
    });

    return {
        success: true,
        alreadyProcessed: false,
        booking,
        paymentRequest
    };
}

function findPaymentRequestByBookingId(bookingId) {
    return paymentRequests.find(
        paymentRequest =>
            paymentRequest.booking_id ===
            Number(bookingId)
    );
}


function isAdmin(request) {

    const body = request.body || {};
    return Number(request.query.admin_id || body.admin_id || request.params.adminId) === 3;

}
// Pay Hero configuration check
function validatePayHeroConfiguration() {
    const required = [
        "PAYHERO_API_USERNAME",
        "PAYHERO_API_PASSWORD",
        "PAYHERO_CALLBACK_URL"
    ];

    const missing = required.filter(
        name => !process.env[name]
    );

    if (missing.length > 0) {
        console.warn(
            `Missing Pay Hero configuration: ${missing.join(", ")}`
        );

        return false;
    }

    console.log(
        "Pay Hero configuration loaded."
    );

    return true;
}

// Phone number normalization for Kenyan M-Pesa format
function normalizeKenyanPhoneNumber(phoneNumber) {
    const cleaned = String(phoneNumber || "")
        .trim()
        .replace(/\s+/g, "")
        .replace(/-/g, "");

    if (!cleaned) {
        return null;
    }

    if (/^07\d{8}$/.test(cleaned)) {
        return `254${cleaned.slice(1)}`;
    }

    if (/^7\d{8}$/.test(cleaned)) {
        return `254${cleaned}`;
    }

    if (/^2547\d{8}$/.test(cleaned)) {
        return cleaned;
    }

    if (/^\+2547\d{8}$/.test(cleaned)) {
        return cleaned.slice(1);
    }

    return null;
}




// Normalize Pay Hero callback data to a consistent format
function normalizePayHeroCallback(callbackData) {
    const response = callbackData?.response || callbackData;

    if (!response || typeof response !== "object") {
        return null;
    }

    return {
        amount: Number(response.Amount),
        checkoutRequestId:
            response.CheckoutRequestID ||
            response.checkout_request_id ||
            null,

        externalReference:
            response.ExternalReference ||
            response.external_reference ||
            null,

        merchantRequestId:
            response.MerchantRequestID ||
            response.merchant_request_id ||
            null,

        resultCode:
            response.ResultCode ??
            response.result_code ??
            null,

        resultDescription:
            response.ResultDesc ||
            response.result_desc ||
            null,

        status:
            response.Status ||
            response.status ||
            null,

        transactionId:
            response.TransactionID ||
            response.transaction_id ||
            null
    };
}

// Find a payment request by its internal or Pay Hero reference
function findPaymentRequestByReference(reference) {
    if (!reference) {
        return null;
    }

    return paymentRequests.find(
        paymentRequest =>
            paymentRequest.payhero_reference === reference ||
            paymentRequest.internal_reference === reference
    );
}

// Validate that a Pay Hero payment was successful and matches the expected payment request
function validateSuccessfulPayHeroPayment(
    paymentRequest,
    normalizedCallback
) {
    if (!paymentRequest) {
        return {
            valid: false,
            message: "Payment request not found."
        };
    }

    if (!normalizedCallback) {
        return {
            valid: false,
            message: "Invalid Pay Hero callback."
        };
    }

    if (
        normalizedCallback.externalReference &&
        normalizedCallback.externalReference !==
            paymentRequest.internal_reference
    ) {
        return {
            valid: false,
            message: "Payment reference does not match."
        };
    }

    if (
        Number.isFinite(normalizedCallback.amount) &&
        normalizedCallback.amount !== Number(paymentRequest.amount)
    ) {
        return {
            valid: false,
            message: "Payment amount does not match."
        };
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

    return {
        valid: true
    };
}


function processPayHeroCallback(
    callbackData
) {

    const normalized =
        normalizePayHeroCallback(
            callbackData
        );

    if (!normalized) {

        return {
            success: false,
            processed: false,
            message:
                "Invalid Pay Hero callback."
        };
    }

    const paymentRequest =
        findPaymentRequestByReference(
            normalized.externalReference
        );

    if (!paymentRequest) {

        console.error(
            "Pay Hero callback could not be matched:",
            normalized.externalReference
        );

        return {
            success: false,
            processed: false,
            message:
                "Payment request could not be matched."
        };
    }

    paymentRequest.callback_data =
        callbackData;

    paymentRequest.updated_at =
        new Date();

    paymentRequest.payhero_transaction_id =
        normalized.transactionId;

    paymentRequest.checkout_request_id =
        normalized.checkoutRequestId ||
        paymentRequest.checkout_request_id;

    paymentRequest.payhero_status =
        normalized.status ||
        null;

    paymentRequest.result_code =
        normalized.resultCode;

    paymentRequest.result_description =
        normalized.resultDescription;

    if (
        paymentRequest.status ===
        PAYMENT_STATUSES.SUCCESS
    ) {

        return {
            success: true,
            processed: false,
            alreadyProcessed: true,
            message:
                "Payment callback was already processed."
        };
    }

    const validation =
        validateSuccessfulPayHeroPayment(
            paymentRequest,
            normalized
        );

    if (!validation.valid) {

        paymentRequest.status =
            PAYMENT_STATUSES.FAILED;

        paymentRequest.updated_at =
            new Date();

        return {
            success: false,
            processed: false,
            message:
                validation.message
        };
    }

    const result =
        markPaymentSuccessful(
            paymentRequest
        );

    return {

        success:
            result.success,

        processed:
            !result.alreadyProcessed,

        alreadyProcessed:
            result.alreadyProcessed ||
            false,

        message:
            result.message
    };
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
        specialRequest = "",
        property_id
    } = req.body;


    /* ================= BASIC VALIDATION ================= */

    if (
        !location ||
        !checkIn ||
        !checkOut ||
        !guests ||
        !accommodation ||
        !property_id
    ) {
        return res.status(400).json({
            success: false,
            message:
                "Location, dates, guests, accommodation, and property are required."
        });
    }


    if (
        new Date(checkOut) <=
        new Date(checkIn)
    ) {
        return res.status(400).json({
            success: false,
            message:
                "Check-out must be after check-in."
        });
    }


    const guestCount =
        Number(guests);


    if (
        !Number.isInteger(guestCount) ||
        guestCount < 1
    ) {
        return res.status(400).json({
            success: false,
            message:
                "Guests must be a whole number greater than zero."
        });
    }


    /* ================= PROPERTY VALIDATION ================= */

    const selectedProperty =
        properties.find(
            property =>
                property.property_id ===
                    Number(property_id) &&
                property.approved === true &&
                property.available === true
        );


    if (!selectedProperty) {
        return res.status(400).json({
            success: false,
            message:
                "The selected property is not available."
        });
    }


    if (
        selectedProperty.max_guests <
        guestCount
    ) {
        return res.status(400).json({
            success: false,
            message:
                "The selected property cannot accommodate this number of guests."
        });
    }


    if (
        datesOverlap(
            checkIn,
            checkOut,
            selectedProperty.unavailable_dates
        )
    ) {
        return res.status(409).json({
            success: false,
            message:
                "The selected property is not available for those dates."
        });
    }


    /* ================= SERVER-SIDE PRICE ================= */

    const nights =
        calculateNights(
            checkIn,
            checkOut
        );


    if (!Number.isInteger(nights) || nights <= 0) {
        return res.status(400).json({
            success: false,
            message:
                "The selected stay dates are invalid."
        });
    }


    const calculatedAmount =
        Number(
            (
                nights *
                Number(selectedProperty.nightly_rate)
            ).toFixed(2)
        );


    if (
        !Number.isFinite(calculatedAmount) ||
        calculatedAmount <= 0
    ) {
        return res.status(500).json({
            success: false,
            message:
                "Unable to calculate the booking amount."
        });
    }


    /* ================= CREATE BOOKING ================= */

    const now = new Date();

    const booking = {
        booking_id:
            bookings.length + 1,

        customer_id:
            req.body.customer_id || null,

        property_id:
            selectedProperty.property_id,

        owner_id:
            selectedProperty.owner_id,

        location:
            String(location).trim(),

        check_in:
            checkIn,

        check_out:
            checkOut,

        guests:
            guestCount,

        accommodation:
            accommodation,

        amount:
            calculatedAmount,

        status:
            "pending",

        payment_status:
            "pending",

        special_request:
            String(specialRequest).trim(),

        created_at:
            now,

        updated_at:
            now
    };


    bookings.push(booking);


    /* ================= PAYMENT REQUEST ================= */

    const paymentRequest =
        createPaymentRequest({
            booking,
            amount:booking.amount
        });


    /* ================= OWNER NOTIFICATION ================= */

    const ownerNotification =
        booking.owner_id
            ? createNotification({
                userId:
                    booking.owner_id,

                title:
                    "New booking request",

                message:
                    `A customer has requested your ${booking.accommodation.toLowerCase()} in ${booking.location}.`,

                type:
                    "booking_request",

                bookingId:
                    booking.booking_id
            })
            : null;


    /* ================= CUSTOMER NOTIFICATION ================= */

    createNotification({
        userId:
            booking.customer_id,

        title:
            "Booking submitted",

        message:
            `Booking #${booking.booking_id} has been submitted. Please complete payment to confirm your reservation.`,

        type:
            "booking_submitted",

        bookingId:
            booking.booking_id
    });


    /* ================= RESPONSE ================= */

    return res.status(201).json({
        success: true,

        message:
            "Booking submitted. Please complete payment.",

        booking,

        payment_request: {
            payment_request_id:
                paymentRequest.payment_request_id,

            booking_id:
                paymentRequest.booking_id,

            amount:
                paymentRequest.amount,

            currency:
                paymentRequest.currency,

            provider:
                paymentRequest.provider,

            method:
                paymentRequest.method,

            status:
                paymentRequest.status,

            reference:
                paymentRequest.internal_reference
        },

        recommendations:
            findPropertyRecommendations({
                location,
                checkIn,
                checkOut,
                guests: guestCount,
                accommodation
            }).recommendations,

        notification:
            ownerNotification
    });

});



app.post(
    "/api/payments/payhero/callback",
    async (req, res) => {

        try {

            const result =
                processPayHeroCallback(
                    req.body
                );

            return res.status(200).json(
                result
            );

        } catch (error) {

            console.error(
                "Pay Hero callback processing error:",
                error.message
            );

            return res.status(500).json({
                success: false,
                message:
                    "Callback processing failed."
            });
        }
    }
);


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

        booking.updated_at =
            new Date();

        createNotification({

            userId:
                booking.customer_id,

            title:
                "Booking accepted",

            message:
                "Your accommodation request was accepted.",

            type:
                "booking_accepted",

            bookingId:
                booking.booking_id
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

app.post(
    "/api/payments/:paymentRequestId/confirm",
    (_req, res) => {

        return res.status(410).json({
            success: false,

            message:
                "Direct payment confirmation is disabled. Payments must be confirmed by Pay Hero callback verification."
        });

    }
);


app.get(
    "/api/bookings/:bookingId/payment",
    (req, res) => {

        const bookingId =
            Number(req.params.bookingId);


        if (
            !Number.isInteger(bookingId) ||
            bookingId <= 0
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Invalid booking ID."
            });
        }


        const booking =
            bookings.find(
                item =>
                    item.booking_id ===
                    bookingId
            );


        if (!booking) {
            return res.status(404).json({
                success: false,
                message:
                    "Booking not found."
            });
        }


        const paymentRequest =
            findPaymentRequestByBookingId(
                bookingId
            );


        if (!paymentRequest) {
            return res.status(404).json({
                success: false,
                message:
                    "No payment request exists for this booking."
            });
        }


        return res.json({
            success: true,

            payment: {
                payment_request_id:
                    paymentRequest.payment_request_id,

                booking_id:
                    paymentRequest.booking_id,

                amount:
                    paymentRequest.amount,

                currency:
                    paymentRequest.currency,

                provider:
                    paymentRequest.provider,

                method:
                    paymentRequest.method,

                status:
                    paymentRequest.status,

                reference:
                    paymentRequest.internal_reference,

                payhero_reference:
                    paymentRequest.payhero_reference,

                checkout_request_id:
                    paymentRequest.checkout_request_id,

                transaction_id:
                    paymentRequest.payhero_transaction_id,

                result_description:
                    paymentRequest.result_description,

                created_at:
                    paymentRequest.created_at,

                updated_at:
                    paymentRequest.updated_at,

                paid_at:
                    paymentRequest.paid_at
            }
        });

    }
);


app.get(
    "/api/payments/:paymentRequestId",
    (req, res) => {

        const paymentRequestId =
            Number(
                req.params.paymentRequestId
            );


        if (
            !Number.isInteger(
                paymentRequestId
            ) ||
            paymentRequestId <= 0
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Invalid payment request ID."
            });
        }


        const paymentRequest =
            paymentRequests.find(
                item =>
                    item.payment_request_id ===
                    paymentRequestId
            );


        if (!paymentRequest) {
            return res.status(404).json({
                success: false,
                message:
                    "Payment request not found."
            });
        }


        return res.json({
            success: true,

            payment: {
                payment_request_id:
                    paymentRequest.payment_request_id,

                booking_id:
                    paymentRequest.booking_id,

                amount:
                    paymentRequest.amount,

                currency:
                    paymentRequest.currency,

                provider:
                    paymentRequest.provider,

                method:
                    paymentRequest.method,

                status:
                    paymentRequest.status,

                reference:
                    paymentRequest.internal_reference,

                payhero_reference:
                    paymentRequest.payhero_reference,

                checkout_request_id:
                    paymentRequest.checkout_request_id,

                transaction_id:
                    paymentRequest.payhero_transaction_id,

                result_description:
                    paymentRequest.result_description,

                created_at:
                    paymentRequest.created_at,

                updated_at:
                    paymentRequest.updated_at,

                paid_at:
                    paymentRequest.paid_at
            }
        });

    }
);



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

// Process Pay Hero callback and update payment request and booking status
function processPayHeroCallback(callbackData) {
    const normalized = normalizePayHeroCallback(callbackData);

    if (!normalized) {
        return {
            success: false,
            processed: false,
            message: "Invalid Pay Hero callback."
        };
    }

    const paymentRequest =
        findPaymentRequestByReference(
            normalized.externalReference
        );

    if (!paymentRequest) {
        console.error(
            "Pay Hero callback could not be matched:",
            normalized.externalReference
        );

        return {
            success: false,
            processed: false,
            message: "Payment request could not be matched."
        };
    }

    paymentRequest.callback_data = callbackData;
    paymentRequest.updated_at = new Date();

    paymentRequest.payhero_transaction_id =
        normalized.transactionId;

    paymentRequest.checkout_request_id =
        normalized.checkoutRequestId ||
        paymentRequest.checkout_request_id;

    paymentRequest.payhero_status =
        normalized.status || null;

    paymentRequest.result_code =
        normalized.resultCode;

    paymentRequest.result_description =
        normalized.resultDescription;

    const validation =
        validateSuccessfulPayHeroPayment(
            paymentRequest,
            normalized
        );

    if (!validation.valid) {
        paymentRequest.status =
            PAYMENT_STATUSES.FAILED;

        paymentRequest.updated_at = new Date();

        return {
            success: false,
            processed: false,
            message: validation.message
        };
    }

    const result =
        markPaymentSuccessful(paymentRequest);

    return {
        success: result.success,
        processed: !result.alreadyProcessed,
        alreadyProcessed:
            result.alreadyProcessed || false,
        message: result.message
    };
}

// Payment initiation endpoint
app.post(
    "/api/payments/:paymentRequestId/stk-push",
    async (req, res) => {
        try {
            const paymentRequestId =
                Number(
                    req.params.paymentRequestId
                );

            const paymentRequest =
                paymentRequests.find(
                    payment =>
                        payment.payment_request_id ===
                        paymentRequestId
                );

            if (!paymentRequest) {
                return res.status(404).json({
                    success: false,
                    message:
                        "Payment request not found."
                });
            }


            if (
                paymentRequest.status !==
                PAYMENT_STATUSES.PENDING
            ) {
                return res.status(409).json({
                    success: false,
                    message:
                        `Payment cannot be initiated from ${paymentRequest.status} status.`
                });
            }


            const phoneNumber =
                normalizeKenyanPhoneNumber(
                    req.body.phoneNumber??
                    req.body.phone_number
                );

            if (!phoneNumber) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Enter a valid Kenyan M-Pesa phone number."
                });
            }


            if (
                !paymentRequest.amount ||
                Number(paymentRequest.amount) <= 0
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Invalid payment amount."
                });
            }


            paymentRequest.provider =
                "PAYHERO";

            paymentRequest.method =
                "MPESA";

            paymentRequest.phone_number =
                phoneNumber;

            paymentRequest.status =
                PAYMENT_STATUSES.PROCESSING;

            paymentRequest.updated_at =
                new Date();


            const customer =
                accounts.find(
                    account =>
                        account.id ===
                        paymentRequest.customer_id
                );


            const customerName =
                customer?.name ||
                customer?.full_name ||
                undefined;


            const payHeroResponse =
                await initiateMpesaStkPush({
                    amount:
                        paymentRequest.amount,

                    phoneNumber,

                    reference:
                        paymentRequest.internal_reference,

                    customerName,

                    callbackUrl:
                        process.env
                            .PAYHERO_CALLBACK_URL
                });


            /*
             * Pay Hero accepted the STK request.
             *
             * This is NOT payment success.
             */

            if (
                !payHeroResponse ||
                payHeroResponse.success !== true
            ) {
                throw new Error(
                    "Pay Hero did not accept the STK request."
                );
            }


            paymentRequest.status =
                PAYMENT_STATUSES.STK_INITIATED;


            paymentRequest.payhero_reference =
                payHeroResponse.reference ||
                null;


            paymentRequest.checkout_request_id =
                payHeroResponse.CheckoutRequestID ||
                null;


            paymentRequest.payhero_status =
                payHeroResponse.status ||
                null;


            paymentRequest.payhero_response =
                payHeroResponse;


            paymentRequest.updated_at =
                new Date();


            return res.status(202).json({
                success: true,

                message:
                    "M-Pesa payment request initiated. Check your phone and enter your M-Pesa PIN.",

                payment: {
                    payment_request_id:
                        paymentRequest.payment_request_id,

                    amount:
                        paymentRequest.amount,

                    currency:
                        paymentRequest.currency,

                    status:
                        paymentRequest.status,

                    reference:
                        paymentRequest.internal_reference,

                    checkout_request_id:
                        paymentRequest.checkout_request_id
                }
            });

        } catch (error) {
            console.error(
                "Pay Hero STK Push error:",
                error
            );


            const paymentRequest =
                paymentRequests.find(
                    payment =>
                        payment.payment_request_id ===
                        Number(
                            req.params.paymentRequestId
                        )
                );


            if (paymentRequest) {
                paymentRequest.status =
                    PAYMENT_STATUSES.FAILED;

                paymentRequest.failure_reason =
                    error.message;

                paymentRequest.updated_at =
                    new Date();
            }


            return res.status(502).json({
                success: false,

                message:
                    "Unable to initiate the M-Pesa payment."
            });
        }
    }
);

// Callback endpoint
app.post("/api/payments/payhero/callback", async (req, res) => {
    try {
        console.log("========== PAY HERO CALLBACK ==========");
        console.log(JSON.stringify(req.body, null, 2));
        console.log("========================================");

        const result =
            processPayHeroCallback(req.body);

        return res.status(200).json(result);

    } catch (error) {
        console.error(
            "Pay Hero callback processing error:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Callback processing failed."
        });
    }
});


//payment status endpoint
app.get(
    "/api/payments/:paymentRequestId",
    (req, res) => {
        const paymentRequestId =
            Number(req.params.paymentRequestId);

        const paymentRequest =
            paymentRequests.find(
                item =>
                    item.payment_request_id ===
                    paymentRequestId
            );

        if (!paymentRequest) {
            return res.status(404).json({
                success: false,
                message: "Payment request not found."
            });
        }

        return res.json({
            success: true,
            payment: {
                payment_request_id:
                    paymentRequest.payment_request_id,

                booking_id:
                    paymentRequest.booking_id,

                amount:
                    paymentRequest.amount,

                currency:
                    paymentRequest.currency,

                status:
                    paymentRequest.status,

                provider:
                    paymentRequest.provider,

                method:
                    paymentRequest.method,

                reference:
                    paymentRequest.internal_reference,

                payhero_reference:
                    paymentRequest.payhero_reference,

                checkout_request_id:
                    paymentRequest.checkout_request_id,

                transaction_id:
                    paymentRequest.payhero_transaction_id,

                result_description:
                    paymentRequest.result_description,

                created_at:
                    paymentRequest.created_at,

                updated_at:
                    paymentRequest.updated_at
            }
        });
    }
);

app.patch("/api/admin/payments/:paymentRequestId/refund", (req, res) => {

    if (!isAdmin(req)) {
        return res.status(403).json({ success: false, message: "Admin access is required." });
    }

    const paymentRequest = paymentRequests.find(item => item.payment_request_id === Number(req.params.paymentRequestId));

    if (
    !paymentRequest ||
    paymentRequest.status !== PAYMENT_STATUSES.SUCCESS
) {
    return res.status(400).json({
        success: false,
        message: "Only successful payments can be refunded."
    });
}

    const booking = bookings.find(item => item.booking_id === paymentRequest.booking_id);
    paymentRequest.status = PAYMENT_STATUSES.CANCELED;
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
