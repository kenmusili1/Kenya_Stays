const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const path = require("path");

const config = require("./config");
const { apiLimiter } = require("./middleware/rateLimiters");
const { jsonParseErrorHandler, notFoundHandler, genericErrorHandler } = require("./middleware/errorHandler");

const authRoutes = require("./routes/auth.routes");
const propertiesRoutes = require("./routes/properties.routes");
const { router: bookingsRoutes } = require("./routes/bookings.routes");
const paymentsRoutes = require("./routes/payments.routes");
const ownersRoutes = require("./routes/owners.routes");
const adminRoutes = require("./routes/admin.routes");
const notificationsRoutes = require("./routes/notifications.routes");
const customerCareRoutes = require("./routes/customerCare.routes");
const miscRoutes = require("./routes/misc.routes");

const app = express();

app.set("trust proxy", 1); // Render sits behind a proxy; needed for correct req.ip in rate limiting/logging

app.use(helmet());

// No wildcard CORS - only the exact origins operators configured are
// allowed to call this API from a browser. In development, with nothing
// configured, everything is allowed for convenience.
app.use(cors({
    origin: config.corsAllowedOrigins.length > 0 ? config.corsAllowedOrigins : true,
    credentials: true
}));

app.use(express.json());
app.use(jsonParseErrorHandler);

app.use("/api/", apiLimiter);

app.use("/api/auth", authRoutes);
app.use("/api/properties", propertiesRoutes);
app.use("/api/bookings", bookingsRoutes);
app.use("/api/payments", paymentsRoutes);
app.use("/api/owners", ownersRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/notifications", notificationsRoutes);
app.use("/api/customer-care/messages", customerCareRoutes);
app.use("/api", miscRoutes);

app.use("/api", notFoundHandler);

// Static frontend, served from the repo root (one level up from Backend/).
const projectRoot = path.resolve(__dirname, "..", "..");

app.use(express.static(projectRoot));

app.get("/admin", (_req, res) => {
    res.sendFile(path.join(projectRoot, "index.html"));
});

app.get("/{*splat}", (_req, res) => {
    res.sendFile(path.join(projectRoot, "index.html"));
});

app.use(genericErrorHandler);

module.exports = app;
