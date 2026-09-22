const db = require("../db");
const { calculateDistanceInKilometres, LOCATION_COORDINATES } = require("../utils/geo");
const { datesOverlap, calculateNights } = require("../utils/dates");

function serializeProperty(row) {
    if (!row) {
        return null;
    }

    return {
        property_id: row.property_id,
        owner_id: row.owner_id,
        approved: row.approved,
        name: row.name,
        location: row.location,
        city: row.city,
        latitude: Number(row.latitude),
        longitude: Number(row.longitude),
        nightly_rate: Number(row.nightly_rate),
        max_guests: row.max_guests,
        accommodation: row.accommodation,
        available: row.available,
        unavailable_dates: row.unavailable_dates || []
    };
}

async function listAvailableApprovedProperties() {
    const result = await db.query(
        "SELECT * FROM properties WHERE approved = TRUE AND available = TRUE"
    );

    return result.rows.map(serializeProperty);
}

async function findPropertyById(propertyId) {
    const result = await db.query(
        "SELECT * FROM properties WHERE property_id = $1",
        [propertyId]
    );

    return serializeProperty(result.rows[0]);
}

async function findPropertyRecommendations({
    location,
    latitude,
    longitude,
    checkIn,
    checkOut,
    guests,
    maxPrice,
    accommodation
}) {
    const requestedCoordinates =
        latitude && longitude
            ? { latitude: Number(latitude), longitude: Number(longitude) }
            : LOCATION_COORDINATES[String(location).trim().toLowerCase()];

    if (!requestedCoordinates) {
        return { requestedCoordinates: null, recommendations: [] };
    }

    const properties = await listAvailableApprovedProperties();

    const recommendations = properties
        .filter(property => property.max_guests >= guests)
        .filter(property => !maxPrice || property.nightly_rate <= Number(maxPrice))
        .filter(property => !accommodation || property.accommodation === accommodation)
        .filter(property => !datesOverlap(checkIn, checkOut, property.unavailable_dates))
        .map(property => ({
            ...property,
            distance_km: Number(
                calculateDistanceInKilometres(requestedCoordinates, property).toFixed(1)
            ),
            total_amount: Number(
                (calculateNights(checkIn, checkOut) * property.nightly_rate).toFixed(2)
            )
        }))
        .sort(
            (first, second) =>
                first.distance_km - second.distance_km ||
                first.nightly_rate - second.nightly_rate
        );

    return { requestedCoordinates, recommendations };
}

module.exports = {
    serializeProperty,
    listAvailableApprovedProperties,
    findPropertyById,
    findPropertyRecommendations
};
