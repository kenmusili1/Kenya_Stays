
const PAYHERO_BASE_URL =
    process.env.PAYHERO_BASE_URL || "https://backend.payhero.co.ke/api/v2";

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

    let response;

    try {
        response = await fetch(url, {
            ...options,
            headers: {
                Authorization: getAuthorizationHeader(),
                "Content-Type": "application/json",
                ...(options.headers || {})
            }
        });
    } catch (error) {
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
    const payload = {
        amount: Math.round(Number(amount)),
        phone_number: phoneNumber,
        channel_id: Number(process.env.PAYHERO_CHANNEL_ID),
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