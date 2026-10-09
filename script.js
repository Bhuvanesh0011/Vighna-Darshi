/* GLOBAL STATE */
let selectedRole = "admin";
let currentUser = null;
let adminMap = null;
let partnerMap = null;
let vehicleMarkers = [];
let partnerMarker = null;
let gpsInterval = null;

// Integrated API: FastAPI serves the frontend and persists shared records in Supabase.
const API_BASE = window.VIGHNA_API_BASE || "";
let knownAlertIds = new Set();
let knownIncidentIds = new Set();
let syncTimer = null;

async function apiRequest(path, options = {}) {
    const response = await fetch(`${API_BASE}/api${path}`, {
        ...options,
        headers: { "Content-Type": "application/json", ...(options.headers || {}) }
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.detail || `Request failed (${response.status})`);
    return body;
}

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, ch => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[ch]));
}

function startCrossDeviceSync() {
    if (syncTimer) clearInterval(syncTimer);
    syncSharedData();
    // Polling works across devices even if Supabase Realtime publication is not enabled.
    syncTimer = setInterval(syncSharedData, 5000);
}

async function syncSharedData() {
    try {
        if (selectedRole === "partner") {
            const data = await apiRequest("/alerts");
            (data.alerts || []).slice().reverse().forEach(alert => {
                const id = String(alert.id);
                if (!knownAlertIds.has(id)) {
                    knownAlertIds.add(id);
                    if (alert.active !== false) triggerPartnerAlertLocally({
                        id, title: alert.title, description: alert.description,
                        severity: alert.severity, timestamp: alert.created_at
                    });
                }
            });
        } else if (selectedRole === "admin") {
            const data = await apiRequest("/incidents");
            (data.incidents || []).slice().reverse().forEach(incident => {
                const id = String(incident.id);
                if (!knownIncidentIds.has(id)) {
                    knownIncidentIds.add(id);
                    renderPartnerIncident(incident, false);
                }
            });
        }
    } catch (error) {
        // Avoid interrupting the dashboard if the API is not running or Supabase is not configured.
        console.warn("Vighna-Darshi sync:", error.message);
    }
}


/* LOGIN */
const users = {
    admin: { username: "admin", password: "Admin@123", role: "Logistic Administrator" },
    partner: { username: "partner", password: "Partner@123", vehicle: "KA01AB1234", role: "Delivery Partner" }
};

function selectRole(role) {
    selectedRole = role;
    document.getElementById("adminRoleBtn").classList.toggle("active", role === "admin");
    document.getElementById("partnerRoleBtn").classList.toggle("active", role === "partner");
    document.getElementById("vehicleGroup").style.display = role === "partner" ? "block" : "none";
    document.getElementById("loginError").style.display = "none";
}

function login() {
    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value;
    const vehicle = document.getElementById("vehicle").value.trim().toUpperCase();
    const user = users[selectedRole];
    let valid = username === user.username && password === user.password;
    if (selectedRole === "partner") { valid = valid && vehicle === user.vehicle; }
    if (!valid) {
        document.getElementById("loginError").style.display = "block";
        return;
    }
    currentUser = user;
    document.getElementById("loginPage").style.display = "none";
    document.getElementById("app").style.display = "block";

    if (selectedRole === "admin") loadAdmin();
    else loadPartner();
}

/* ADMIN LOAD */
function loadAdmin() {
    document.getElementById("adminNav").style.display = "block";
    document.getElementById("partnerNav").style.display = "none";
    document.getElementById("sidebarRole").innerText = "Logistic Administrator";
    document.getElementById("currentUser").innerText = "Administrator";
    initializeAdminMap();
    generateFleet();
    startCrossDeviceSync();
}

/* PARTNER LOAD */
function loadPartner() {
    document.getElementById("adminNav").style.display = "none";
    document.getElementById("partnerNav").style.display = "block";
    document.getElementById("sidebarRole").innerText = "Delivery Partner";
    document.getElementById("currentUser").innerText = "KA01AB1234";
    initializePartnerMap();
    startCrossDeviceSync();
}

/* PAGE NAVIGATION */
function showPage(pageId, button) {
    document.querySelectorAll(".page").forEach(page => page.classList.remove("active"));
    const page = document.getElementById(pageId);
    if (page) page.classList.add("active");

    document.querySelectorAll(".nav-item").forEach(btn => btn.classList.remove("active"));
    if (button) button.classList.add("active");

    const titles = {
        overview: "Command Center", warroom: "Disruption War Room", fleet: "Live Fleet", deliveries: "Deliveries",
        impact: "Impact Analysis", ai: "AI Decision Copilot", history: "Decision History",
        partnerHome: "My Dashboard", partnerRoute: "My Route", partnerDeliveries: "My Deliveries",
        partnerAlertsPage: "Route Alerts", partnerReport: "Report Incident"
    };
    document.getElementById("topPageTitle").innerText = titles[pageId] || "Dashboard";

    if (pageId === "partnerRoute" && partnerMap) setTimeout(() => partnerMap.invalidateSize(), 200);
    if (pageId === "overview" && adminMap) setTimeout(() => adminMap.invalidateSize(), 200);
}

