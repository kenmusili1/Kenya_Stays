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

module.exports = {
    normalizeKenyanPhoneNumber
};
