
const PAYHERO_BASE_URL =
    process.env.PAYHERO_BASE_URL || "https://backend.payhero.co.ke/api/v2";

// How long to wait for Pay Hero to respond before giving up. Without this,
// a hung request would leave a payment stuck in PROCESSING indefinitely -
// the STK-push route can only mark it FAILED if the fetch actually rejects.
const PAYHERO_REQUEST_TIMEOUT_MS =
    Number(process.env.PAYHERO_REQUEST_TIMEOUT_MS) || 20000;

function getAuthorizationHeader() {
    const username = process.env.PAYHERO_API_USERNAME;
    const password = process.env.PAYHERO_API_PASSWORD;

    if (!username || !password) {
        throw new Error("Pay Hero API credentials are not configured.");
    }

    const credentials = Buffer.from(
        `${username}:${password}`
    ).toString("base64");

    return `Basic ${credentials}`;
}

async function payHeroRequest(endpoint, options = {}) {
    const url = `${PAYHERO_BASE_URL}${endpoint}`;

    const controller = new AbortController();
    const timeout = setTimeout(
        () => controller.abort(),
        PAYHERO_REQUEST_TIMEOUT_MS
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
                `Pay Hero did not respond within ${PAYHERO_REQUEST_TIMEOUT_MS}ms.`
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
            hostname: error.cause?.hostname,
            address: error.cause?.address,
            port: error.cause?.port,
            url
        });

        throw networkError;
    } finally {
        clearTimeout(timeout);
    }

    const contentType =
        response.headers.get("content-type") || "";

    const data =
        contentType.includes("application/json")
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
    const channelId = Number(process.env.PAYHERO_CHANNEL_ID);

    if (!Number.isFinite(channelId)) {
        throw new Error(
            "PAYHERO_CHANNEL_ID is not configured (or is not a valid number) - " +
            "refusing to send an STK push with an invalid channel."
        );
    }

    const payload = {
        amount: Math.round(Number(amount)),
        phone_number: phoneNumber,
        channel_id: channelId,
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



module.exports = {
    payHeroRequest,
    initiateMpesaStkPush
};