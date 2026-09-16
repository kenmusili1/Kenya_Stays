/* =====================================================
   KENYA AIRBNB COUNTY DIRECTORY
   JAVASCRIPT

   County information is loaded from:
    counties.json
===================================================== */


/* ================= HTML ELEMENTS ================= */

const searchInput =
    document.getElementById("searchInput");

const sortSelect =
    document.getElementById("sortSelect");

const resultsMessage =
    document.getElementById("resultsMessage");

const currentYear =
    document.getElementById("currentYear");

const photoShowcase =
    document.getElementById("photoShowcase");

const totalListings =
    document.getElementById("totalListings");

const mobileMenuButton =
    document.getElementById("mobileMenuBtn");

const navigation =
    document.getElementById("navigation");

const heroSearchButton =
    document.getElementById("heroSearchButton");

const bookingForm =
    document.getElementById("bookingForm");

const bookingMessage =
    document.getElementById("bookingMessage");

const bookingSubmit =
    document.getElementById("bookingSubmit");

const propertyRecommendations =
    document.getElementById("propertyRecommendations");

const findPropertiesButton = 
    document.getElementById("findPropertiesButton");
const bookingReview =
    document.getElementById("bookingReview");

const bookingReviewContent =
    document.getElementById("bookingReviewContent");

const paymentSection =
    document.getElementById("paymentSection");

const paymentBookingReference =
    document.getElementById("paymentBookingReference");

const paymentAmount =
    document.getElementById("paymentAmount");

const mpesaPhone =
    document.getElementById("mpesaPhone");

const payNowButton =
    document.getElementById("payNowButton");

const paymentStatus =
    document.getElementById("paymentStatus");

const customerCareForm =
    document.getElementById("customerCareForm");

const customerCareMessage =
    document.getElementById("customerCareMessage");

const customerCareSubmit =
    document.getElementById("customerCareSubmit");

const ownerSummary =
    document.getElementById("ownerSummary");

const ownerBookings =
    document.getElementById("ownerBookings");

const ownerDashboardMessage =
    document.getElementById("ownerDashboardMessage");

const ownerDashboardRefresh =
    document.getElementById("ownerDashboardRefresh");

const adminSummary =
    document.getElementById("adminSummary");

const adminBookings =
    document.getElementById("adminBookings");

const adminTickets =
    document.getElementById("adminTickets");

const adminDashboardMessage =
    document.getElementById("adminDashboardMessage");

const adminDashboardRefresh =
    document.getElementById("adminDashboardRefresh");


/* ================= COUNTY DATA ================= */

let counties = [];

const API_BASE_URL = window.location.origin && window.location.origin !== "null"
    ? window.location.origin
    : "http://localhost:5000";


let selectedProperty = null;
let currentBooking = null;
let currentPaymentRequest = null;


async function fetchJson(url, options) {

    const response =
        await fetch(url, options);

    const contentType =
        response.headers.get("content-type") || "";

    if (!contentType.includes("application/json")) {

        throw new Error(
            "Backend returned a non-JSON response. Start Backend/index.js on port 5000."
        );

    }

    const data =
        await response.json();

    if (!response.ok) {
        throw new Error(data.message || `Backend returned status ${response.status}.`);
    }

    return data;

}


/* ================= BACKEND CONNECTION ================= */

async function checkBackend() {

    try {

        const response =
            await fetch(`${API_BASE_URL}/api/status`);

        if (!response.ok) {

            throw new Error(
                `Backend returned status ${response.status}`
            );

        }

        const data =
            await response.json();

        console.log("Backend connection successful:", data);

    } catch (error) {

        console.error(
            "Backend connection failed:",
            error
        );

    }

}

// ================= PAYHERO INTEGRATION =================
async function initiateMpesaPayment(
    paymentRequestId,
    phoneNumber
) {
    const response = await fetch(
        `${API_BASE_URL}/api/payments/${paymentRequestId}/stk-push`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                phone_number: phoneNumber
            })
        }
    );

    const data = await response.json();

    if (!response.ok) {
        throw new Error(
            data.message ||
            "Unable to initiate M-Pesa payment."
        );
    }

    return data;
}

