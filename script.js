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

const heroRequestButton =
    document.getElementById("heroRequestButton");

const heroRequestPanel =
    document.getElementById("heroRequestPanel");

const bookingForm =
    document.getElementById("bookingForm");

const bookingMessage =
    document.getElementById("bookingMessage");

const bookingSubmit =
    document.getElementById("bookingSubmit");

const propertyRecommendations =
    document.getElementById("propertyRecommendations");

const customerCareForm =
    document.getElementById("customerCareForm");

const customerCareMessage =
    document.getElementById("customerCareMessage");

const customerCareSubmit =
    document.getElementById("customerCareSubmit");

const customerCareToggle =
    document.getElementById("customerCareToggle");

const ownerSummary =
    document.getElementById("ownerSummary");

const ownerBookings =
    document.getElementById("ownerBookings");

const ownerDashboardMessage =
    document.getElementById("ownerDashboardMessage");

const ownerDashboardRefresh =
    document.getElementById("ownerDashboardRefresh");

const ownerPropertyToggleButton =
    document.getElementById("ownerPropertyToggleButton");

const ownerPropertyPanel =
    document.getElementById("ownerPropertyPanel");

const ownerPropertyForm =
    document.getElementById("ownerPropertyForm");

const ownerPropertyMessage =
    document.getElementById("ownerPropertyMessage");

const ownerProperties =
    document.getElementById("ownerProperties");

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

const adminProperties =
    document.getElementById("adminProperties");

const adminPropertyToggleButton =
    document.getElementById("adminPropertyToggleButton");

const adminPropertyPanel =
    document.getElementById("adminPropertyPanel");

const adminPropertyForm =
    document.getElementById("adminPropertyForm");

const adminPropertyMessage =
    document.getElementById("adminPropertyMessage");

const roleSelector =
    document.getElementById("roleSelector");

const loginButton =
    document.getElementById("loginButton");

const logoutButton =
    document.getElementById("logoutButton");

const loginModalBackdrop =
    document.getElementById("loginModalBackdrop");

const closeLoginModalButton =
    document.getElementById("closeLoginModal");

const loginForm =
    document.getElementById("loginForm");

const loginRoleSelect =
    document.getElementById("loginRole");

const loginEmailInput =
    document.getElementById("loginEmail");

const loginPasswordInput =
    document.getElementById("loginPassword");

const routeTray =
    document.getElementById("routeTray");

const routeTrayTitle =
    document.getElementById("routeTrayTitle");

const routeTrayLocation =
    document.getElementById("routeTrayLocation");

const routeTrayDistance =
    document.getElementById("routeTrayDistance");

const routeTrayPrice =
    document.getElementById("routeTrayPrice");

const routeTrayEta =
    document.getElementById("routeTrayEta");

const routeTrayMap =
    document.getElementById("routeTrayMap");

const routeTrayBookNow =
    document.getElementById("routeTrayBookNow");

const routeTrayOpenMaps =
    document.getElementById("routeTrayOpenMaps");

const routeTrayClose =
    document.getElementById("routeTrayClose");


/* ================= COUNTY DATA ================= */

let counties = [];

const API_BASE_URL = window.location.origin && window.location.origin !== "null"
    ? window.location.origin
    : "http://localhost:3000";

function getStoredAuthState() {
    try {
        return JSON.parse(localStorage.getItem("kenyaStaysAuth") || sessionStorage.getItem("kenyaStaysAuth") || "{}") || {};
    } catch (error) {
        return {};
    }
}

function getCurrentUserRole() {
    return "OWNER";
}

function syncRoleSelector() {
    if (roleSelector) {
        roleSelector.value = "OWNER";
    }
}

function updateAuthButtons() {
    if (loginButton) {
        loginButton.hidden = true;
    }

    if (logoutButton) {
        logoutButton.hidden = true;
    }
}

function renderDashboardAccess() {
    const ownerDashboardSection = document.getElementById("owner-dashboard");
    const adminDashboardSection = document.getElementById("admin");
    const shouldShowOwnerDashboard = true;
    const shouldShowAdminDashboard = true;

    if (ownerDashboardSection) {
        ownerDashboardSection.hidden = !shouldShowOwnerDashboard;
        ownerDashboardSection.style.display = shouldShowOwnerDashboard ? "" : "none";
    }

    if (adminDashboardSection) {
        adminDashboardSection.hidden = !shouldShowAdminDashboard;
        adminDashboardSection.style.display = shouldShowAdminDashboard ? "" : "none";
    }
}