/* ADMIN MAP (Updated to Google Maps Visuals) */
function initializeAdminMap() {
    if (adminMap) { adminMap.invalidateSize(); return; }
    adminMap = L.map("adminMap").setView([12.9716, 77.5946], 10);
    // Google Maps Tile Layer replacing standard map
    L.tileLayer("https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}", {
        attribution: "© Google Maps"
    }).addTo(adminMap);

    const locations = [
        [12.9716, 77.5946], [12.9345, 77.6101], [13.0068, 77.5847], [12.8452, 77.6602],
        [13.0827, 80.2707], [12.9165, 77.6101], [12.985, 77.720], [13.021, 77.645]
    ];
    locations.forEach((location, index) => {
        const marker = L.circleMarker(location, {
            radius: 8, color: index === 1 ? "#ff4d4d" : "#d9a441",
            fillColor: index === 1 ? "#ff4d4d" : "#d9a441", fillOpacity: .85, weight: 2
        }).addTo(adminMap);
        marker.bindPopup(`<b>Vehicle V-${100 + index}</b><br>GPS Connected<br>Status: ${index === 1 ? "AT RISK" : "ON ROUTE"}`);
        vehicleMarkers.push(marker);
    });
}

/* PARTNER MAP (Updated to Google Maps Visuals) */
function initializePartnerMap() {
    if (partnerMap) { partnerMap.invalidateSize(); return; }
    partnerMap = L.map("partnerMap").setView([12.9716, 77.5946], 11);
    // Google Maps Tile Layer
    L.tileLayer("https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}", {
        attribution: "© Google Maps"
    }).addTo(partnerMap);

    const routePoints = [
        [12.9716, 77.5946], [12.9600, 77.6100], [12.9400, 77.6250],
        [12.9150, 77.6400], [12.8900, 77.6500], [12.8452, 77.6602]
    ];
    L.polyline(routePoints, { color: "#35d07f", weight: 6, opacity: .9 }).addTo(partnerMap);

    partnerMarker = L.circleMarker(routePoints[1], {
        radius: 10, color: "#111", fillColor: "#35d07f", fillOpacity: 1, weight: 3
    }).addTo(partnerMap);
    partnerMarker.bindPopup("<b>KA01AB1234</b><br>Live GPS");
    partnerMap.fitBounds(routePoints);
}

/* LIVE GPS SIMULATION */
let gpsStep = 1;
function simulateGPS() {
    if (!partnerMarker) return;
    const points = [[12.9716, 77.5946], [12.9600, 77.6100], [12.9400, 77.6250], [12.9150, 77.6400], [12.8900, 77.6500], [12.8452, 77.6602]];
    gpsStep++;
    if (gpsStep >= points.length) gpsStep = 0;
    partnerMarker.setLatLng(points[gpsStep]);
    const speed = 45 + Math.floor(Math.random() * 20);
    document.getElementById("partnerSpeed").innerText = speed + " km/h";
}
setInterval(simulateGPS, 5000);

/* FLEET TABLE */
function generateFleet() {
    const vehicles = [
        ["KA01AB1234", "Ravi", "Bengaluru → Electronic City", "54 km/h", "16:42", "Low", "ON ROUTE"],
        ["KA05CD6789", "Arun", "Bengaluru → Hosur", "42 km/h", "17:15", "High", "AT RISK"],
        ["KA03EF2468", "Kiran", "Whitefield → Yelahanka", "51 km/h", "16:55", "Low", "ON ROUTE"],
        ["KA04GH1357", "Manoj", "Silk Board → HSR", "38 km/h", "17:30", "Medium", "ON ROUTE"],
        ["KA02JK9876", "Suresh", "Hebbal → Airport", "61 km/h", "16:28", "Low", "ON ROUTE"],
        ["KA06LM4321", "Vijay", "Electronic City → Hosur", "31 km/h", "18:05", "High", "DELAYED"]
    ];
    const tbody = document.getElementById("fleetTable");
    tbody.innerHTML = "";
    vehicles.forEach(v => {
        const riskClass = v[5] === "High" ? "red" : v[5] === "Medium" ? "orange" : "green";
        const statusClass = v[6] === "DELAYED" ? "red" : v[6] === "AT RISK" ? "orange" : "green";
        const row = document.createElement("tr");
        row.innerHTML = `<td><strong>${v[0]}</strong></td><td>${v[1]}</td><td>${v[2]}</td><td>${v[3]}</td><td>${v[4]}</td><td class="${riskClass}">${v[5]}</td><td><span class="badge ${statusClass}">${v[6]}</span></td>`;
        tbody.appendChild(row);
    });
}