//polling function to check payment status
async function getPaymentStatus(paymentRequestId) {
    const response = await fetch(
        `${API_BASE_URL}/api/payments/${paymentRequestId}`
    );

    const data = await response.json();

    if (!response.ok) {
        throw new Error(
            data.message ||
            "Unable to retrieve payment status."
        );
    }

    return data.payment;
}

//polling function to wait for payment completion
async function waitForPaymentCompletion(
    paymentRequestId,
    options = {}
) {
    const intervalMs = options.intervalMs || 3000;
    const timeoutMs = options.timeoutMs || 120000;

    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
        const payment =
            await getPaymentStatus(paymentRequestId);

        console.log(
            "Payment status:",
            payment.status
        );

        if (
            payment.status === "SUCCESS"
        ) {
            return payment;
        }

        if (
            payment.status === "FAILED" ||
            payment.status === "CANCELLED"
        ) {
            throw new Error(
                payment.result_description ||
                "M-Pesa payment was unsuccessful."
            );
        }

        await new Promise(resolve =>
            setTimeout(resolve, intervalMs)
        );
    }

    throw new Error(
        "Payment confirmation is taking longer than expected."
    );
}


async function submitBooking(event) {

    event.preventDefault();

    if (!selectedProperty) {
        bookingMessage.textContent =
            "Please select a property before submitting your booking.";

        bookingMessage.className =
            "booking-message error";

        return;
    }

    const formData =
        new FormData(bookingForm);

    const booking =
        Object.fromEntries(formData.entries());

    booking.guests =
        Number(booking.guests);

    booking.property_id =
        selectedProperty.property_id;

    bookingMessage.textContent =
        "Submitting your booking...";

    bookingMessage.className =
        "booking-message";

    bookingSubmit.disabled = true;

    try {

        const data =
            await fetchJson(
                `${API_BASE_URL}/api/bookings`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type": "application/json"
                    },

                    body: JSON.stringify(booking)
                }
            );

        currentBooking =
            data.booking;

        currentPaymentRequest =
            data.payment_request || null;

        bookingMessage.textContent =
            `${data.message} Booking #${currentBooking.booking_id}.`;

        bookingMessage.className =
            "booking-message success";

        if (currentPaymentRequest) {
            showPaymentSection(
                currentBooking,
                currentPaymentRequest
            );
        } else {
            bookingMessage.textContent =
                "Booking submitted, but no payment request was created.";

            bookingMessage.className =
                "booking-message error";
        }

    } catch (error) {

        bookingMessage.textContent =
            error.message ||
            "Unable to submit your booking.";

        bookingMessage.className =
            "booking-message error";

    } finally {

        bookingSubmit.disabled = false;

    }
}



async function handlePayNow() {

    if (!currentPaymentRequest) {
        setPaymentStatus(
            "No payment request is available.",
            "FAILED"
        );
        return;
    }

    const phoneNumber =
        mpesaPhone.value.trim();

    if (!phoneNumber) {
        setPaymentStatus(
            "Enter the M-Pesa phone number to continue.",
            "FAILED"
        );

        mpesaPhone.focus();

        return;
    }

    try {

        payNowButton.disabled = true;

        payNowButton.textContent =
            "Sending STK Push...";

        setPaymentStatus(
            "Sending an M-Pesa payment request...",
            "STK_INITIATED"
        );

        await initiateMpesaPayment(
            currentPaymentRequest.payment_request_id,
            phoneNumber
        );

        payNowButton.textContent =
            "Waiting for Payment...";

        setPaymentStatus(
            "Check your phone and enter your M-Pesa PIN.",
            "PROCESSING"
        );

        const payment =
            await waitForPaymentCompletion(
                currentPaymentRequest.payment_request_id,
                {
                    intervalMs: 3000,
                    timeoutMs: 120000
                }
            );

        setPaymentStatus(
            "Payment successful! Your booking is confirmed.",
            "SUCCESS"
        );

        payNowButton.textContent =
            "Booking Confirmed";

        currentPaymentRequest =
            payment;

    } catch (error) {

        console.error(
            "M-Pesa payment error:",
            error
        );

        setPaymentStatus(
            error.message ||
            "Payment could not be completed.",
            "FAILED"
        );

        payNowButton.disabled = false;

        payNowButton.textContent =
            "Try Again";
    }
}






