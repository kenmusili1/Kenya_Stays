const { verifyAccountToken } = require("../utils/jwt");
const db = require("../db");

function extractToken(req) {
    const header = req.headers.authorization || "";
    const [scheme, token] = header.split(" ");

    if (scheme !== "Bearer" || !token) {
        return null;
    }

    return token;
}

// Requires a valid token. Attaches req.user = { account_id, role, status }
// (re-read from the DB, not just trusted from the token, so a suspended
// account is rejected immediately rather than on its next login).
async function authenticate(req, res, next) {
    const token = extractToken(req);
    const payload = token && verifyAccountToken(token);

    if (!payload) {
        return res.status(401).json({
            success: false,
            message: "Authentication required."
        });
    }

    try {
        const result = await db.query(
            "SELECT account_id, role, status FROM accounts WHERE account_id = $1",
            [payload.account_id]
        );

        const account = result.rows[0];

        if (!account) {
            return res.status(401).json({
                success: false,
                message: "Account no longer exists."
            });
        }

        if (account.status === "suspended") {
            return res.status(403).json({
                success: false,
                message: "This account has been suspended."
            });
        }

        req.user = account;
        return next();

    } catch (error) {
        console.error("Auth lookup failed:", error.message);

        return res.status(500).json({
            success: false,
            message: "Unable to authenticate request."
        });
    }
}

// Same as authenticate, but proceeds as an anonymous request instead of
// rejecting when no/invalid token is present. Used for endpoints like the
// customer-care contact form that work for both guests and logged-in
// customers.
async function optionalAuthenticate(req, res, next) {
    const token = extractToken(req);

    if (!token) {
        req.user = null;
        return next();
    }

    return authenticate(req, res, next);
}

// requireRole("ADMIN") or requireRole("OWNER", "ADMIN") etc. Must run
// after authenticate/optionalAuthenticate.
function requireRole(...allowedRoles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: "Authentication required."
            });
        }

        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: "You do not have permission to perform this action."
            });
        }

        return next();
    };
}

module.exports = {
    authenticate,
    optionalAuthenticate,
    requireRole
};