function refreshDashboardRoleState() {
    syncRoleSelector();
    renderDashboardAccess();
    updateAuthButtons();

    const currentUserRole = getCurrentUserRole();

    if (currentUserRole === "OWNER") {
        loadOwnerDashboard();
        loadAdminDashboard();
    } else if (currentUserRole === "ADMIN") {
        loadAdminDashboard();
    }
}

function openLoginModal() {
    if (!loginModalBackdrop) {
        return;
    }

    if (loginRoleSelect) {
        loginRoleSelect.value = getCurrentUserRole();
    }

    loginModalBackdrop.hidden = false;
}

function closeLoginModal() {
    if (loginModalBackdrop) {
        loginModalBackdrop.hidden = true;
    }
}

function handleLoginSubmit(event) {
    event.preventDefault();

    if (!loginRoleSelect || !loginEmailInput || !loginPasswordInput) {
        return;
    }

    const email = String(loginEmailInput.value || "").trim();
    const password = String(loginPasswordInput.value || "");

    if (!email.includes("@") || password.length < 6) {
        window.alert("Please enter a valid email and a password with at least 6 characters.");
        return;
    }

    const selectedRole = String(loginRoleSelect.value || "CUSTOMER").toUpperCase();
    const authState = {
        isLoggedIn: true,
        email,
        role: selectedRole
    };

    localStorage.setItem("kenyaStaysAuth", JSON.stringify(authState));
    localStorage.setItem("kenyaStaysRole", selectedRole);
    sessionStorage.setItem("kenyaStaysAuth", JSON.stringify(authState));
    sessionStorage.setItem("kenyaStaysRole", selectedRole);

    if (roleSelector) {
        roleSelector.value = selectedRole;
    }

    refreshDashboardRoleState();
    closeLoginModal();
    loginForm.reset();
}

function handleLogout() {
    localStorage.removeItem("kenyaStaysAuth");
    sessionStorage.removeItem("kenyaStaysAuth");
    localStorage.setItem("kenyaStaysRole", "CUSTOMER");
    sessionStorage.setItem("kenyaStaysRole", "CUSTOMER");

    if (roleSelector) {
        roleSelector.value = "CUSTOMER";
    }

    refreshDashboardRoleState();
}