function displayPropertyRecommendations(recommendations) {

    if (!propertyRecommendations) {
        return;
    }

    if (!recommendations.length) {

        propertyRecommendations.innerHTML =
            `
            <p class="recommendation-empty">
                No matching properties were found
                for these dates and requirements.
            </p>
            `;

        return;
    }

    propertyRecommendations.innerHTML = `
        <h3>Best matches</h3>

        <div class="recommendation-list">

            ${recommendations.map((property, index) => `

                <article
                    class="recommendation-card${index === 0 ? " best-match" : ""}"
                >

                    ${
                        index === 0
                            ? '<span class="best-match-label">Best match</span>'
                            : ""
                    }

                    <h4>${property.name}</h4>

                    <p>
                        ${property.distance_km} km away ·
                        ${property.location},
                        ${property.city}
                    </p>

                    <strong>
                        KSh ${Number(property.nightly_rate).toLocaleString()}
                        / night
                    </strong>

                    <span>
                        Available for your dates ·
                        Up to ${property.max_guests} guests
                    </span>

                    <button
                        type="button"
                        class="booking-submit select-property-button"
                        data-property-id="${property.property_id}"
                    >
                        Select this property
                        <i class="fa-solid fa-check"></i>
                    </button>

                </article>

            `).join("")}

        </div>
    `;

    propertyRecommendations
        .querySelectorAll(".select-property-button")
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    const propertyId =
                        Number(button.dataset.propertyId);

                    const property =
                        recommendations.find(
                            item =>
                                Number(item.property_id) ===
                                propertyId
                        );

                    if (property) {
                        selectProperty(property);
                    }

                }
            );

        });
}



function showBookingReview(property) {
if (!bookingReview || !bookingReviewContent) {
    return;
}

const formData =
    new FormData(bookingForm);

const booking =
    Object.fromEntries(formData.entries());

bookingReviewContent.innerHTML = `
    <div class="booking-review-grid">

        <div>
            <span>Property</span>
            <strong>
                ${property.name}
            </strong>
        </div>

        <div>
            <span>Location</span>
            <strong>
                ${property.location}, ${property.city}
            </strong>
        </div>

        <div>
            <span>Check-in</span>
            <strong>
                ${booking.checkIn}
            </strong>
        </div>

        <div>
            <span>Check-out</span>
            <strong>
                ${booking.checkOut}
            </strong>
        </div>

        <div>
            <span>Guests</span>
            <strong>
                ${booking.guests}
            </strong>
        </div>

        <div>
            <span>Total price</span>
            <strong>
                KES ${Number(property.total_amount || 0).toLocaleString()}
            </strong>
        </div>

    </div>
`;

bookingReview.hidden = false;

bookingReview.scrollIntoView({
    behavior: "smooth",
    block: "start"
});
}


function selectProperty(property) {

    selectedProperty = property;

    showBookingReview();

    bookingMessage.textContent =
        `${property.name} selected. Review your booking before submitting.`;

    bookingMessage.className =
        "booking-message success";

    if (bookingReview) {
        bookingReview.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
    }
}


function calculateBookingNights(checkIn, checkOut) {

    if (!checkIn || !checkOut) {
        return 0;
    }

    const start =
        new Date(`${checkIn}T00:00:00`);

    const end =
        new Date(`${checkOut}T00:00:00`);

    const difference =
        end - start;

    return Math.ceil(
        difference / 86400000
    );
}



function showPaymentSection(
    booking,
    paymentRequest
) {

    if (!paymentSection) {
        return;
    }

    paymentBookingReference.textContent =
        `#${booking.booking_id}`;

    paymentAmount.textContent =
        `KES ${Number(
            paymentRequest.amount
        ).toLocaleString()}`;

    paymentStatus.textContent =
        "Your booking is ready for payment.";

    paymentStatus.className =
        "booking-message";

    paymentSection.hidden = false;

    paymentSection.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
}


