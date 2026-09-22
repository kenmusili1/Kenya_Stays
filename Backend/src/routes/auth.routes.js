const express = require("express");
const { asyncHandler } = require("../middleware/errorHandler");
const { authenticate } = require("../middleware/auth");
const { authLimiter } = require("../middleware/rateLimiters");
const { verifyPassword } = require("../utils/password");
const { signAccountToken } = require("../utils/jwt");
const {
    SELF_REGISTERABLE_ROLES,
    serializeAccount,
    createAccount,
    findAccountByEmail,
    findAccountById
} = require("../accounts/accountService");

const router = express.Router();

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post("/register", authLimiter, asyncHandler(async (req, res) => {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password || !role) {
        return res.status(400).json({
            success: false,
            message: "Name, email, password, and role are required."
        });
    }

    if (!EMAIL_PATTERN.test(String(email))) {
        return res.status(400).json({
            success: false,
            message: "Enter a valid email address."
        });
    }

    if (String(password).length < 8) {
        return res.status(400).json({
            success: false,
            message: "Password must be at least 8 characters."
        });
    }

    if (!SELF_REGISTERABLE_ROLES.includes(role)) {
        return res.status(400).json({
            success: false,
            message: `Role must be one of: ${SELF_REGISTERABLE_ROLES.join(", ")}.`
        });
    }

    const existing = await findAccountByEmail(email);

    if (existing) {
        return res.status(409).json({
            success: false,
            message: "An account with this email already exists."
        });
    }

    const account = await createAccount({
        name: String(name).trim(),
        email: String(email).trim(),
        password: String(password),
        role
    });

    const token = signAccountToken(account);

    return res.status(201).json({
        success: true,
        message:
            role === "OWNER"
                ? "Account created. An admin will review your owner account before your listings go live."
                : "Account created.",
        token,
        account: serializeAccount(account)
    });
}));

router.post("/login", authLimiter, asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({
            success: false,
            message: "Email and password are required."
        });
    }

    const account = await findAccountByEmail(email);

    // Deliberately identical response whether the email doesn't exist or
    // the password is wrong - don't help an attacker enumerate accounts.
    const invalidCredentialsResponse = () => res.status(401).json({
        success: false,
        message: "Invalid email or password."
    });

    if (!account) {
        return invalidCredentialsResponse();
    }

    const passwordMatches = await verifyPassword(password, account.password_hash);

    if (!passwordMatches) {
        return invalidCredentialsResponse();
    }

    if (account.status === "suspended") {
        return res.status(403).json({
            success: false,
            message: "This account has been suspended."
        });
    }

    const token = signAccountToken(account);

    return res.json({
        success: true,
        token,
        account: serializeAccount(account)
    });
}));

router.get("/me", authenticate, asyncHandler(async (req, res) => {
    const account = await findAccountById(req.user.account_id);

    return res.json({
        success: true,
        account: serializeAccount(account)
    });
}));

module.exports = router;
