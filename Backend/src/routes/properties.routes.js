const express = require("express");
const { asyncHandler } = require("../middleware/errorHandler");
const { authenticate, requireRole } = require("../middleware/auth");
const {
    listAvailableApprovedProperties,
    findPropertyRecommendations
} = require("../properties/propertyService");
const { LOCATION_COORDINATES } = require("../utils/geo");
const db = require("../db");

const router = express.Router();

router.get("/", asyncHandler(async (_req, res) => {
    const properties = await listAvailableApprovedProperties();

    return res.json({ success: true, properties });
}));

// Owners list new properties here. New listings start unapproved - an
// admin has to approve them before they show up in search/recommendations.
router.post("/", authenticate, requireRole("OWNER", "ADMIN"), asyncHandler(async (req, res) => {
    const {
        name,
        location,
        city,
        latitude,
        longitude,
        nightly_rate: nightlyRate,
        max_guests: maxGuests,
        accommodation,
        owner_id: bodyOwnerId
    } = req.body;

    if (!name || !location || !city || !nightlyRate || !maxGuests || !accommodation) {
        return res.status(400).json({
            success: false,
            message: "Name, location, city, nightly rate, max guests, and accommodation type are required."
        });
    }

    let resolvedLatitude = Number(latitude);
    let resolvedLongitude = Number(longitude);

    if (!Number.isFinite(resolvedLatitude) || !Number.isFinite(resolvedLongitude)) {
        const coordinates = LOCATION_COORDINATES[String(location).trim().toLowerCase()];

        if (!coordinates) {
            return res.status(400).json({
                success: false,
                message: "Provide latitude/longitude, or use a recognized location name."
            });
        }

        resolvedLatitude = coordinates.latitude;
        resolvedLongitude = coordinates.longitude;
    }

    // Only an admin may list a property on someone else's behalf.
    const ownerId = req.user.role === "ADMIN" && bodyOwnerId
        ? Number(bodyOwnerId)
        : req.user.account_id;

    const result = await db.query(
        `INSERT INTO properties
            (owner_id, approved, name, location, city, latitude, longitude, nightly_rate, max_guests, accommodation)
         VALUES ($1, FALSE, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [
            ownerId,
            String(name).trim(),
            String(location).trim(),
            String(city).trim(),
            resolvedLatitude,
            resolvedLongitude,
            Number(nightlyRate),
            Number(maxGuests),
            String(accommodation).trim()
        ]
    );

    return res.status(201).json({
        success: true,
        message: "Property submitted. An admin will review it before it goes live.",
        property: result.rows[0]
    });
}));

router.post("/recommendations", asyncHandler(async (req, res) => {
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

    const result = await findPropertyRecommendations({
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
}));

module.exports = router;