function normalizeKenyanPhoneNumber(phoneNumber) {

    const cleaned =
        String(phoneNumber || "")
            .trim()
            .replace(/\s+/g, "")
            .replace(/-/g, "");

    if (!cleaned) {
        return null;
    }

    if (/^07\d{8}$/.test(cleaned)) {
        return `254${cleaned.slice(1)}`;
    }

    if (/^7\d{8}$/.test(cleaned)) {
        return `254${cleaned}`;
    }

    if (/^2547\d{8}$/.test(cleaned)) {
        return cleaned;
    }

    if (/^\+2547\d{8}$/.test(cleaned)) {
        return cleaned.slice(1);
    }

    return null;
}


async function initiateMpesaPayment(
    paymentRequestId,
    phoneNumber
) {

    const response =
        await fetch(
            `${API_BASE_URL}/api/payments/${paymentRequestId}/stk-push`,
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({
                    phoneNumber
                })
            }
        );

    const data =
        await response.json();

    if (!response.ok) {
        throw new Error(
            data.message ||
            "Unable to initiate M-Pesa payment."
        );
    }

    return data;
}


async function getPaymentStatus(
    paymentRequestId
) {

    const data =
        await fetchJson(
            `${API_BASE_URL}/api/payments/${paymentRequestId}`
        );

    return data.payment;
}


async function waitForPaymentCompletion(
    paymentRequestId,
    options = {}
) {

    const intervalMs =
        options.intervalMs || 3000;

    const timeoutMs =
        options.timeoutMs || 120000;

    const startTime =
        Date.now();

    while (
        Date.now() - startTime <
        timeoutMs
    ) {

        const payment =
            await getPaymentStatus(
                paymentRequestId
            );

        if (payment.status === "SUCCESS") {
            return payment;
        }

        if (
            payment.status === "FAILED" ||
            payment.status === "CANCELLED"
        ) {

            throw new Error(
                payment.result_description ||
                "M-Pesa payment was unsuccessful."
            );
        }

        await new Promise(
            resolve =>
                setTimeout(
                    resolve,
                    intervalMs
                )
        );
    }

    throw new Error(
        "Payment confirmation is taking longer than expected."
    );
}


async function handlePayNow() {

    if (!currentPaymentRequest) {

        paymentStatus.textContent =
            "No payment request is available.";

        paymentStatus.className =
            "booking-message error";

        return;
    }

    const phoneNumber =
        normalizeKenyanPhoneNumber(
            mpesaPhone.value
        );

    if (!phoneNumber) {

        paymentStatus.textContent =
            "Enter a valid Kenyan M-Pesa number, for example 0712345678.";

        paymentStatus.className =
            "booking-message error";

        return;
    }

    payNowButton.disabled = true;

    paymentStatus.textContent =
        "Sending M-Pesa payment prompt...";

    paymentStatus.className =
        "booking-message";

    try {

        await initiateMpesaPayment(
            currentPaymentRequest.payment_request_id,
            phoneNumber
        );

        paymentStatus.textContent =
            "Payment prompt sent. Check your phone and enter your M-Pesa PIN.";

        const payment =
            await waitForPaymentCompletion(
                currentPaymentRequest.payment_request_id
            );

        currentPaymentRequest =
            payment;

        paymentStatus.textContent =
            "Payment successful. Your booking is confirmed.";

        paymentStatus.className =
            "booking-message success";

        payNowButton.disabled = true;

    } catch (error) {

        paymentStatus.textContent =
            error.message ||
            "Payment could not be completed.";

        paymentStatus.className =
            "booking-message error";

        payNowButton.disabled = false;
    }
}





