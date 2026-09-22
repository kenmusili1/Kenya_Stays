const config = require("../config");

// Wrap an async route handler so a rejected promise is forwarded to
// next(err) instead of becoming an unhandled rejection that could crash
// the process. Every async route in this app is registered through this.
function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

// A malformed JSON body makes express.json() call next(err) with a
// SyntaxError. Without this, Express's default error handler would return
// an HTML page (and, outside production, a stack trace) instead of JSON.
function jsonParseErrorHandler(err, req, res, next) {
    if (err instanceof SyntaxError && "body" in err) {
        console.warn("Rejected malformed JSON body:", req.originalUrl);

        return res.status(400).json({
            success: false,
            message: "Malformed JSON in request body."
        });
    }

    return next(err);
}

function notFoundHandler(req, res) {
    return res.status(404).json({
        success: false,
        message: "Not found."
    });
}

// Last-resort handler for anything a route didn't handle itself. Never
// exposes the error's message or stack to the client - that goes to the
// server log only.
// eslint-disable-next-line no-unused-vars
function genericErrorHandler(err, req, res, next) {
    console.error("Unhandled error on", req.method, req.originalUrl, ":", err);

    if (res.headersSent) {
        return next(err);
    }

    return res.status(500).json({
        success: false,
        message: "Something went wrong. Please try again.",
        ...(config.isProduction ? {} : { debug: err.message })
    });
}

module.exports = {
    asyncHandler,
    jsonParseErrorHandler,
    notFoundHandler,
    genericErrorHandler
};
