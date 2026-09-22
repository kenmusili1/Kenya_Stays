require("dotenv").config();

const NODE_ENV = process.env.NODE_ENV || "development";
const isProduction = NODE_ENV === "production";

function required(name) {
    const value = process.env[name];

    if (!value) {
        throw new Error(`Missing required environment variable: ${name}`);
    }

    return value;
}

function optionalWithWarning(name, message) {
    const value = process.env[name];

    if (!value) {
        console.warn(message);
    }

    return value || null;
}

const corsAllowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || "")
    .split(",")
    .map(origin => origin.trim())
    .filter(Boolean);

const jwtSecret = required("JWT_SECRET");

const channelId = Number(process.env.PAYHERO_CHANNEL_ID);

if (!Number.isFinite(channelId)) {
    throw new Error(
        "PAYHERO_CHANNEL_ID is not configured (or is not a valid number)."
    );
}

const config = {
    nodeEnv: NODE_ENV,
    isProduction,

    port: Number(process.env.PORT) || 5000,

    databaseUrl: required("DATABASE_URL"),

    jwtSecret,
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",

    corsAllowedOrigins,

    rateLimit: {
        windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 60_000,
        max: Number(process.env.RATE_LIMIT_MAX) || 120,
        authMax: Number(process.env.AUTH_RATE_LIMIT_MAX) || 10
    },

    payhero: {
        baseUrl:
            process.env.PAYHERO_BASE_URL ||
            "https://backend.payhero.co.ke/api/v2",

        username: required("PAYHERO_API_USERNAME"),
        password: required("PAYHERO_API_PASSWORD"),
        channelId,

        callbackUrl: required("PAYHERO_CALLBACK_URL"),

        callbackToken: optionalWithWarning(
            "PAYHERO_CALLBACK_TOKEN",
            "PAYHERO_CALLBACK_TOKEN is not set. The Pay Hero callback endpoint " +
            "will accept requests from anyone who can guess a payment " +
            "reference - set PAYHERO_CALLBACK_TOKEN to a long random value " +
            "before going to production."
        ),

        requestTimeoutMs:
            Number(process.env.PAYHERO_REQUEST_TIMEOUT_MS) || 20000
    }
};

// Fail loudly at boot rather than silently misbehaving in production.
if (isProduction && config.corsAllowedOrigins.length === 0) {
    throw new Error(
        "CORS_ALLOWED_ORIGINS must be set in production - comma-separated " +
        "list of the exact origins (e.g. https://kenyastays.example) allowed " +
        "to call this API from a browser."
    );
}

if (isProduction && config.jwtSecret.length < 32) {
    throw new Error(
        "JWT_SECRET must be at least 32 characters in production. " +
        "Generate one with: node -e \"console.log(require('crypto').randomBytes(48).toString('hex'))\""
    );
}

if (isProduction && !config.payhero.callbackToken) {
    throw new Error(
        "PAYHERO_CALLBACK_TOKEN must be set in production - without it, " +
        "anyone who obtains a payment reference can forge a successful " +
        "payment callback."
    );
}

module.exports = config;