async function findProperties() {
    if (!bookingForm) return;

    const formData = new FormData(bookingForm);

    const location = String(formData.get("location") || "").trim();
    const checkIn = String(formData.get("checkIn") || "").trim();
    const checkOut = String(formData.get("checkOut") || "").trim();
    const guests = Number(formData.get("guests") || 1);
    const accommodation = String(
        formData.get("accommodation") || ""
    ).trim();

    if (!location) {
        bookingMessage.textContent = "Please enter a location.";
        return;
    }

    if (!checkIn || !checkOut) {
        bookingMessage.textContent =
            "Please select check-in and check-out dates.";
        return;
    }

    if (new Date(checkOut) <= new Date(checkIn)) {
        bookingMessage.textContent =
            "Check-out must be after check-in.";
        return;
    }

    if (!Number.isInteger(guests) || guests < 1) {
        bookingMessage.textContent =
            "Guests must be a whole number greater than zero.";
        return;
    }

    bookingMessage.textContent = "Finding available properties...";

    try {
        const data = await fetchJson(
            `${API_BASE_URL}/api/properties/recommendations`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    location,
                    checkIn,
                    checkOut,
                    guests,
                    accommodation
                })
            }
        );

        const recommendations = data.recommendations || [];

        if (!recommendations.length) {
            propertyRecommendations.innerHTML = `
                <p class="booking-message">
                    No properties matched your search criteria.
                </p>
            `;

            bookingReview.hidden = true;
            bookingMessage.textContent =
                data.message || "No properties found.";
            return;
        }

        displayPropertyRecommendations(recommendations);

        bookingMessage.textContent =
            `${recommendations.length} propert${
                recommendations.length === 1 ? "y" : "ies"
            } found. Select one to continue.`;

    } catch (error) {
        console.error("Property recommendation error:", error);

        bookingMessage.textContent =
            error.message ||
            "Unable to find properties. Please try again.";
    }
}






function showBookingReview() {

    if (!bookingReview ||
        !bookingReviewContent ||
        !selectedProperty) {
        return;
    }

    const formData =
        new FormData(bookingForm);

    const checkIn =
        formData.get("checkIn");

    const checkOut =
        formData.get("checkOut");

    const guests =
        Number(formData.get("guests"));

    const accommodation =
        formData.get("accommodation");

    const nights =
        calculateBookingNights(
            checkIn,
            checkOut
        );

    const estimatedTotal =
        Number(selectedProperty.nightly_rate) *
        nights;

    bookingReviewContent.innerHTML = `
        <div class="review-item">
            <strong>Property</strong>
            <span>${selectedProperty.name}</span>
        </div>

        <div class="review-item">
            <strong>Location</strong>
            <span>
                ${selectedProperty.location},
                ${selectedProperty.city}
            </span>
        </div>

        <div class="review-item">
            <strong>Check-in</strong>
            <span>${checkIn}</span>
        </div>

        <div class="review-item">
            <strong>Check-out</strong>
            <span>${checkOut}</span>
        </div>

        <div class="review-item">
            <strong>Guests</strong>
            <span>${guests}</span>
        </div>

        <div class="review-item">
            <strong>Accommodation</strong>
            <span>${accommodation}</span>
        </div>

        <div class="review-item">
            <strong>Stay</strong>
            <span>${nights} night${nights === 1 ? "" : "s"}</span>
        </div>

        <div class="review-item">
            <strong>Nightly rate</strong>
            <span>
                KSh ${Number(
                    selectedProperty.nightly_rate
                ).toLocaleString()}
            </span>
        </div>

        <div class="review-item">
            <strong>Estimated total</strong>
            <span>
                KSh ${estimatedTotal.toLocaleString()}
            </span>
        </div>
    `;

    bookingReview.hidden = false;
}






function showPaymentSection(payment) {
if (!paymentSection) {
    return;
}

paymentBookingReference.textContent =
    `#${payment.booking_id}`;

paymentAmount.textContent =
    `KES ${Number(payment.amount).toLocaleString()}`;

paymentStatus.textContent =
    "Your booking has been submitted. Complete payment to confirm it.";

paymentStatus.className =
    "booking-message";

payNowButton.disabled = false;

payNowButton.textContent =
    "Pay with M-Pesa";

paymentSection.hidden = false;

paymentSection.scrollIntoView({
    behavior: "smooth",
    block: "start"
});
}


async function submitCustomerCareMessage(event) {

    event.preventDefault();

    const formData =
        new FormData(customerCareForm);

    const message =
        Object.fromEntries(formData.entries());

    customerCareMessage.textContent = "Sending your message...";
    customerCareMessage.className = "booking-message";
    customerCareSubmit.disabled = true;

    try {

        const data =
            await fetchJson(`${API_BASE_URL}/api/customer-care/messages`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(message)
            });

        customerCareMessage.textContent =
            `${data.message} Reference #${data.customerMessage.message_id}.`;
        customerCareMessage.className = "booking-message success";
        customerCareForm.reset();

    } catch (error) {

        customerCareMessage.textContent =
            error.message || "Backend connection failed.";
        customerCareMessage.className = "booking-message error";

    } finally {

        customerCareSubmit.disabled = false;

    }

}


