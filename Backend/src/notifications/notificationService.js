const db = require("../db");

async function createNotification(executor, { userId, title, message, type, bookingId = null }) {
    const result = await executor.query(
        `INSERT INTO notifications (user_id, booking_id, title, message, type)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [userId, bookingId, title, message, type]
    );

    return result.rows[0];
}

async function listNotificationsForUser(userId) {
    const result = await db.query(
        "SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC",
        [userId]
    );

    return result.rows;
}

async function markNotificationRead(notificationId, userId) {
    const result = await db.query(
        `UPDATE notifications
         SET is_read = TRUE
         WHERE notification_id = $1 AND user_id = $2
         RETURNING *`,
        [notificationId, userId]
    );

    return result.rows[0] || null;
}

module.exports = {
    createNotification,
    listNotificationsForUser,
    markNotificationRead
};