async function fetchJson(url, options) {

    const response =
        await fetch(url, options);

    const contentType =
        response.headers.get("content-type") || "";

    if (!contentType.includes("application/json")) {

        throw new Error(
            "Backend returned a non-JSON response. Start backend/server.js on port 5000."
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


async function submitBooking(event) {

    event.preventDefault();

    const formData =
        new FormData(bookingForm);

    const booking =
        Object.fromEntries(formData.entries());

    booking.guests = Number(booking.guests);
    bookingMessage.textContent = "Sending your request...";
    bookingMessage.className = "booking-message";
    bookingSubmit.disabled = true;

    try {

        const response =
            await fetch(`${API_BASE_URL}/api/bookings`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(booking)
            });

        const data =
            await response.json();

        if (!response.ok) {

            throw new Error(data.message || "Unable to send request.");

        }

        bookingMessage.textContent =
            `${data.message} Request #${data.booking.booking_id}.`;
        bookingMessage.className = "booking-message success";
        displayPropertyRecommendations(data.recommendations || []);
        bookingForm.reset();

    } catch (error) {

        bookingMessage.textContent =
            error.message || "Backend connection failed.";
        bookingMessage.className = "booking-message error";

    } finally {

        bookingSubmit.disabled = false;

    }

}


function buildMapEmbedUrl(property) {
    if (!property) {
        return "https://www.google.com/maps?q=Kenya&z=6&output=embed";
    }

    const destination = property.latitude && property.longitude
        ? `${property.latitude},${property.longitude}`
        : `${property.name || "Airbnb"} ${property.location || ""} ${property.city || "Kenya"}`;

    return `https://www.google.com/maps?q=${encodeURIComponent(destination)}&z=13&output=embed`;
}

function formatTravelEta(property) {
    const distanceKm = Number(property?.distance_km || 0);

    if (!distanceKm) {
        return "ETA: approx. 15 min";
    }

    const etaMinutes = Math.max(8, Math.round(distanceKm * 5));

    if (etaMinutes >= 60) {
        const hours = Math.floor(etaMinutes / 60);
        const minutes = etaMinutes % 60;
        return `ETA: ${hours}h ${minutes}m`;
    }

    return `ETA: ${etaMinutes} min`;
}

function openRouteTray(property) {
    if (!property || !routeTray) {
        return;
    }

    const distanceText = Number.isFinite(property.distance_km) ? `${property.distance_km.toFixed(1)} km away` : "Distance available soon";
    const priceText = Number.isFinite(property.nightly_rate) ? `KSh ${property.nightly_rate.toLocaleString()} / night` : "Price available soon";
    const etaText = formatTravelEta(property);

    if (routeTrayTitle) {
        routeTrayTitle.textContent = property.name || "Selected Airbnb";
    }

    if (routeTrayLocation) {
        routeTrayLocation.textContent = `${property.location || "Location"}, ${property.city || "Kenya"}`;
    }

    if (routeTrayDistance) {
        routeTrayDistance.textContent = distanceText;
    }

    if (routeTrayPrice) {
        routeTrayPrice.textContent = priceText;
    }

    if (routeTrayEta) {
        routeTrayEta.textContent = etaText;
    }

    if (routeTrayMap) {
        routeTrayMap.src = buildMapEmbedUrl(property);
    }

    routeTray.dataset.propertyName = property.name || "";
    routeTray.dataset.propertyLocation = property.location || "";
    routeTray.dataset.propertyCity = property.city || "Kenya";
    routeTray.dataset.propertyLatitude = property.latitude ?? "";
    routeTray.dataset.propertyLongitude = property.longitude ?? "";
    routeTray.hidden = false;
}

function closeRouteTray() {
    if (routeTray) {
        routeTray.hidden = true;
    }
}

function openPropertyDirections(property) {

    if (!property || !property.latitude || !property.longitude) {
        openRouteTray(property);
        window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${property?.name || "Airbnb"} ${property?.location || "Kenya"}`)}`, "_blank", "noopener,noreferrer");
        return;
    }

    const destination = `${property.latitude},${property.longitude}`;
    const openMaps = (origin) => {
        const url = origin
            ? `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&travelmode=driving`
            : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${property.name} ${property.location} ${property.city || "Kenya"}`)}`;

        if (routeTray) {
            openRouteTray(property);
        }

        window.open(url, "_blank", "noopener,noreferrer");
    };

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            position => {
                const origin = `${position.coords.latitude},${position.coords.longitude}`;
                openMaps(origin);
            },
            () => openMaps(),
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 60000
            }
        );
        return;
    }

    openMaps();

}

