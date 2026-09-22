const jwt = require("jsonwebtoken");
const config = require("../config");

function signAccountToken(account) {
    return jwt.sign(
        {
            account_id: account.account_id,
            role: account.role
        },
        config.jwtSecret,
        { expiresIn: config.jwtExpiresIn }
    );
}

// Returns the decoded payload, or null if the token is missing, expired,
// or invalid - callers treat null as "not authenticated", never as an
// error to propagate details of back to the client.
function verifyAccountToken(token) {
    try {
        return jwt.verify(token, config.jwtSecret);
    } catch (error) {
        return null;
    }
}

module.exports = {
    signAccountToken,
    verifyAccountToken
};
