function datesOverlap(checkIn, checkOut, unavailableDates) {
    return (unavailableDates || []).some(
        date => date >= checkIn && date < checkOut
    );
}

function calculateNights(checkIn, checkOut) {
    return Math.ceil(
        (new Date(`${checkOut}T00:00:00`) - new Date(`${checkIn}T00:00:00`)) / 86400000
    );
}

module.exports = {
    datesOverlap,
    calculateNights
};
