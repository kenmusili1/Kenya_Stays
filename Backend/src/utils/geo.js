function calculateDistanceInKilometres(first, second) {
    const earthRadius = 6371;

    const latitudeDifference =
        (second.latitude - first.latitude) * Math.PI / 180;

    const longitudeDifference =
        (second.longitude - first.longitude) * Math.PI / 180;

    const firstLatitude = first.latitude * Math.PI / 180;
    const secondLatitude = second.latitude * Math.PI / 180;

    const haversine =
        Math.sin(latitudeDifference / 2) ** 2 +
        Math.cos(firstLatitude) *
        Math.cos(secondLatitude) *
        Math.sin(longitudeDifference / 2) ** 2;

    return earthRadius * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

const LOCATION_COORDINATES = {
    "westlands, nairobi": { latitude: -1.2676, longitude: 36.8108 },
    "kilimani, nairobi": { latitude: -1.2921, longitude: 36.7875 },
    "karen, nairobi": { latitude: -1.3197, longitude: 36.7073 },
    "nairobi": { latitude: -1.2864, longitude: 36.8172 },
    "mombasa": { latitude: -4.0435, longitude: 39.6682 }
};

module.exports = {
    calculateDistanceInKilometres,
    LOCATION_COORDINATES
};