/* DISRUPTION CREATION (Admin Side) */
function openDisruptionModal() { document.getElementById("disruptionModal").classList.add("show"); }
function closeDisruptionModal() { document.getElementById("disruptionModal").classList.remove("show"); }

async function createDisruption() {
    const title = document.getElementById("disruptionTitle").value.trim();
    const severity = document.getElementById("disruptionSeverity").value;
    const description = document.getElementById("disruptionDescription").value.trim();

    if (!title || !description) {
        showToast("Missing information", "Please enter disruption details.");
        return;
    }

    try {
        const result = await apiRequest("/alerts", {
            method: "POST",
            body: JSON.stringify({ title, description, severity, created_by: currentUser?.username || "admin" })
        });
        closeDisruptionModal();
        const saved = result.alert;
        if (saved?.id != null) knownAlertIds.add(String(saved.id));
        renderAdminAlert(saved || { title, description, severity, created_at: new Date().toISOString() });
        showToast("Disruption broadcast", "Alert saved to Supabase. Delivery partner dashboards will receive it shortly.");
        syncSharedData();
    } catch (error) {
        showToast("Could not send alert", error.message + " Make sure the backend and Supabase SQL setup are running.");
    }
}

function renderAdminAlert(data) {
    const alerts = document.getElementById("adminAlerts");
    if (!alerts) return;
    const alert = document.createElement("div");
    alert.className = "alert " + (data.severity === "critical" ? "critical" : "warning");
    alert.innerHTML = `<div class="alert-icon">${data.severity === "critical" ? "🚨" : "⚠️"}</div><div><div class="alert-title">${escapeHTML(data.title)}</div><div class="alert-text">${escapeHTML(data.description)}<br>Broadcast to affected teams.</div></div>`;
    alerts.prepend(alert);
    const count = document.getElementById("incidentCount");
    if (count) count.innerText = "Alert broadcast";
}

/* Cross-device alert delivery is handled by polling the shared Supabase-backed API. */

function triggerPartnerAlertLocally(data) {
    // Inject alert to panel
    const partnerAlerts = document.getElementById("partnerAlerts");
    const partnerAlert = document.createElement("div");
    partnerAlert.className = "alert " + (data.severity === "critical" ? "critical" : "warning");
    partnerAlert.innerHTML = `<div class="alert-icon">${data.severity === "critical" ? "🚨" : "⚠️"}</div><div><div class="alert-title">${escapeHTML(data.title)}</div><div class="alert-text">${escapeHTML(data.description)}<br><strong>New instruction from Logistics Admin.</strong></div></div>`;
    if(partnerAlerts) partnerAlerts.prepend(partnerAlert);

    const statusEl = document.getElementById("partnerAlertStatus");
    if(statusEl) {
        statusEl.innerText = "NEW ADMIN ALERT";
        statusEl.className = "red";
    }

    // Show intrusive visual Alert Modal for the driver
    if (selectedRole === "partner" || document.getElementById("partnerNav").style.display === "block") {
        document.getElementById("partnerAlertModalTitle").innerText = data.title;
        document.getElementById("partnerAlertModalDesc").innerText = data.description;
        document.getElementById("partnerAlertModal").classList.add("show");
    }
}

function closePartnerAlertModal() { document.getElementById("partnerAlertModal").classList.remove("show"); }

