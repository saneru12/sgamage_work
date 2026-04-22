const DeliveryPortal = (() => {
  const API_BASE = "http://localhost:5000/api";
  const TOKEN_KEY = "sg_delivery_token";
  const META_KEY = "sg_delivery_meta";

  const state = {
    token: localStorage.getItem(TOKEN_KEY) || "",
    deliveryBoy: JSON.parse(localStorage.getItem(META_KEY) || "{}"),
    view: "active",
    stats: null,
    orders: []
  };

  const DELIVERY_STATUS_META = {
    awaiting_advance_verification: "Advance review",
    confirmed: "Confirmed",
    scheduling_in_progress: "Planning",
    scheduled: "Scheduled",
    packed: "Packed",
    out_for_delivery: "Out for delivery",
    arriving_soon: "Arriving soon",
    delivered: "Delivered",
    delivery_issue: "Issue",
    rescheduled: "Rescheduled",
    cancelled: "Cancelled"
  };

  const ASSIGNMENT_STATUS_META = {
    unassigned: "Unassigned",
    assigned: "Assigned",
    accepted: "Accepted",
    issue_reported: "Issue reported",
    completed: "Completed"
  };

  const AVAILABILITY_META = {
    available: "Available",
    on_route: "On route",
    off_duty: "Off duty",
    leave: "On leave"
  };

  function getToken() {
    return localStorage.getItem(TOKEN_KEY) || "";
  }

  function setSession(token, deliveryBoy) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(META_KEY, JSON.stringify(deliveryBoy || {}));
    state.token = token;
    state.deliveryBoy = deliveryBoy || {};
  }

  function clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(META_KEY);
    state.token = "";
    state.deliveryBoy = {};
  }

  async function fetchJSON(url, opts = {}) {
    const headers = Object.assign({ "Content-Type": "application/json" }, opts.headers || {});
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(url, { ...opts, headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || "Request failed");
    return data;
  }

  async function uploadFile(endpoint, file, fieldName = "file") {
    const formData = new FormData();
    formData.append(fieldName, file);
    const token = getToken();
    const res = await fetch(`${API_BASE}${endpoint}`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || "Upload failed");
    return data;
  }

  function money(value) {
    const amount = Number(value || 0);
    return `LKR ${amount.toLocaleString()}`;
  }

  function formatDate(value) {
    if (!value) return "-";
    try {
      return new Date(value).toLocaleString();
    } catch {
      return String(value || "-");
    }
  }

  function escapeHTML(str) {
    return String(str ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function isDashboardPage() {
    return !!document.getElementById("ordersWrap");
  }

  function isLoginPage() {
    return !!document.getElementById("deliveryLoginForm");
  }

  function mountLogin() {
    const form = document.getElementById("deliveryLoginForm");
    if (!form) return;

    if (getToken()) {
      location.href = "./dashboard.html";
      return;
    }

    const status = document.getElementById("loginStatus");
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      status.className = "text-sm text-slate-400";
      status.textContent = "Signing in...";
      try {
        const out = await fetchJSON(`${API_BASE}/delivery/auth/login`, {
          method: "POST",
          body: JSON.stringify({
            username: form.username.value.trim(),
            password: form.password.value
          })
        });
        setSession(out.token, out.deliveryBoy);
        location.href = "./dashboard.html";
      } catch (err) {
        status.className = "text-sm text-red-400";
        status.textContent = "❌ " + (err.message || err);
      }
    });
  }

  function buildActivityPayload(form, extras = {}) {
    const proofUrl = form.querySelector('[name="proofImageUrl"]')?.value?.trim() || "";
    return {
      activityType: extras.activityType || "note",
      status: extras.status,
      note: form.querySelector('[name="note"]')?.value?.trim() || "",
      publicNote: form.querySelector('[name="publicNote"]')?.value?.trim() || "",
      issueReason: form.querySelector('[name="issueReason"]')?.value?.trim() || "",
      proofRecipientName: form.querySelector('[name="proofRecipientName"]')?.value?.trim() || "",
      verificationCodeInput: form.querySelector('[name="verificationCodeInput"]')?.value?.trim() || "",
      proofImageUrl: proofUrl
    };
  }

  function renderStats() {
    const container = document.getElementById("statsGrid");
    if (!container || !state.stats) return;

    const cards = [
      ["Assigned jobs", state.stats.assigned || 0],
      ["In transit", state.stats.inTransit || 0],
      ["Today stops", state.stats.todayStops || 0],
      ["Completed", state.stats.completed || 0]
    ];

    container.innerHTML = cards.map(([label, value]) => `
      <div class="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div class="text-sm text-slate-500">${escapeHTML(label)}</div>
        <div class="mt-2 text-3xl font-semibold text-slate-900">${escapeHTML(String(value))}</div>
      </div>
    `).join("");
  }

  function renderOrders() {
    const wrap = document.getElementById("ordersWrap");
    const statusEl = document.getElementById("ordersStatus");
    if (!wrap) return;

    statusEl.textContent = `${state.orders.length} order(s) in ${state.view} view.`;

    if (!state.orders.length) {
      wrap.innerHTML = `<div class="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">No orders found for this filter.</div>`;
      return;
    }

    wrap.innerHTML = state.orders.map((order) => {
      const delivery = order.delivery || {};
      const items = (order.items || []).map((item) => `<li>${escapeHTML(item.name)} × ${Number(item.qty || 0)}</li>`).join("") || "<li>No items</li>";
      const activityLogs = [...(delivery.activityLogs || [])]
        .sort((a, b) => new Date(b?.createdAt || 0) - new Date(a?.createdAt || 0))
        .slice(0, 5)
        .map((log) => `
          <div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
            <div class="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <div class="font-medium text-slate-900">${escapeHTML((log?.activityType || "note").replaceAll("_", " "))}</div>
                <div class="text-xs text-slate-500 mt-1">${escapeHTML(formatDate(log?.createdAt))}</div>
              </div>
              ${log?.deliveryStatus ? `<span class="inline-flex rounded-full bg-white px-2.5 py-1 text-xs text-slate-700 border border-slate-200">${escapeHTML(DELIVERY_STATUS_META[log.deliveryStatus] || log.deliveryStatus)}</span>` : ""}
            </div>
            ${log?.note ? `<div class="mt-2 whitespace-pre-wrap">${escapeHTML(log.note)}</div>` : ""}
          </div>
        `).join("") || `<div class="text-sm text-slate-500">No activity logs yet.</div>`;

      return `
        <article class="rounded-3xl border border-slate-200 bg-slate-50 p-4 shadow-sm" data-order-card="${escapeHTML(order._id)}">
          <div class="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div class="text-lg font-semibold text-slate-900">${escapeHTML(order.orderNumber || "-")}</div>
              <div class="mt-1 text-sm text-slate-500">${escapeHTML(order.customerName || "-")} • ${escapeHTML(order.phone || "-")}</div>
              <div class="mt-1 text-xs text-slate-500">${escapeHTML(order.address || "No address")}</div>
            </div>
            <div class="flex items-center gap-2 flex-wrap justify-end">
              <span class="inline-flex rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700 border border-slate-200">${escapeHTML(DELIVERY_STATUS_META[delivery.status] || delivery.status || "pending")}</span>
              <span class="inline-flex rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700 border border-slate-200">${escapeHTML(ASSIGNMENT_STATUS_META[delivery.assignmentStatus] || delivery.assignmentStatus || "assigned")}</span>
            </div>
          </div>

          <div class="mt-4 grid grid-cols-1 md:grid-cols-4 gap-3 text-sm text-slate-700">
            <div class="rounded-2xl border border-slate-200 bg-white p-3"><div class="text-xs text-slate-500">Schedule</div><div class="mt-1 font-semibold text-slate-900">${escapeHTML(delivery.scheduledDate ? formatDate(delivery.scheduledDate) : "Not scheduled")}</div><div class="mt-1 text-xs text-slate-500">${escapeHTML(delivery.scheduledWindow || "-")}</div></div>
            <div class="rounded-2xl border border-slate-200 bg-white p-3"><div class="text-xs text-slate-500">Route</div><div class="mt-1 font-semibold text-slate-900">${escapeHTML(delivery.routeZone || "Not set")}</div><div class="mt-1 text-xs text-slate-500">Stop ${escapeHTML(String(delivery.routeSequence || 0))}</div></div>
            <div class="rounded-2xl border border-slate-200 bg-white p-3"><div class="text-xs text-slate-500">Balance due</div><div class="mt-1 font-semibold text-slate-900">${escapeHTML(money(order.balanceDueLKR || 0))}</div><div class="mt-1 text-xs text-slate-500">${escapeHTML(delivery.balanceCollectionMode || "to_be_confirmed")}</div></div>
            <div class="rounded-2xl border border-slate-200 bg-white p-3"><div class="text-xs text-slate-500">Customer code</div><div class="mt-1 font-semibold tracking-wider text-slate-900">${escapeHTML(delivery.verificationCode || "----")}</div><div class="mt-1 text-xs text-slate-500">Verify only at handover</div></div>
          </div>

          <div class="mt-4 grid grid-cols-1 xl:grid-cols-[1.4fr,1fr] gap-4">
            <div class="space-y-4">
              <div class="rounded-2xl border border-slate-200 bg-white p-4">
                <div class="text-sm font-semibold text-slate-900">Order items</div>
                <ul class="mt-3 space-y-2 text-sm text-slate-700 list-disc list-inside">${items}</ul>
              </div>

              <div class="rounded-2xl border border-slate-200 bg-white p-4">
                <div class="text-sm font-semibold text-slate-900">Activity form</div>
                <div class="mt-1 text-xs text-slate-500">Use quick actions for the main status change, or save a note-only activity if you just want to update admin.</div>
                <form class="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3" data-activity-form>
                  <div class="md:col-span-2">
                    <label class="text-xs font-medium text-slate-700">Internal note</label>
                    <textarea name="note" rows="2" class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"></textarea>
                  </div>
                  <div class="md:col-span-2">
                    <label class="text-xs font-medium text-slate-700">Customer-visible note</label>
                    <textarea name="publicNote" rows="2" class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm">${escapeHTML(delivery.publicNote || "")}</textarea>
                  </div>
                  <div>
                    <label class="text-xs font-medium text-slate-700">Issue reason</label>
                    <input name="issueReason" type="text" value="${escapeHTML(delivery.issueReason || "")}" placeholder="Road blocked / customer unavailable" class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label class="text-xs font-medium text-slate-700">Proof recipient</label>
                    <input name="proofRecipientName" type="text" value="${escapeHTML(delivery.proofRecipientName || "")}" placeholder="Who received the items?" class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label class="text-xs font-medium text-slate-700">Customer verification code</label>
                    <input name="verificationCodeInput" type="text" placeholder="Enter only at handover" class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
                  </div>
                  <div class="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3">
                    <input type="hidden" name="proofImageUrl" value="${escapeHTML(delivery.proofImageUrl || "")}" />
                    <div class="flex items-center gap-3 flex-wrap">
                      <input type="file" data-proof-file accept="image/png,image/jpeg,image/webp" class="text-sm" />
                      <button type="button" data-upload-proof class="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Upload proof</button>
                      <span data-upload-status class="text-xs text-slate-500"></span>
                    </div>
                    <div data-proof-preview class="mt-3">${delivery.proofImageUrl ? `<a href="${escapeHTML(delivery.proofImageUrl)}" target="_blank" rel="noopener noreferrer" class="block h-24 w-24 overflow-hidden rounded-xl border border-slate-200"><img src="${escapeHTML(delivery.proofImageUrl)}" alt="proof" class="h-full w-full object-cover"></a>` : `<div class="text-xs text-slate-500">No proof image uploaded yet.</div>`}</div>
                  </div>
                  <div class="md:col-span-2 flex flex-wrap gap-2 pt-2">
                    <button type="button" data-activity="accepted" class="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Accept Job</button>
                    <button type="button" data-status="packed" class="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Packed</button>
                    <button type="button" data-status="out_for_delivery" class="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Out for Delivery</button>
                    <button type="button" data-status="arriving_soon" class="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Arriving Soon</button>
                    <button type="button" data-status="delivery_issue" class="rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800 hover:bg-amber-100">Report Issue</button>
                    <button type="button" data-status="delivered" class="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500">Delivered</button>
                    <button type="button" data-activity="note" class="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">Log Note Only</button>
                  </div>
                  <div data-form-status class="md:col-span-2 text-sm text-slate-500"></div>
                </form>
              </div>
            </div>

            <div class="space-y-4">
              <div class="rounded-2xl border border-slate-200 bg-white p-4">
                <div class="text-sm font-semibold text-slate-900">Site / unloading details</div>
                <div class="mt-3 space-y-2 text-sm text-slate-700">
                  <div><b>Site contact:</b> ${escapeHTML(delivery.siteContactName || order.customerName || "-")}</div>
                  <div><b>Phone:</b> ${escapeHTML(delivery.siteContactPhone || order.phone || "-")}</div>
                  <div><b>Call before delivery:</b> ${delivery.requiresCallBeforeDelivery === false ? "No" : "Yes"}</div>
                  <div><b>Unloading:</b> ${escapeHTML(delivery.unloadingSupport || "unsure")}</div>
                  <div><b>Access notes:</b> ${escapeHTML(delivery.accessNotes || "No note")}</div>
                </div>
              </div>

              <div class="rounded-2xl border border-slate-200 bg-white p-4">
                <div class="text-sm font-semibold text-slate-900">Recent activity history</div>
                <div class="mt-3 space-y-2">${activityLogs}</div>
              </div>
            </div>
          </div>
        </article>
      `;
    }).join("");

    wrap.querySelectorAll("[data-order-card]").forEach((card) => {
      const orderId = card.getAttribute("data-order-card");
      const form = card.querySelector("[data-activity-form]");
      const fileInput = form.querySelector("[data-proof-file]");
      const uploadBtn = form.querySelector("[data-upload-proof]");
      const uploadStatus = form.querySelector("[data-upload-status]");
      const preview = form.querySelector("[data-proof-preview]");
      const formStatus = form.querySelector("[data-form-status]");
      const proofUrlInput = form.querySelector('[name="proofImageUrl"]');

      uploadBtn.onclick = async () => {
        const file = fileInput?.files?.[0];
        if (!file) {
          uploadStatus.textContent = "Choose an image first.";
          return;
        }
        uploadStatus.textContent = "Uploading...";
        try {
          const out = await uploadFile(`/uploads/delivery-proof`, file);
          const url = out?.file?.url || "";
          proofUrlInput.value = url;
          preview.innerHTML = url
            ? `<a href="${escapeHTML(url)}" target="_blank" rel="noopener noreferrer" class="block h-24 w-24 overflow-hidden rounded-xl border border-slate-200"><img src="${escapeHTML(url)}" alt="proof" class="h-full w-full object-cover"></a>`
            : `<div class="text-xs text-slate-500">No proof image uploaded yet.</div>`;
          uploadStatus.textContent = "✅ Proof uploaded";
        } catch (err) {
          uploadStatus.textContent = "❌ " + (err.message || err);
        }
      };

      const sendActivity = async (extras = {}) => {
        formStatus.className = "md:col-span-2 text-sm text-slate-500";
        formStatus.textContent = "Saving activity...";
        try {
          await fetchJSON(`${API_BASE}/delivery/orders/${orderId}/activity`, {
            method: "POST",
            body: JSON.stringify(buildActivityPayload(form, extras))
          });
          formStatus.className = "md:col-span-2 text-sm text-emerald-700";
          formStatus.textContent = "Activity saved.";
          await loadDashboard(state.view);
        } catch (err) {
          formStatus.className = "md:col-span-2 text-sm text-red-600";
          formStatus.textContent = "❌ " + (err.message || err);
        }
      };

      form.querySelectorAll("[data-status]").forEach((btn) => {
        btn.addEventListener("click", () => sendActivity({ status: btn.getAttribute("data-status") }));
      });
      form.querySelectorAll("[data-activity]").forEach((btn) => {
        btn.addEventListener("click", () => sendActivity({ activityType: btn.getAttribute("data-activity") }));
      });
    });
  }

  async function loadDashboard(view = state.view) {
    state.view = view;
    const metaEl = document.getElementById("deliveryMeta");
    const availabilitySelect = document.getElementById("availabilitySelect");
    const statusEl = document.getElementById("ordersStatus");
    if (statusEl) statusEl.textContent = "Loading jobs...";

    const [profileOut, ordersOut] = await Promise.all([
      fetchJSON(`${API_BASE}/delivery/me`),
      fetchJSON(`${API_BASE}/delivery/orders?view=${encodeURIComponent(view)}`)
    ]);

    state.deliveryBoy = profileOut.deliveryBoy || state.deliveryBoy;
    state.stats = ordersOut.stats || profileOut.stats || state.stats;
    state.orders = ordersOut.items || [];

    localStorage.setItem(META_KEY, JSON.stringify(state.deliveryBoy || {}));

    metaEl.textContent = `${state.deliveryBoy.fullName || "Delivery rider"} • @${state.deliveryBoy.username || "-"} • ${AVAILABILITY_META[state.deliveryBoy.availabilityStatus] || state.deliveryBoy.availabilityStatus || "Available"}`;
    availabilitySelect.value = state.deliveryBoy.availabilityStatus || "available";

    document.querySelectorAll(".delivery-view-btn").forEach((btn) => {
      const active = btn.getAttribute("data-view") === view;
      btn.className = active
        ? "delivery-view-btn rounded-xl border border-slate-300 bg-slate-900 px-4 py-2 text-sm font-medium text-white"
        : "delivery-view-btn rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50";
    });

    renderStats();
    renderOrders();
  }

  function mountDashboard() {
    if (!isDashboardPage()) return;
    if (!getToken()) {
      location.href = "./login.html";
      return;
    }

    document.getElementById("logoutDeliveryBtn")?.addEventListener("click", () => {
      clearSession();
      location.href = "./login.html";
    });

    document.querySelectorAll(".delivery-view-btn").forEach((btn) => {
      btn.addEventListener("click", () => loadDashboard(btn.getAttribute("data-view") || "active"));
    });

    document.getElementById("refreshOrdersBtn")?.addEventListener("click", () => loadDashboard(state.view));

    document.getElementById("saveAvailabilityBtn")?.addEventListener("click", async () => {
      const select = document.getElementById("availabilitySelect");
      try {
        await fetchJSON(`${API_BASE}/delivery/me`, {
          method: "PATCH",
          body: JSON.stringify({ availabilityStatus: select.value })
        });
        await loadDashboard(state.view);
      } catch (err) {
        alert(err.message || err);
      }
    });

    loadDashboard(state.view).catch((err) => {
      document.getElementById("ordersStatus").textContent = "❌ " + (err.message || err);
      if (/token|expired|unauthorized|invalid/i.test(String(err.message || err))) {
        clearSession();
        location.href = "./login.html";
      }
    });
  }

  function bootstrap() {
    if (isLoginPage()) mountLogin();
    if (isDashboardPage()) mountDashboard();
  }

  return { bootstrap };
})();

window.addEventListener("DOMContentLoaded", () => DeliveryPortal.bootstrap());