function displayPropertyRecommendations(recommendations) {

    if (!propertyRecommendations) {
        return;
    }

    if (recommendations.length === 0) {

        propertyRecommendations.innerHTML =
            "<p class=\"recommendation-empty\">No matching properties were found for these dates and requirements.</p>";
        return;

    }

    propertyRecommendations.innerHTML = `
        <h3>Best matches</h3>
        <div class="recommendation-list">
            ${recommendations.map((property, index) => `
                <article class="recommendation-card${index === 0 ? " best-match" : ""}">
                    ${index === 0 ? "<span class=\"best-match-label\">Best match</span>" : ""}
                    <h4>${property.name}</h4>
                    <p>${property.distance_km} km away · ${property.location}, ${property.city}</p>
                    <strong>KSh ${property.nightly_rate.toLocaleString()} / night</strong>
                    <span>Available for your dates · Up to ${property.max_guests} guests</span>
                    <button class="direction-button" type="button" data-direction-lat="${property.latitude ?? ""}" data-direction-lng="${property.longitude ?? ""}" data-direction-name="${property.name}" data-direction-location="${property.location}" data-direction-city="${property.city || "Kenya"}">Get directions</button>
                </article>
            `).join("")}
        </div>
    `;

    propertyRecommendations.querySelectorAll("[data-direction-lat]").forEach(button => {
        button.addEventListener("click", () => {
            const property = {
                name: button.dataset.directionName,
                location: button.dataset.directionLocation,
                city: button.dataset.directionCity,
                latitude: Number(button.dataset.directionLat),
                longitude: Number(button.dataset.directionLng),
                nightly_rate: Number(button.closest(".recommendation-card")?.querySelector("strong")?.textContent?.replace(/[^\d]/g, "") || 0),
                distance_km: Number((button.closest(".recommendation-card")?.querySelector("p")?.textContent?.match(/(\d+(?:\.\d+)?)\s*km/) || [])[1] || 0)
            };
            openPropertyDirections(property);
        });
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

    if (!ownerSummary || !ownerBookings || getCurrentUserRole() !== "OWNER") {
        return;
    }

    try {

        const data =
            await fetchJson(`${API_BASE_URL}/api/owners/2/dashboard?role=${getCurrentUserRole()}`);

        ownerSummary.innerHTML = `
            <div class="owner-stat"><strong>${data.summary.properties}</strong><span>Properties</span></div>
            <div class="owner-stat"><strong>${data.summary.pending_requests}</strong><span>Pending requests</span></div>
            <div class="owner-stat"><strong>${data.summary.confirmed_bookings}</strong><span>Confirmed bookings</span></div>
            <div class="owner-stat"><strong>KSh ${data.summary.expected_earnings.toLocaleString()}</strong><span>Expected earnings</span></div>
        `;

        if (data.bookings.length === 0) {
            ownerBookings.innerHTML = "<p class=\"recommendation-empty\">No booking requests yet.</p>";
        } else {
            ownerBookings.innerHTML = data.bookings.map(booking => `
                <article class="owner-booking-card">
                    <div><span class="section-label">BOOKING #${booking.booking_id}</span><h3>${booking.location} · ${booking.accommodation}</h3><p>${booking.check_in} to ${booking.check_out} · ${booking.guests} guest${booking.guests === 1 ? "" : "s"}</p></div>
                    <div class="owner-booking-meta"><strong>KSh ${Number(booking.amount || 0).toLocaleString()}</strong><span class="booking-status ${booking.status}">${booking.status}</span>${booking.status === "pending" ? `<div class="owner-actions"><button type="button" data-booking-action="accept" data-booking-id="${booking.booking_id}">Accept</button><button type="button" data-booking-action="decline" data-booking-id="${booking.booking_id}">Decline</button></div>` : ""}</div>
                </article>
            `).join("");

            ownerBookings.querySelectorAll("[data-booking-action]").forEach(button => {
                button.addEventListener("click", () => updateOwnerBooking(button.dataset.bookingId, button.dataset.bookingAction));
            });
        }

        if (!data.properties || data.properties.length === 0) {
            ownerProperties.innerHTML = "<p class=\"recommendation-empty\">No properties submitted yet.</p>";
        } else {
            ownerProperties.innerHTML = data.properties.map(property => `
                <article class="owner-property-card">
                    <div>
                        <span class="section-label">PROPERTY #${property.property_id}</span>
                        <h3>${property.name}</h3>
                        <p>${property.location}, ${property.city} · ${property.accommodation}</p>
                    </div>
                    <div class="owner-booking-meta">
                        <strong>KSh ${Number(property.nightly_rate || 0).toLocaleString()} / night</strong>
                        <span class="booking-status ${property.approved ? "success" : "pending"}">${property.approved ? "Approved" : "Pending approval"}</span>
                    </div>
                </article>
            `).join("");
        }

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

async function submitOwnerProperty(event) {
    event.preventDefault();

    if (!ownerPropertyForm) {
        return;
    }

    const formData = new FormData(ownerPropertyForm);
    const payload = Object.fromEntries(formData.entries());

    payload.owner_id = Number(payload.owner_id || 2);
    payload.nightly_rate = Number(payload.nightly_rate);
    payload.max_guests = Number(payload.max_guests);
    payload.latitude = payload.latitude === "" ? 0 : Number(payload.latitude);
    payload.longitude = payload.longitude === "" ? 0 : Number(payload.longitude);
    payload.available = payload.available === "true";
    payload.approved = false;

    if (ownerPropertyMessage) {
        ownerPropertyMessage.textContent = "Submitting property...";
        ownerPropertyMessage.className = "booking-message";
    }

    try {
        const data = await fetchJson(`${API_BASE_URL}/api/properties?owner_id=${payload.owner_id}&role=${getCurrentUserRole()}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (ownerPropertyMessage) {
            ownerPropertyMessage.textContent = data.message || "Property submitted for admin approval.";
            ownerPropertyMessage.className = "booking-message success";
        }

        ownerPropertyForm.reset();
        document.getElementById("ownerPropertyOwner").value = payload.owner_id;
        document.getElementById("ownerPropertyGuests").value = 4;
        document.getElementById("ownerPropertyAvailable").value = "true";

        await loadOwnerDashboard();
        await loadAdminDashboard();

    } catch (error) {
        if (ownerPropertyMessage) {
            ownerPropertyMessage.textContent = error.message || "Unable to submit property.";
            ownerPropertyMessage.className = "booking-message error";
        }
    }
}


async function loadAdminDashboard() {

    const currentUserRole = getCurrentUserRole();

    if (!adminSummary || !adminBookings || !adminTickets) {
        return;
    }

    if (currentUserRole !== "ADMIN" && currentUserRole !== "OWNER") {
        return;
    }

    try {

        const data = await fetchJson(`${API_BASE_URL}/api/admin/dashboard?admin_id=${currentUserRole === "OWNER" ? 2 : 3}&role=${currentUserRole}`);

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

        if (!data.properties || data.properties.length === 0) {
            adminProperties.innerHTML = "<p class=\"recommendation-empty\">No listings submitted yet.</p>";
        } else {
            const pendingProperties = data.properties.filter(property => property.approved === false || property.approved === null);

            if (pendingProperties.length === 0) {
                adminProperties.innerHTML = "<p class=\"recommendation-empty\">No pending listing approvals.</p>";
            } else {
                adminProperties.innerHTML = pendingProperties.map(property => `
                    <article class="owner-property-card">
                        <div>
                            <span class="section-label">PROPERTY #${property.property_id}</span>
                            <h3>${property.name}</h3>
                            <p>${property.location}, ${property.city} · ${property.accommodation}</p>
                        </div>
                        <div class="owner-booking-meta">
                            <strong>KSh ${Number(property.nightly_rate || 0).toLocaleString()} / night</strong>
                            <span class="booking-status pending">Pending approval</span>
                            <div class="owner-actions">
                                <button type="button" data-property-approve="true" data-property-id="${property.property_id}">Approve</button>
                                <button type="button" data-property-approve="false" data-property-id="${property.property_id}">Reject</button>
                            </div>
                        </div>
                    </article>
                `).join("");

                adminProperties.querySelectorAll("[data-property-approve]").forEach(button => {
                    button.addEventListener("click", () => updatePropertyApproval(Number(button.dataset.propertyId), button.dataset.propertyApprove === "true"));
                });
            }
        }

    } catch (error) {

        adminDashboardMessage.textContent = error.message || "Admin dashboard connection failed.";
        adminDashboardMessage.className = "booking-message error";

    }

}

async function updatePropertyApproval(propertyId, approved) {
    if (!adminDashboardMessage) {
        return;
    }

    adminDashboardMessage.textContent = approved ? "Approving property..." : "Rejecting property...";
    adminDashboardMessage.className = "booking-message";

    try {
        const data = await fetchJson(`${API_BASE_URL}/api/admin/properties/${propertyId}/approval?admin_id=3&role=ADMIN`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ approved })
        });

        adminDashboardMessage.textContent = data.success
            ? `Property ${approved ? "approved" : "rejected"} successfully.`
            : "Property approval update failed.";
        adminDashboardMessage.className = "booking-message success";

        await loadOwnerDashboard();
        await loadAdminDashboard();
    } catch (error) {
        adminDashboardMessage.textContent = error.message || "Unable to update property approval.";
        adminDashboardMessage.className = "booking-message error";
    }
}

async function submitAdminProperty(event) {
    event.preventDefault();

    if (!adminPropertyForm) {
        return;
    }

    const formData = new FormData(adminPropertyForm);
    const payload = Object.fromEntries(formData.entries());

    payload.owner_id = Number(payload.owner_id || 2);
    payload.nightly_rate = Number(payload.nightly_rate);
    payload.max_guests = Number(payload.max_guests);
    payload.latitude = payload.latitude === "" ? 0 : Number(payload.latitude);
    payload.longitude = payload.longitude === "" ? 0 : Number(payload.longitude);
    payload.approved = payload.approved === "true";
    payload.available = payload.available === "true";

    if (adminPropertyMessage) {
        adminPropertyMessage.textContent = "Adding listing...";
        adminPropertyMessage.className = "booking-message";
    }

    try {
        const data = await fetchJson(`${API_BASE_URL}/api/properties?admin_id=3&role=ADMIN`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (adminPropertyMessage) {
            adminPropertyMessage.textContent = data.message || "Property added successfully.";
            adminPropertyMessage.className = "booking-message success";
        }

        adminPropertyForm.reset();
        document.getElementById("adminPropertyOwner").value = 2;
        document.getElementById("adminPropertyGuests").value = 4;
        document.getElementById("adminPropertyApproved").value = "true";
        document.getElementById("adminPropertyAvailable").value = "true";

        await loadOwnerDashboard();
        await loadAdminDashboard();

    } catch (error) {
        if (adminPropertyMessage) {
            adminPropertyMessage.textContent = error.message || "Unable to add property.";
            adminPropertyMessage.className = "booking-message error";
        }
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

const countyImagePool = [
    "images/mombasa.jpg",
    "images/diani.jpg",
    "images/Red-Pearl-of-Diani.jpg",
    "images/426758012.jpg",
    "images/497178425.jpg",
    "images/502124378.jpg",
    "images/676803396.jpg",
    "images/681930579.jpg",
    "images/838895061.jpg",
    "images/8da90cb1c0975eee9cef7dbebe9c165f.jpg",
    "images/AB1_02.webp",
    "images/images.jpg",
    "images/images%20(1).jpg",
    "images/images%20(2).jpg",
    "images/images%20(3).jpg",
    "images/images%20(4).jpg",
    "images/images%20(5).jpg",
    "images/images%20(6).jpg",
    "images/images%20(7).jpg",
    "images/images%20(8).jpg",
    "images/images%20(9).jpg",
    "images/images%20(10).jpg",
    "images/images%20(11).jpg",
    "images/0df7e9ce-b803-4697-a688-806255b55e10.avif",
    "images/22371816-5dc7-4ca1-8c8b-521e9f148f83.avif",
    "images/ed89b812-8f1d-4767-af23-18266d639c0e.avif",
    "images/fbb3a375-96d8-4dd9-93f8-88ce61f5327e.avif",
    "images/st-barts-utopic-1561473951.avif",
    "images/WhatsApp-Image-2026-05-11-at-16.51.59-jpeg.webp",
    "images/nairobi.jpg",
    "images/kenya-hero.jpg"
];

const countyImageOverrides = {
    "Kitui": "images/images%20(8).jpg",
    "Kiambu": "images/images%20(9).jpg",
    "Nyamira": "images/images%20(11).jpg"
};

function getCountyImage(county) {
    const imageIndex = ((county.id || 1) - 1) % countyImagePool.length;
    return countyImageOverrides[county.county]
        || countyImagePool[imageIndex]
        || "images/kenya-hero.jpg";
}

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

        const countyImage = getCountyImage(county);
        const countyName = county.county || "Kenya";
        const countyRegion = county.region || "Kenya";


        card.innerHTML = `

            <div class="county-image-wrap">
                <img src="${countyImage}" alt="A welcoming short-term stay in ${countyName}, Kenya" title="Explore stays in ${countyName}, Kenya" loading="lazy" decoding="async">
                <div class="county-overlay">
                    <span class="county-image-label">${countyRegion}</span>
                    <h3>${countyName}</h3>
                    <div class="county-listing-summary">
                        <span>${listingDisplay}</span>
                        <small>${hasData ? "Recorded listings" : "Current data unavailable"}</small>
                    </div>
                    <a class="explore-link" href="https://www.airbnb.com/s/${encodeURIComponent(countyName + " Kenya")}/homes" target="_blank" rel="noopener noreferrer">
                        Explore ${countyName}
                        <i class="fa-solid fa-arrow-right"></i>
                    </a>
                </div>
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

if (heroRequestButton && heroRequestPanel) {
    heroRequestButton.addEventListener("click", () => {
        const isHidden = heroRequestPanel.hasAttribute("hidden");
        heroRequestPanel.hidden = !isHidden;

        if (!heroRequestPanel.hidden) {
            const firstInput = heroRequestPanel.querySelector("input, select, textarea");
            if (firstInput) {
                firstInput.focus();
            }
        }
    });
}

if (bookingForm) {

    bookingForm.addEventListener(
        "submit",
        submitBooking
    );

}

if (customerCareForm) {

    customerCareForm.addEventListener(
        "submit",
        submitCustomerCareMessage
    );

}

if (customerCareToggle && customerCareForm) {
    customerCareToggle.addEventListener("click", () => {
        const isHidden = customerCareForm.classList.toggle("hidden");
        customerCareToggle.setAttribute("aria-expanded", String(!isHidden));
        customerCareToggle.innerHTML = isHidden
            ? 'Send us Message <i class="fa-solid fa-chevron-down"></i>'
            : 'Hide Details <i class="fa-solid fa-chevron-up"></i>';

        if (!isHidden) {
            const firstField = customerCareForm.querySelector("input, textarea");
            firstField?.focus();
        }
    });
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

if (ownerPropertyToggleButton && ownerPropertyPanel) {
    ownerPropertyToggleButton.addEventListener("click", () => {
        const isHidden = ownerPropertyPanel.hasAttribute("hidden");
        ownerPropertyPanel.hidden = !isHidden;

        if (!ownerPropertyPanel.hidden) {
            const firstInput = ownerPropertyPanel.querySelector("input, select, textarea");
            if (firstInput) {
                firstInput.focus();
            }
        }
    });
}

if (adminPropertyToggleButton && adminPropertyPanel) {
    adminPropertyToggleButton.addEventListener("click", () => {
        const isHidden = adminPropertyPanel.hasAttribute("hidden");
        adminPropertyPanel.hidden = !isHidden;

        if (!adminPropertyPanel.hidden) {
            const firstInput = adminPropertyPanel.querySelector("input, select, textarea");
            if (firstInput) {
                firstInput.focus();
            }
        }
    });
}

if (ownerPropertyForm) {
    ownerPropertyForm.addEventListener("submit", submitOwnerProperty);
}

if (adminPropertyForm) {
    adminPropertyForm.addEventListener("submit", submitAdminProperty);
}

if (roleSelector) {
    roleSelector.addEventListener("change", () => {
        localStorage.setItem("kenyaStaysRole", roleSelector.value);
        sessionStorage.setItem("kenyaStaysRole", roleSelector.value);
        refreshDashboardRoleState();
    });
}

if (loginButton) {
    loginButton.addEventListener("click", openLoginModal);
}

if (logoutButton) {
    logoutButton.addEventListener("click", handleLogout);
}

if (closeLoginModalButton) {
    closeLoginModalButton.addEventListener("click", closeLoginModal);
}

if (loginModalBackdrop) {
    loginModalBackdrop.addEventListener("click", (event) => {
        if (event.target === loginModalBackdrop) {
            closeLoginModal();
        }
    });
}

if (loginForm) {
    loginForm.addEventListener("submit", handleLoginSubmit);
}

if (routeTrayBookNow) {
    routeTrayBookNow.addEventListener("click", () => {
        const property = {
            name: routeTray?.dataset?.propertyName || "Selected Airbnb",
            location: routeTray?.dataset?.propertyLocation || "Location",
            city: routeTray?.dataset?.propertyCity || "Kenya",
            latitude: Number(routeTray?.dataset?.propertyLatitude || 0),
            longitude: Number(routeTray?.dataset?.propertyLongitude || 0)
        };

        const bookingLocation = document.getElementById("bookingLocation");
        const bookingForm = document.getElementById("bookingForm");

        if (bookingLocation) {
            bookingLocation.value = property.location || property.city || property.name || "";
        }

        if (bookingForm) {
            bookingForm.scrollIntoView({ behavior: "smooth", block: "start" });
            const firstInput = bookingForm.querySelector("input, select, textarea");
            if (firstInput) {
                firstInput.focus();
            }
        }
    });
}

if (routeTrayOpenMaps) {
    routeTrayOpenMaps.addEventListener("click", () => {
        const property = {
            name: routeTray?.dataset?.propertyName || "Selected Airbnb",
            location: routeTray?.dataset?.propertyLocation || "Location",
            city: routeTray?.dataset?.propertyCity || "Kenya",
            latitude: Number(routeTray?.dataset?.propertyLatitude || 0),
            longitude: Number(routeTray?.dataset?.propertyLongitude || 0)
        };

        const destination = `${property.latitude},${property.longitude}`;
        const mapUrl = property.latitude && property.longitude
            ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}&travelmode=driving`
            : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${property.name} ${property.location} ${property.city}`)}`;

        window.open(mapUrl, "_blank", "noopener,noreferrer");
    });
}

if (routeTrayClose) {
    routeTrayClose.addEventListener("click", closeRouteTray);
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

renderDashboardAccess();
syncRoleSelector();
updateAuthButtons();

if (window.location.pathname === "/admin") {
    document.getElementById("admin")?.scrollIntoView();
}

checkBackend();
loadCounties();
refreshDashboardRoleState();
