const express = require("express");
const path = require("path");
const db = require("../db");

const router = express.Router();

router.get("/status", (_req, res) => {
    res.json({ status: "online", service: "KenyaStays API", timestamp: new Date() });
});

router.get("/health", async (_req, res) => {
    try {
        await db.query("SELECT 1");
        return res.json({ status: "ok", database: "connected" });
    } catch (error) {
        console.error("Health check DB ping failed:", error.message);
        return res.status(503).json({ status: "degraded", database: "unreachable" });
    }
});

router.get("/accounts/roles", (_req, res) => {
    res.json({ success: true, roles: ["CUSTOMER", "OWNER", "ADMIN", "CUSTOMER CARE"] });
});

router.get("/counties", (_req, res) => {
    res.sendFile(path.resolve(__dirname, "..", "..", "..", "counties.json"));
});

module.exports = router;
