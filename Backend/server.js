const express = require("express");
const cors = require("cors");
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

function isAdmin(request) {

    const body = request.body || {};
    return Number(request.query.admin_id || body.admin_id || request.params.adminId) === 3;

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
        amount: req.body.amount || null,
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
    booking.amount = req.body.amount || recommendedProperty?.total_amount || null;

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
            amount: booking.amount,
            status: "PENDING",
            created_at: now
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

app.post("/api/payments/:paymentRequestId/confirm", (req, res) => {

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
