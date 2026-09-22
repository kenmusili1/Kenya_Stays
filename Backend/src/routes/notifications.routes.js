const express = require("express");
const { asyncHandler } = require("../middleware/errorHandler");
const { authenticate } = require("../middleware/auth");
const { listNotificationsForUser, markNotificationRead } = require("../notifications/notificationService");

const router = express.Router();

router.get("/", authenticate, asyncHandler(async (req, res) => {
    const userNotifications = await listNotificationsForUser(req.user.account_id);

    return res.json({
        success: true,
        unread_count: userNotifications.filter(n => !n.is_read).length,
        notifications: userNotifications
    });
}));

router.patch("/:notificationId/read", authenticate, asyncHandler(async (req, res) => {
    const notification = await markNotificationRead(
        Number(req.params.notificationId),
        req.user.account_id
    );

    if (!notification) {
        return res.status(404).json({ success: false, message: "Notification not found." });
    }

    return res.json({ success: true, notification });
}));

module.exports = router;
