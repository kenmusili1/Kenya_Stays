const rateLimit = require("express-rate-limit");
const config = require("../config");

function jsonRateLimitHandler(req, res) {
    return res.status(429).json({
        success: false,
        message: "Too many requests. Please slow down and try again shortly."
    });
}

const apiLimiter = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.max,
    standardHeaders: true,
    legacyHeaders: false,
    handler: jsonRateLimitHandler
});

// Tighter limit on login/register specifically - this is what actually
// matters for brute-force/credential-stuffing protection.
const authLimiter = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.authMax,
    standardHeaders: true,
    legacyHeaders: false,
    handler: jsonRateLimitHandler
});

// The Pay Hero callback is public by necessity. This blunts brute-force
// guessing of the shared-secret token without being tight enough to risk
// dropping a legitimate delivery/retry from Pay Hero itself.
const callbackLimiter = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    handler: jsonRateLimitHandler
});

module.exports = {
    apiLimiter,
    authLimiter,
    callbackLimiter
};
