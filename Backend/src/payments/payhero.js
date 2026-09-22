const config = require("../config");

function getAuthorizationHeader() {
    const credentials = Buffer.from(
        `${config.payhero.username}:${config.payhero.password}`
    ).toString("base64");

    return `Basic ${credentials}`;
}

async function payHeroRequest(endpoint, options = {}) {
    const url = `${config.payhero.baseUrl}${endpoint}`;

    const controller = new AbortController();
    const timeout = setTimeout(
        () => controller.abort(),
        config.payhero.requestTimeoutMs
    );

    let response;

    try {
        response = await fetch(url, {
            ...options,
            signal: controller.signal,
            headers: {
                Authorization: getAuthorizationHeader(),
                "Content-Type": "application/json",
                ...(options.headers || {})
            }
        });
    } catch (error) {
        if (error.name === "AbortError") {
            const timeoutError = new Error(
                `Pay Hero did not respond within ${config.payhero.requestTimeoutMs}ms.`
            );

            timeoutError.code = "PAYHERO_TIMEOUT";
            timeoutError.url = url;

            throw timeoutError;
        }

        const networkError = new Error(
            `Unable to reach Pay Hero: ${error.message}`
        );

        networkError.code = error.cause?.code || null;
        networkError.cause = error.cause || null;
        networkError.url = url;

        console.error("Pay Hero network error:", {
            message: error.message,
            code: error.cause?.code,
            cause: error.cause?.message,
            url
        });

        throw networkError;
    } finally {
        clearTimeout(timeout);
    }

    const contentType = response.headers.get("content-type") || "";

    const data = contentType.includes("application/json")
        ? await response.json()
        : await response.text();

    if (!response.ok) {
        const error = new Error(
            `Pay Hero request failed with status ${response.status}`
        );

        error.status = response.status;
        error.providerResponse = data;

        throw error;
    }

    return data;
}

async function initiateMpesaStkPush({
    amount,
    phoneNumber,
    reference,
    customerName,
    callbackUrl
}) {
    const payload = {
        amount: Math.round(Number(amount)),
        phone_number: phoneNumber,
        channel_id: config.payhero.channelId,
        provider: "m-pesa",
        external_reference: reference
    };

    if (customerName) {
        payload.customer_name = customerName;
    }

    if (callbackUrl) {
        payload.callback_url = callbackUrl;
    }

    return payHeroRequest("/payments", {
        method: "POST",
        body: JSON.stringify(payload)
    });
}

// Builds the callback URL handed to Pay Hero, embedding the shared-secret
// token as a query parameter (Pay Hero has no HMAC/signature verification
// on its own, unlike Paystack/PayPal webhooks - this is the practical
// mitigation against a forged callback).
function buildCallbackUrl() {
    const baseUrl = config.payhero.callbackUrl;
    const token = config.payhero.callbackToken;

    if (!token) {
        return baseUrl;
    }

    const separator = baseUrl.includes("?") ? "&" : "?";

    return `${baseUrl}${separator}token=${encodeURIComponent(token)}`;
}

function verifyCallbackToken(req) {
    const expectedToken = config.payhero.callbackToken;

    if (!expectedToken) {
        return true;
    }

    return req.query.token === expectedToken;
}

module.exports = {
    payHeroRequest,
    initiateMpesaStkPush,
    buildCallbackUrl,
    verifyCallbackToken
};