async function loadOwnerDashboard() {

    if (!ownerSummary || !ownerBookings) {
        return;
    }

    try {

        const data =
            await fetchJson(`${API_BASE_URL}/api/owners/2/dashboard`);

        ownerSummary.innerHTML = `
            <div class="owner-stat"><strong>${data.summary.properties}</strong><span>Properties</span></div>
            <div class="owner-stat"><strong>${data.summary.pending_requests}</strong><span>Pending requests</span></div>
            <div class="owner-stat"><strong>${data.summary.confirmed_bookings}</strong><span>Confirmed bookings</span></div>
            <div class="owner-stat"><strong>KSh ${data.summary.expected_earnings.toLocaleString()}</strong><span>Expected earnings</span></div>
        `;

        if (data.bookings.length === 0) {
            ownerBookings.innerHTML = "<p class=\"recommendation-empty\">No booking requests yet.</p>";
            return;
        }

        ownerBookings.innerHTML = data.bookings.map(booking => `
            <article class="owner-booking-card">
                <div><span class="section-label">BOOKING #${booking.booking_id}</span><h3>${booking.location} · ${booking.accommodation}</h3><p>${booking.check_in} to ${booking.check_out} · ${booking.guests} guest${booking.guests === 1 ? "" : "s"}</p></div>
                <div class="owner-booking-meta"><strong>KSh ${Number(booking.amount || 0).toLocaleString()}</strong><span class="booking-status ${booking.status}">${booking.status}</span>${booking.status === "pending" ? `<div class="owner-actions"><button type="button" data-booking-action="accept" data-booking-id="${booking.booking_id}">Accept</button><button type="button" data-booking-action="decline" data-booking-id="${booking.booking_id}">Decline</button></div>` : ""}</div>
            </article>
        `).join("");

        ownerBookings.querySelectorAll("[data-booking-action]").forEach(button => {
            button.addEventListener("click", () => updateOwnerBooking(button.dataset.bookingId, button.dataset.bookingAction));
        });

    } catch (error) {

        ownerDashboardMessage.textContent = error.message || "Owner dashboard connection failed.";
        ownerDashboardMessage.className = "booking-message error";

    }

}