/* PARTNER INCIDENT */
function openPartnerReport() { showPage("partnerReport", document.querySelector('#partnerNav .nav-item:nth-child(5)')); }
function closePartnerReport() { document.getElementById("partnerIncidentModal").classList.remove("show"); }
function submitQuickIncident() {
    const type = document.getElementById("quickIncidentType").value;
    const description = document.getElementById("quickIncidentDescription").value.trim();
    if (!description) { showToast("Missing description", "Please describe the incident."); return; }
    closePartnerReport();
    receivePartnerIncident(type, description);
}
function submitPartnerIncident() {
    const type = document.getElementById("incidentType").value;
    const description = document.getElementById("incidentDescription").value.trim();
    if (!description) { showToast("Missing description", "Please describe the incident."); return; }
    receivePartnerIncident(type, description);
}
async function receivePartnerIncident(type, description) {
    try {
        const result = await apiRequest("/incidents", {
            method: "POST",
            body: JSON.stringify({
                incident_type: type,
                description,
                vehicle_id: currentUser?.vehicle || "KA01AB1234",
                reported_by: currentUser?.username || "partner"
            })
        });
        const saved = result.incident || { incident_type: type, description, vehicle_id: "KA01AB1234" };
        if (saved.id != null) knownIncidentIds.add(String(saved.id));
        showToast("Incident reported", "Incident saved to Supabase. The administrator dashboard will receive it shortly.");
        renderPartnerIncident(saved, true);
        syncSharedData();
    } catch (error) {
        showToast("Incident not sent", error.message + " Make sure the backend and Supabase SQL setup are running.");
    }
}

function renderPartnerIncident(incident, isNew) {
    const alerts = document.getElementById("adminAlerts");
    if (!alerts) return;
    // Avoid duplicate display for the same database record.
    if (incident.id != null && alerts.querySelector(`[data-incident-id="${CSS.escape(String(incident.id))}"]`)) return;
    const alert = document.createElement("div");
    alert.className = "alert critical";
    if (incident.id != null) alert.dataset.incidentId = String(incident.id);
    const type = incident.incident_type || incident.type || "Incident";
    alert.innerHTML = `<div class="alert-icon">🆘</div><div><div class="alert-title">Partner Incident: ${escapeHTML(type)}</div><div class="alert-text">Vehicle ${escapeHTML(incident.vehicle_id || "KA01AB1234")} reported: ${escapeHTML(incident.description)}<br><strong>Immediate attention required.</strong></div></div>`;
    alerts.prepend(alert);
    const count = document.getElementById("incidentCount");
    if (count) count.innerText = isNew ? "New partner incident" : "Partner incident";
    const risk = document.getElementById("riskCount");
    if (risk && isNew) risk.innerText = "13";
}

/* AI CHATBOT SYSTEM */
function toggleChat() {
    document.getElementById('chatBody').classList.toggle('open');
    document.getElementById('chatInputArea').classList.toggle('open');
}

function sendChatMessage() {
    const input = document.getElementById('chatInput');
    const text = input.value.trim();
    if (!text) return;
    
    // User message
    const chatBody = document.getElementById('chatBody');
    chatBody.innerHTML += `<div class="msg user">${text}</div>`;
    input.value = '';
    chatBody.scrollTop = chatBody.scrollHeight;

    // AI Response logic based on role
    setTimeout(() => {
        let reply = "I am monitoring systems. How can I assist?";
        const lower = text.toLowerCase();

        if (selectedRole === 'admin') {
            if (lower.includes('status') || lower.includes('fleet')) reply = "All 24 vehicles are connected. 2 are currently at SLA risk due to disruptions.";
            else if (lower.includes('route') || lower.includes('disruption') || lower.includes('ai')) reply = "Recommended Action: Reroute V-104 and V-117 via Hosur. This saves 42 minutes and protects the SLA.";
            else reply = "As a Logistics Admin, you can broadcast disruptions directly to drivers or view impact analysis.";
        } else {
            // Partner
            if (lower.includes('route') || lower.includes('disruption')) reply = "A disruption is reported ahead. The admin suggests taking the Hosur-Electronic City alternative route to save time.";
            else if (lower.includes('delay')) reply = "Traffic ahead will cause an 8-minute delay. Drive safely.";
            else reply = "Drive safe! Let me know if you need to report an incident or check your ETA.";
        }

        chatBody.innerHTML += `<div class="msg bot">${reply}</div>`;
        chatBody.scrollTop = chatBody.scrollHeight;
    }, 800);
}

/* TOAST */
let toastTimer;
function showToast(title, message) {
    const toast = document.getElementById("toast");
    document.getElementById("toastTitle").innerText = title;
    document.getElementById("toastText").innerText = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.classList.remove("show"); }, 4000);
}

/* SIDEBAR & MISC */
function toggleSidebar() { document.getElementById("sidebar").classList.toggle("open"); }
function logout() {
    clearInterval(gpsInterval);
    if (syncTimer) { clearInterval(syncTimer); syncTimer = null; }
    knownAlertIds.clear();
    knownIncidentIds.clear();
    document.getElementById("app").style.display = "none";
    document.getElementById("loginPage").style.display = "flex";
    document.getElementById("username").value = "";
    document.getElementById("password").value = "";
    document.getElementById("vehicle").value = "";
    selectRole("admin");
}

document.getElementById("password").addEventListener("keydown", function (event) { if (event.key === "Enter") login(); });