async function updateOwnerBooking(bookingId, action) {

    ownerDashboardMessage.textContent = "Updating booking...";
    ownerDashboardMessage.className = "booking-message";

    try {

        const data = await fetchJson(`${API_BASE_URL}/api/owners/2/bookings/${bookingId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action })
        });

        ownerDashboardMessage.textContent = data.message;
        ownerDashboardMessage.className = "booking-message success";
        await loadOwnerDashboard();

    } catch (error) {

        ownerDashboardMessage.textContent = error.message || "Booking update failed.";
        ownerDashboardMessage.className = "booking-message error";

    }

}


async function loadAdminDashboard() {

    if (!adminSummary || !adminBookings || !adminTickets) {
        return;
    }

    try {

        const data = await fetchJson(`${API_BASE_URL}/api/admin/dashboard?admin_id=3`);

        const summary = data.summary;
        adminSummary.innerHTML = `
            <div class="admin-stat"><strong>${summary.users.toLocaleString()}</strong><span>Users</span></div>
            <div class="admin-stat"><strong>${summary.property_owners.toLocaleString()}</strong><span>Property owners</span></div>
            <div class="admin-stat"><strong>${summary.properties.toLocaleString()}</strong><span>Properties</span></div>
            <div class="admin-stat"><strong>${summary.bookings.toLocaleString()}</strong><span>Bookings</span></div>
            <div class="admin-stat"><strong>${summary.pending_requests.toLocaleString()}</strong><span>Pending requests</span></div>
            <div class="admin-stat"><strong>${summary.customer_messages.toLocaleString()}</strong><span>Customer messages</span></div>
            <div class="admin-stat admin-revenue"><strong>KSh ${summary.revenue.toLocaleString()}</strong><span>Revenue</span></div>
        `;

        adminBookings.innerHTML = data.recent_bookings.length === 0
            ? "<p class=\"recommendation-empty\">No bookings yet.</p>"
            : data.recent_bookings.map(booking => `<article class="admin-row"><strong>${booking.property}</strong><span>${booking.location}</span><span>KSh ${Number(booking.amount || 0).toLocaleString()}</span><span class="booking-status ${booking.status}">${booking.status}</span><span>${booking.payment_status}</span></article>`).join("");

        adminTickets.innerHTML = data.customer_messages.length === 0
            ? "<p class=\"recommendation-empty\">No customer-care tickets yet.</p>"
            : data.customer_messages.slice().reverse().slice(0, 6).map(ticket => `<article class="admin-ticket"><strong>${ticket.subject}</strong><span>${ticket.name} · ${ticket.status}</span><p>${ticket.message}</p></article>`).join("");

    } catch (error) {

        adminDashboardMessage.textContent = error.message || "Admin dashboard connection failed.";
        adminDashboardMessage.className = "booking-message error";

    }

}


/* ================= LOAD JSON DATA ================= */

async function loadCounties() {

    try {

        const response =
            await fetch("counties.json");


        /* Check whether the file was found */

        if (!response.ok) {

            throw new Error(
                `Unable to load counties.json. Status: ${response.status}`
            );

        }


        /* Convert JSON to JavaScript */

        counties =
            await response.json();


        /* Display counties */

        displayCounties(counties);

        updateTotalListings();


    } catch (error) {

        console.error(
            "Error loading county data:",
            error
        );


        document.getElementById("countyGrid").innerHTML = `

            <div class="county-card">

                <h3>
                    Unable to Load County Data
                </h3>

                <p>
                    Please make sure that
                    <strong>counties.json</strong>
                    exists and that you are running
                    the website using Live Server.
                </p>

            </div>

        `;

    }

}


/* ================= DISPLAY COUNTIES ================= */

function displayCounties(data) {

    const grid =
        document.getElementById("countyGrid");

    grid.innerHTML = "";


    /* No results */

    if (data.length === 0) {

        grid.innerHTML = `

            <div class="county-card">

                <h3>
                    No County Found
                </h3>

                <p>
                    Please try another county name.
                </p>

            </div>

        `;

        return;

    }


    /* Generate cards */

    data.forEach(county => {

        const card =
            document.createElement("article");


        card.className =
            "county-card";


        const hasData =
            county.listings && county.listings > 0;

        const listingDisplay =
            hasData ? county.listings.toLocaleString() : "Data unavailable";


        card.innerHTML = `

            <div class="county-top">
                <div class="county-icon">
                    <i class="fa-solid fa-location-dot"></i>
                </div>
                <span class="county-region">${county.region || ""}</span>
            </div>

            <h3>${county.county}</h3>

            <div class="listing-number">${listingDisplay}</div>

            <div class="listing-label">
                ${hasData ? "Recorded listings" : "Current data unavailable"}
            </div>

            <div class="county-card-footer">
                <a class="explore-link" href="https://www.airbnb.com/s/${encodeURIComponent(county.county + " Kenya")}/homes" target="_blank" rel="noopener noreferrer">
                    Explore ${county.county}
                    <i class="fa-solid fa-arrow-right"></i>
                </a>
            </div>

        `;


        grid.appendChild(card);

    });

}


/* ================= SEARCH ================= */

function searchCounties() {

    const search =
        searchInput.value.toLowerCase().trim();


    const filteredCounties =
        counties.filter(county =>
            county.county.toLowerCase().includes(search)
        );


    displayCounties(filteredCounties);

}


/* ================= SORT ================= */

function sortCounties() {

    const selectedValue =
        sortSelect.value;


    let sortedCounties =
        [...counties];


    /* Sort by number of listings */

    if (selectedValue === "listings") {

        sortedCounties.sort(
            (a, b) => (b.listings || 0) - (a.listings || 0)
        );

    }


    /* Sort alphabetically */

    if (selectedValue === "name") {

        sortedCounties.sort(
            (a, b) =>
                a.county.localeCompare(b.county)
        );

    }


    displayCounties(sortedCounties);

}


/* ================= TOTAL LISTINGS ================= */

function updateTotalListings() {

    const total =
        counties.reduce(
            (sum, county) => sum + (county.listings || 0),
            0
        );

    if (totalListings && total > 0) {

        totalListings.textContent =
            total.toLocaleString();

    }

}


/* ================= SCROLL TO COUNTIES ================= */

function scrollToCounties() {

    document
        .getElementById("counties")
        .scrollIntoView({
            behavior: "smooth"
        });

}


/* ================= EVENT LISTENERS ================= */

searchInput.addEventListener(
    "input",
    searchCounties
);


sortSelect.addEventListener(
    "change",
    sortCounties
);


if (heroSearchButton) {

    heroSearchButton.addEventListener(
        "click",
        () => {
            scrollToCounties();
            searchCounties();
        }
    );

}

if (bookingForm) {

    bookingForm.addEventListener(
        "submit",
        submitBooking
    );

}

if (bookingForm) {

    bookingForm.addEventListener(
        "submit",
        submitBooking
    );

}

if (findPropertiesButton) {
    findPropertiesButton.addEventListener(
        "click",
        findProperties
    );
}

if (payNowButton) {
    payNowButton.addEventListener(
        "click",
        handlePayNow
    );
}




if (customerCareForm) {

    customerCareForm.addEventListener(
        "submit",
        submitCustomerCareMessage
    );

}

if (customerCareForm) {

    customerCareForm.addEventListener(
        "submit",
        submitCustomerCareMessage
    );

}

if (ownerDashboardRefresh) {

    ownerDashboardRefresh.addEventListener(
        "click",
        loadOwnerDashboard
    );

}

if (adminDashboardRefresh) {
    adminDashboardRefresh.addEventListener("click", loadAdminDashboard);
}


if (mobileMenuButton && navigation) {

    mobileMenuButton.addEventListener(
        "click",
        () => {
            const isOpen =
                navigation.classList.toggle("open");

            mobileMenuButton.setAttribute(
                "aria-expanded",
                isOpen
            );

        }
    );

    navigation.querySelectorAll("a").forEach(link => {

        link.addEventListener(
            "click",
            () => navigation.classList.remove("open")
        );

    });

}


/* ================= PHOTO SHOWCASE ================= */

if (photoShowcase) {

    const slides =
        [...photoShowcase.querySelectorAll(".photo-slide")];

    const dots =
        [...photoShowcase.querySelectorAll(".slide-dot")];

    let activeSlide = 0;
    let slideshowTimer;

    function showSlide(index) {

        activeSlide =
            (index + slides.length) % slides.length;

        slides.forEach((slide, slideIndex) => {

            slide.classList.toggle(
                "active",
                slideIndex === activeSlide
            );

        });

        dots.forEach((dot, dotIndex) => {

            const isActive =
                dotIndex === activeSlide;

            dot.classList.toggle("active", isActive);
            dot.setAttribute("aria-pressed", isActive);

        });

    }

    function startSlideshow() {

        slideshowTimer =
            setInterval(() => showSlide(activeSlide + 1), 5000);

    }

    function stopSlideshow() {

        clearInterval(slideshowTimer);

    }

    dots.forEach((dot, dotIndex) => {

        dot.addEventListener(
            "click",
            () => {
                showSlide(dotIndex);
                stopSlideshow();
                startSlideshow();
            }
        );

    });

    photoShowcase.addEventListener("mouseenter", stopSlideshow);
    photoShowcase.addEventListener("mouseleave", startSlideshow);
    photoShowcase.addEventListener("focusin", stopSlideshow);
    photoShowcase.addEventListener("focusout", startSlideshow);

    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        startSlideshow();
    }

}


/* ================= CURRENT YEAR ================= */

if (currentYear) {

    currentYear.textContent =
        new Date().getFullYear();

}


/* ================= START WEBSITE ================= */

if (window.location.pathname === "/admin") {
    document.getElementById("admin")?.scrollIntoView();
}

checkBackend();
loadCounties();
loadOwnerDashboard();
loadAdminDashboard();
