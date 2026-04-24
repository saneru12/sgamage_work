/*
  Lightweight admin panel (vanilla JS) for S.Gamage Constructions
  - JWT login
  - CRUD: Services, Projects, Products
  - Manage: Inquiries, Orders, Reviews
  - Site Settings
*/

const AdminUI = (() => {
  const API_BASE = "https://sgamagework-production.up.railway.app/api";
  const TOKEN_KEY = "sg_admin_token";
  const ADMIN_KEY = "sg_admin_meta";

  const state = {
    token: null,
    admin: null,
    route: "dashboard",
    orderSearch: "",
    deliveryBoys: [],
    deliveryTeamRecentActivities: []
  };


  const PRODUCT_CATEGORY_OPTIONS = [
    "Building Materials",
    "Steel, Roofing & Ceiling",
    "Plumbing & Sanitary",
    "Electrical & Lighting",
    "Paint & Finishing",
    "Tools & Fasteners",
    "Safety & Site Essentials",
    "Tiles, Adhesives & Flooring"
  ];

  const DELIVERY_STATUS_META = {
    awaiting_advance_verification: { label: "Awaiting payment verification", hint: "Payment slip is waiting for verification before delivery planning starts." },
    confirmed: { label: "Confirmed", hint: "Order is confirmed and ready for delivery scheduling." },
    scheduling_in_progress: { label: "Scheduling in progress", hint: "The route, vehicle and delivery date are being planned." },
    scheduled: { label: "Scheduled", hint: "A delivery date / window has been committed to the customer." },
    packed: { label: "Packed", hint: "Materials are packed and waiting to be loaded." },
    out_for_delivery: { label: "Out for delivery", hint: "The owner vehicle is on the road with the delivery boy." },
    arriving_soon: { label: "Arriving soon", hint: "Customer should prepare to receive, inspect and sign for the delivery." },
    delivered: { label: "Delivered", hint: "Items were handed over at the site." },
    delivery_issue: { label: "Delivery issue", hint: "Access, customer availability or stock issues interrupted the delivery." },
    rescheduled: { label: "Rescheduled", hint: "A new slot is being coordinated with the customer." },
    cancelled: { label: "Cancelled", hint: "Delivery has been cancelled." }
  };

  const DELIVERY_TIME_SLOT_META = {
    morning_8_11: "Morning (8:00 AM - 11:00 AM)",
    midday_11_2: "Midday (11:00 AM - 2:00 PM)",
    afternoon_2_5: "Afternoon (2:00 PM - 5:00 PM)",
    full_day_8_5: "Full day route (8:00 AM - 5:00 PM)",
    call_to_confirm: "Call to confirm"
  };

  const UNLOADING_SUPPORT_META = {
    customer_team_available: "Customer team available",
    delivery_boy_only: "Delivery boy only / light unload",
    site_labour_required: "Site labour required",
    forklift_available: "Forklift / machine available",
    unsure: "Not confirmed yet"
  };

  const BALANCE_COLLECTION_META = {
    before_dispatch: "Full payment before dispatch",
    cash_on_delivery: "Cash on delivery",
    bank_transfer_before_delivery: "Bank transfer before delivery",
    card_or_transfer_on_arrival: "Card / transfer on arrival",
    already_paid: "Already fully paid",
    to_be_confirmed: "Discuss with customer"
  };

  const DELIVERY_ASSIGNMENT_STATUS_META = {
    unassigned: "Unassigned",
    assigned: "Assigned to rider",
    accepted: "Accepted by rider",
    issue_reported: "Issue reported",
    completed: "Completed"
  };

  const DELIVERY_BOY_AVAILABILITY_META = {
    available: "Available",
    on_route: "On route",
    off_duty: "Off duty",
    leave: "On leave"
  };

  const ROUTE_PRIORITY_META = {
    low: "Low",
    normal: "Normal",
    high: "High",
    urgent: "Urgent"
  };

  const DELIVERY_STATUS_OPTIONS = Object.keys(DELIVERY_STATUS_META);

  function labelFromMap(map, value, fallback = "-") {
    return map[value] || fallback;
  }

  function formatDateOnly(value) {
    try {
      return value ? new Date(value).toLocaleDateString() : "-";
    } catch {
      return value || "-";
    }
  }

  function toDateTimeLocalInput(value) {
    if (!value) return "";
    const dt = new Date(value);
    if (Number.isNaN(dt.getTime())) return "";
    const pad = (n) => String(n).padStart(2, "0");
    return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
  }

  function getDeliveryState(order = {}) {
    const src = order?.delivery || {};
    const fallbackStatus = src.status || (() => {
      const orderStatus = String(order?.status || "").toLowerCase();
      if (["delivered", "partially_returned", "returned"].includes(orderStatus)) return "delivered";
      if (orderStatus === "cancelled") return "cancelled";
      if (orderStatus === "confirmed") return "confirmed";
      if (String(order?.paymentStatus || "") === "advance_submitted") return "awaiting_advance_verification";
      if (String(order?.paymentStatus || "") === "advance_received") return "confirmed";
      return "awaiting_advance_verification";
    })();

    return {
      method: src.method || "owner_vehicle",
      serviceLabel: src.serviceLabel || "Owner vehicle delivery",
      status: fallbackStatus,
      verificationCode: src.verificationCode || "",
      verificationCodeVerifiedAt: src.verificationCodeVerifiedAt || "",
      siteContactName: src.siteContactName || order?.customerName || "",
      siteContactPhone: src.siteContactPhone || order?.phone || "",
      preferredDate: src.preferredDate || "",
      preferredTimeSlot: src.preferredTimeSlot || "call_to_confirm",
      scheduledDate: src.scheduledDate || "",
      scheduledWindow: src.scheduledWindow || labelFromMap(DELIVERY_TIME_SLOT_META, src.preferredTimeSlot || "call_to_confirm", "Call to confirm"),
      routeZone: src.routeZone || order?.address || "",
      routePriority: src.routePriority || "normal",
      routeSequence: Number(src.routeSequence || 0),
      assignedDeliveryBoyId: src.assignedDeliveryBoyId || "",
      assignedDeliveryBoyName: src.assignedDeliveryBoyName || "",
      assignedDeliveryBoyPhone: src.assignedDeliveryBoyPhone || "",
      assignedDeliveryBoyUsername: src.assignedDeliveryBoyUsername || "",
      assignmentStatus: src.assignmentStatus || (src.assignedDeliveryBoyId ? "assigned" : "unassigned"),
      assignmentNote: src.assignmentNote || "",
      assignedAt: src.assignedAt || "",
      acceptedAt: src.acceptedAt || "",
      deliveryBoyCompletedAt: src.deliveryBoyCompletedAt || "",
      driverName: src.driverName || "",
      driverPhone: src.driverPhone || "",
      vehicleNumber: src.vehicleNumber || "",
      accessNotes: src.accessNotes || "",
      requiresCallBeforeDelivery: src.requiresCallBeforeDelivery !== false,
      unloadingSupport: src.unloadingSupport || "unsure",
      balanceCollectionMode: src.balanceCollectionMode || "to_be_confirmed",
      allowSplitDelivery: src.allowSplitDelivery !== false,
      publicNote: src.publicNote || "",
      adminNote: src.adminNote || "",
      issueReason: src.issueReason || "",
      proofImageUrl: src.proofImageUrl || "",
      proofRecipientName: src.proofRecipientName || "",
      events: Array.isArray(src.events) ? src.events : [],
      activityLogs: Array.isArray(src.activityLogs) ? src.activityLogs : []
    };
  }

  function isFullPaymentOrder(order = {}) {
    const delivery = getDeliveryState(order);
    return String(delivery.balanceCollectionMode || "") === "before_dispatch" && Number(order?.balanceDueLKR || 0) === 0;
  }

  function renderDeliveryBoySummaryCard(deliveryBoyId) {
    const selected = (state.deliveryBoys || []).find((boy) => String(boy?._id || "") === String(deliveryBoyId || ""));
    if (!selected) {
      return `<div class="text-xs text-slate-500">No internal delivery boy is assigned yet. You can still save manual driver details, or select a rider from the team.</div>`;
    }

    const areas = (selected.serviceAreas || []).map((area) => `<span class="px-2 py-1 rounded-full bg-slate-100 text-slate-700 text-xs">${escapeHTML(area)}</span>`).join(" ") || `<span class="text-xs text-slate-500">No service areas saved</span>`;
    return `
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-slate-700">
        <div class="rounded-xl border border-slate-200 bg-white p-3">
          <div class="text-xs text-slate-500">Assigned rider</div>
          <div class="mt-1 font-semibold text-slate-900">${escapeHTML(selected.fullName || "-")}</div>
          <div class="mt-1 text-xs text-slate-500">@${escapeHTML(selected.username || "-")}</div>
          <div class="mt-2">${escapeHTML(selected.phone || "-")}</div>
        </div>
        <div class="rounded-xl border border-slate-200 bg-white p-3">
          <div class="text-xs text-slate-500">Vehicle / workload</div>
          <div class="mt-1 font-semibold text-slate-900">${escapeHTML(selected.vehicleNumber || "Vehicle not set")}</div>
          <div class="mt-2 text-xs text-slate-500">${escapeHTML(DELIVERY_BOY_AVAILABILITY_META[selected.availabilityStatus] || selected.availabilityStatus || "Available")} • ${Number(selected?.stats?.activeAssignments || 0)} active job(s)</div>
          <div class="mt-2 flex flex-wrap gap-1">${areas}</div>
        </div>
      </div>
    `;
  }

  function renderAdminDeliverySection(order) {
    const delivery = getDeliveryState(order);
    const statusMeta = DELIVERY_STATUS_META[delivery.status] || DELIVERY_STATUS_META.awaiting_advance_verification;
    const driverSummary = [delivery.driverName, delivery.driverPhone, delivery.vehicleNumber ? `Vehicle ${delivery.vehicleNumber}` : ""].filter(Boolean).join(" • ") || "Driver / vehicle not assigned yet";
    const scheduleSummary = delivery.scheduledDate
      ? `${formatDate(delivery.scheduledDate)}${delivery.scheduledWindow ? ` • ${delivery.scheduledWindow}` : ""}`
      : delivery.preferredDate
      ? `Preferred ${formatDateOnly(delivery.preferredDate)} • ${labelFromMap(DELIVERY_TIME_SLOT_META, delivery.preferredTimeSlot, "Call to confirm")}`
      : "Schedule not confirmed yet";
    const assignmentLabel = labelFromMap(DELIVERY_ASSIGNMENT_STATUS_META, delivery.assignmentStatus, "Unassigned");
    const activityTimeline = [...delivery.activityLogs]
      .sort((a, b) => new Date(b?.createdAt || 0) - new Date(a?.createdAt || 0))
      .map((log) => `
        <div class="rounded-xl border border-slate-200 bg-white px-3 py-3">
          <div class="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div class="text-sm font-medium text-slate-900">${escapeHTML((log?.activityType || "note").replaceAll("_", " "))}</div>
              <div class="text-xs text-slate-500 mt-1">${escapeHTML(formatDate(log?.createdAt))} • ${escapeHTML(log?.actorRole === "delivery_boy" ? `Rider: ${log?.actorName || "-"}` : log?.actorName || "admin")}</div>
            </div>
            ${log?.deliveryStatus ? `<div class="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700">${escapeHTML(DELIVERY_STATUS_META[log.deliveryStatus]?.label || log.deliveryStatus)}</div>` : ""}
          </div>
          ${log?.note ? `<div class="mt-2 text-sm text-slate-700 whitespace-pre-wrap">${escapeHTML(log.note)}</div>` : ""}
          ${log?.publicNote ? `<div class="mt-2 text-xs text-blue-700 whitespace-pre-wrap"><b>Customer note:</b> ${escapeHTML(log.publicNote)}</div>` : ""}
          <div class="mt-2 text-xs text-slate-500 flex gap-3 flex-wrap">
            ${log?.recipientName ? `<span>Recipient: ${escapeHTML(log.recipientName)}</span>` : ""}
            ${log?.verificationCodeChecked ? `<span>Code verified</span>` : ""}
          </div>
          ${log?.proofImageUrl ? `<a href="${escapeHTML(log.proofImageUrl)}" target="_blank" rel="noopener noreferrer" class="mt-3 inline-flex rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50">View proof image</a>` : ""}
        </div>
      `)
      .join("") || `<div class="text-sm text-slate-500">No delivery-boy activity logs yet.</div>`;
    const timeline = [...delivery.events]
      .sort((a, b) => new Date(b?.createdAt || 0) - new Date(a?.createdAt || 0))
      .map((event) => `
        <div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
          <div class="text-sm font-medium text-slate-900">${escapeHTML(event?.title || DELIVERY_STATUS_META[event?.status]?.label || "Delivery update")}</div>
          <div class="text-xs text-slate-500 mt-1">${escapeHTML(formatDate(event?.createdAt))}${event?.actor ? ` • ${escapeHTML(event.actor)}` : ""}</div>
          ${event?.note ? `<div class="text-xs text-slate-600 mt-2 whitespace-pre-wrap">${escapeHTML(event.note)}</div>` : ""}
        </div>
      `)
      .join("") || `<div class="text-sm text-slate-500">No delivery timeline items yet.</div>`;
    const deliveryBoyOptions = (state.deliveryBoys || [])
      .map((boy) => `<option value="${escapeHTML(boy._id)}" ${String(boy._id) === String(delivery.assignedDeliveryBoyId || "") ? "selected" : ""}>${escapeHTML(boy.fullName)} • ${escapeHTML(DELIVERY_BOY_AVAILABILITY_META[boy.availabilityStatus] || boy.availabilityStatus || "available")}</option>`)
      .join("");

    return `
      <div class="rounded-2xl border border-slate-200 p-4 bg-slate-50 space-y-4">
        <div class="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div class="text-sm font-semibold text-slate-900">Own vehicle delivery control</div>
            <div class="text-xs text-slate-500 mt-1">${escapeHTML(statusMeta.hint || "Delivery process will appear here.")}</div>
          </div>
          <div class="flex items-center gap-2 flex-wrap justify-end">
            <div class="inline-flex rounded-full bg-slate-900 px-3 py-1 text-xs font-medium text-white">${escapeHTML(statusMeta.label)}</div>
            <div class="inline-flex rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700 border border-slate-200">${escapeHTML(assignmentLabel)}</div>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div class="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700"><div class="text-xs text-slate-500">Service</div><div class="mt-1 font-semibold text-slate-900">${escapeHTML(delivery.serviceLabel)}</div></div>
          <div class="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700"><div class="text-xs text-slate-500">Schedule</div><div class="mt-1 font-semibold text-slate-900">${escapeHTML(scheduleSummary)}</div></div>
          <div class="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700"><div class="text-xs text-slate-500">Route zone / address</div><div class="mt-1 font-semibold text-slate-900">${escapeHTML(delivery.routeZone || order?.address || "Not set")}</div></div>
          <div class="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700"><div class="text-xs text-slate-500">Priority</div><div class="mt-1 font-semibold text-slate-900">${escapeHTML(labelFromMap(ROUTE_PRIORITY_META, delivery.routePriority, "Normal"))}</div></div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-3 text-sm text-slate-700">
          <div class="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
            <div><b>Site contact:</b> ${escapeHTML(delivery.siteContactName || order?.customerName || "-")}</div>
            <div><b>Phone:</b> ${escapeHTML(delivery.siteContactPhone || order?.phone || "-")}</div>
            <div><b>Preferred slot:</b> ${escapeHTML(labelFromMap(DELIVERY_TIME_SLOT_META, delivery.preferredTimeSlot, "Call to confirm"))}</div>
            <div><b>Call before delivery:</b> ${delivery.requiresCallBeforeDelivery === false ? "No" : "Yes"}</div>
            <div><b>Split delivery:</b> ${delivery.allowSplitDelivery === false ? "No - full order together" : "Yes - ready stock can move first"}</div>
            <div><b>Access notes:</b> ${escapeHTML(delivery.accessNotes || "No note added yet")}</div>
          </div>
          <div class="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
            <div><b>Driver / vehicle:</b> ${escapeHTML(driverSummary)}</div>
            <div><b>Assigned rider:</b> ${escapeHTML(delivery.assignedDeliveryBoyName || "No internal rider selected")}${delivery.assignedDeliveryBoyUsername ? ` • @${escapeHTML(delivery.assignedDeliveryBoyUsername)}` : ""}</div>
            <div><b>Verification code:</b> <span class="font-semibold tracking-wider">${escapeHTML(delivery.verificationCode || "----")}</span></div>
            <div><b>Code verification:</b> ${delivery.verificationCodeVerifiedAt ? escapeHTML(formatDate(delivery.verificationCodeVerifiedAt)) : "Not verified yet"}</div>
            ${delivery.proofRecipientName ? `<div><b>Received by:</b> ${escapeHTML(delivery.proofRecipientName)}</div>` : ""}
            ${delivery.issueReason ? `<div><b>Issue logged:</b> ${escapeHTML(delivery.issueReason)}</div>` : ""}
            ${delivery.publicNote ? `<div class="whitespace-pre-wrap"><b>Customer-visible note:</b> ${escapeHTML(delivery.publicNote)}</div>` : ""}
            ${delivery.adminNote ? `<div class="whitespace-pre-wrap"><b>Internal note:</b> ${escapeHTML(delivery.adminNote)}</div>` : ""}
          </div>
        </div>

        ${delivery.proofImageUrl ? `
          <div class="rounded-xl border border-slate-200 bg-white p-3">
            <div class="text-xs font-medium text-slate-700">Current delivery proof</div>
            <a href="${escapeHTML(delivery.proofImageUrl)}" target="_blank" rel="noopener noreferrer" class="mt-3 block h-32 w-32 overflow-hidden rounded-xl border border-slate-200">
              <img src="${escapeHTML(delivery.proofImageUrl)}" alt="Delivery proof" class="h-full w-full object-cover" />
            </a>
          </div>
        ` : ""}

        <div class="rounded-xl border border-slate-200 bg-white p-4">
          <div class="text-sm font-semibold text-slate-900">Update delivery / dispatch</div>
          <div class="text-xs text-slate-500 mt-1">Assign a delivery boy, group jobs by route zone, and capture every rider activity so the admin can audit completed tasks later.</div>
          <form data-delivery-form class="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-slate-700">
            <div>
              <label class="text-xs font-medium text-slate-700">Delivery status</label>
              <select name="status" class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm">
                ${DELIVERY_STATUS_OPTIONS.map((value) => `<option value="${value}" ${delivery.status === value ? "selected" : ""}>${escapeHTML(DELIVERY_STATUS_META[value]?.label || value)}</option>`).join("")}
              </select>
            </div>
            <div>
              <label class="text-xs font-medium text-slate-700">Scheduled date & time</label>
              <input name="scheduledDate" type="datetime-local" value="${escapeHTML(toDateTimeLocalInput(delivery.scheduledDate))}" class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label class="text-xs font-medium text-slate-700">Scheduled window / route note</label>
              <input name="scheduledWindow" type="text" value="${escapeHTML(delivery.scheduledWindow)}" placeholder="Auto-filled from preferred time slot (editable)" class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label class="text-xs font-medium text-slate-700">Verification code check (optional)</label>
              <input name="verificationCodeInput" type="text" placeholder="Ask customer for code at handover" class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label class="text-xs font-medium text-slate-700">Assign delivery boy</label>
              <select name="deliveryBoyId" class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm">
                <option value="">Manual / not assigned</option>
                ${deliveryBoyOptions}
              </select>
              <div class="mt-2 flex items-center gap-2 flex-wrap">
                <button type="button" data-assignment-suggest class="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50">Suggest best rider</button>
                <span data-assignment-suggest-status class="text-xs text-slate-500"></span>
              </div>
            </div>
            <div>
              <label class="text-xs font-medium text-slate-700">Assignment status</label>
              <select name="assignmentStatus" class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm">
                ${Object.entries(DELIVERY_ASSIGNMENT_STATUS_META).map(([value, label]) => `<option value="${value}" ${delivery.assignmentStatus === value ? "selected" : ""}>${escapeHTML(label)}</option>`).join("")}
              </select>
            </div>
            <div>
              <label class="text-xs font-medium text-slate-700">Route zone / area</label>
              <input name="routeZone" type="text" value="${escapeHTML(delivery.routeZone || order?.address || "")}" placeholder="Auto-filled from customer delivery address" class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label class="text-xs font-medium text-slate-700">Route priority</label>
              <select name="routePriority" class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm">
                ${Object.entries(ROUTE_PRIORITY_META).map(([value, label]) => `<option value="${value}" ${delivery.routePriority === value ? "selected" : ""}>${escapeHTML(label)}</option>`).join("")}
              </select>
            </div>
            <div>
              <label class="text-xs font-medium text-slate-700">Vehicle number</label>
              <input name="vehicleNumber" type="text" value="${escapeHTML(delivery.vehicleNumber)}" class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div class="md:col-span-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3">
              <div class="text-xs font-medium text-slate-700">Selected rider summary</div>
              <div data-delivery-boy-summary class="mt-2">${renderDeliveryBoySummaryCard(delivery.assignedDeliveryBoyId)}</div>
            </div>
            <div>
              <label class="text-xs font-medium text-slate-700">Driver name</label>
              <input name="driverName" type="text" value="${escapeHTML(delivery.driverName)}" class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label class="text-xs font-medium text-slate-700">Driver phone</label>
              <input name="driverPhone" type="text" value="${escapeHTML(delivery.driverPhone)}" class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label class="text-xs font-medium text-slate-700">Proof recipient name</label>
              <input name="proofRecipientName" type="text" value="${escapeHTML(delivery.proofRecipientName)}" placeholder="Who received the materials?" class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label class="text-xs font-medium text-slate-700">Site contact name</label>
              <input name="siteContactName" type="text" value="${escapeHTML(delivery.siteContactName)}" class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label class="text-xs font-medium text-slate-700">Site contact phone</label>
              <input name="siteContactPhone" type="text" value="${escapeHTML(delivery.siteContactPhone)}" class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label class="text-xs font-medium text-slate-700">Unloading support</label>
              <select name="unloadingSupport" class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm">
                ${Object.entries(UNLOADING_SUPPORT_META).map(([value, label]) => `<option value="${value}" ${delivery.unloadingSupport === value ? "selected" : ""}>${escapeHTML(label)}</option>`).join("")}
              </select>
            </div>
            <div>
              <label class="text-xs font-medium text-slate-700">Balance collection mode</label>
              <select name="balanceCollectionMode" class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm">
                ${Object.entries(BALANCE_COLLECTION_META).map(([value, label]) => `<option value="${value}" ${delivery.balanceCollectionMode === value ? "selected" : ""}>${escapeHTML(label)}</option>`).join("")}
              </select>
            </div>
            <label class="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" name="requiresCallBeforeDelivery" ${delivery.requiresCallBeforeDelivery ? "checked" : ""} class="h-4 w-4 rounded border-slate-300" />
              <span>Call before dispatch / arrival</span>
            </label>
            <label class="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" name="allowSplitDelivery" ${delivery.allowSplitDelivery ? "checked" : ""} class="h-4 w-4 rounded border-slate-300" />
              <span>Split delivery allowed</span>
            </label>
            <div class="md:col-span-2">
              <label class="text-xs font-medium text-slate-700">Assignment / dispatch note</label>
              <textarea name="assignmentNote" rows="2" class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm">${escapeHTML(delivery.assignmentNote)}</textarea>
            </div>
            <div class="md:col-span-2">
              <label class="text-xs font-medium text-slate-700">Access / unloading notes</label>
              <textarea name="accessNotes" rows="2" class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm">${escapeHTML(delivery.accessNotes)}</textarea>
            </div>
            <div>
              <label class="text-xs font-medium text-slate-700">Issue reason (if blocked)</label>
              <input name="issueReason" type="text" value="${escapeHTML(delivery.issueReason)}" placeholder="No one on site / road blocked / stock pending" class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label class="text-xs font-medium text-slate-700">Timeline note</label>
              <input name="eventNote" type="text" placeholder="Short update to appear in timeline" class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div class="md:col-span-2">
              <label class="text-xs font-medium text-slate-700">Customer-visible note</label>
              <textarea name="publicNote" rows="2" class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm">${escapeHTML(delivery.publicNote)}</textarea>
            </div>
            <div class="md:col-span-2">
              <label class="text-xs font-medium text-slate-700">Internal admin note</label>
              <textarea name="adminNote" rows="2" class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm">${escapeHTML(delivery.adminNote)}</textarea>
            </div>
            <div class="md:col-span-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3">
              <div class="flex items-center gap-3 flex-wrap">
                <input type="hidden" name="proofImageUrl" value="${escapeHTML(delivery.proofImageUrl)}" />
                <input type="file" data-delivery-proof-file accept="image/png,image/jpeg,image/webp" class="text-sm" />
                <button type="button" data-delivery-upload class="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50">Upload delivery proof</button>
                <span data-delivery-upload-status class="text-sm text-slate-500"></span>
              </div>
              <div data-delivery-proof-preview class="mt-3">${delivery.proofImageUrl ? `<a href="${escapeHTML(delivery.proofImageUrl)}" target="_blank" rel="noopener noreferrer" class="block h-24 w-24 overflow-hidden rounded-xl border border-slate-200"><img src="${escapeHTML(delivery.proofImageUrl)}" alt="Delivery proof" class="h-full w-full object-cover" /></a>` : `<div class="text-xs text-slate-500">No delivery proof uploaded yet.</div>`}</div>
            </div>
            <div class="md:col-span-2 flex items-center gap-3 flex-wrap">
              <button type="submit" class="px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-medium hover:bg-slate-800">Save Delivery Update</button>
              <div data-delivery-status-box class="text-sm text-slate-600"></div>
            </div>
          </form>
        </div>

        <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div class="rounded-xl border border-slate-200 bg-white p-4">
            <div class="text-sm font-semibold text-slate-900">Customer timeline</div>
            <div class="mt-3 space-y-2">${timeline}</div>
          </div>
          <div class="rounded-xl border border-slate-200 bg-white p-4">
            <div class="text-sm font-semibold text-slate-900">Delivery-boy activity log</div>
            <div class="mt-3 space-y-2">${activityTimeline}</div>
          </div>
        </div>
      </div>
    `;
  }

  function getToken() {
    return localStorage.getItem(TOKEN_KEY) || "";
  }

  function setSession(token, admin) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(ADMIN_KEY, JSON.stringify(admin || {}));
  }

  function clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(ADMIN_KEY);
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

  async function uploadAdminFile(endpoint, file, fieldName = "file") {
    const token = getToken();
    const formData = new FormData();
    formData.append(fieldName, file);

    const res = await fetch(`${API_BASE}${endpoint}`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || "Upload failed");
    return data;
  }

  function el(tag, cls = "", html = "") {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html) e.innerHTML = html;
    return e;
  }

  function money(n) {
    const v = Number(n || 0);
    return `LKR ${v.toLocaleString()}`;
  }

  function formatDate(d) {
    try {
      return new Date(d).toLocaleString();
    } catch {
      return d || "";
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

  // ---------- Login ----------
  function mountLogin() {
    const form = document.getElementById("loginForm");
    const status = document.getElementById("status");

    // Already logged in
    if (getToken()) {
      location.href = "./index.html";
      return;
    }

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      status.className = "text-sm text-slate-600";
      status.textContent = "Signing in...";
      const payload = {
        username: form.username.value.trim(),
        password: form.password.value
      };
      try {
        const out = await fetchJSON(`${API_BASE}/auth/login`, {
          method: "POST",
          body: JSON.stringify(payload)
        });
        setSession(out.token, out.admin);
        location.href = "./index.html";
      } catch (err) {
        status.className = "text-sm text-red-600";
        status.textContent = "❌ " + err.message;
      }
    });
  }

  // ---------- App shell ----------
  const ROUTES = [
    { key: "dashboard", label: "Dashboard" },
    { key: "services", label: "Services" },
    { key: "projects", label: "Projects" },
    { key: "products", label: "Products" },
    { key: "jobs", label: "Jobs" },
    { key: "applications", label: "Job Applications" },
    { key: "inquiries", label: "Inquiries" },
    { key: "orders", label: "Orders" },
    { key: "deliveryTeam", label: "Delivery Team" },
    { key: "reviews", label: "Reviews" },
    { key: "settings", label: "Settings" }
  ];

  function mountApp() {
    state.token = getToken();
    state.admin = JSON.parse(localStorage.getItem(ADMIN_KEY) || "{}");
    if (!state.token) {
      location.href = "./login.html";
      return;
    }

    // Auto-logout when the admin page is left (e.g., browser Back button, tab close)
    const autoLogout = () => {
      try { clearSession(); } catch (e) {}
    };
    window.addEventListener("pagehide", autoLogout);
    window.addEventListener("beforeunload", autoLogout);

    const adminUser = document.getElementById("adminUser");
    adminUser.textContent = state.admin.displayName ? `${state.admin.displayName} (${state.admin.username})` : (state.admin.username || "admin");

    document.getElementById("logoutBtn").addEventListener("click", () => {
      clearSession();
      location.href = "./login.html";
    });

    const nav = document.getElementById("nav");
    nav.innerHTML = "";
    for (const r of ROUTES) {
      const a = el(
        "a",
        "block px-3 py-2 rounded-xl text-sm hover:bg-slate-100 text-slate-700",
        r.label
      );
      a.href = `#${r.key}`;
      nav.appendChild(a);
    }

    function onRoute() {
      const hash = (location.hash || "#dashboard").slice(1);
      state.route = ROUTES.some(r => r.key === hash) ? hash : "dashboard";
      [...nav.querySelectorAll("a")].forEach(a => {
        const active = a.getAttribute("href") === `#${state.route}`;
        a.className = active
          ? "block px-3 py-2 rounded-xl text-sm bg-slate-900 text-white"
          : "block px-3 py-2 rounded-xl text-sm hover:bg-slate-100 text-slate-700";
      });
      renderRoute();
    }

    window.addEventListener("hashchange", onRoute);
    onRoute();
  }

  function setHeader(title, actionsHtml = "") {
    const header = document.getElementById("pageHeader");
    header.innerHTML = `
      <div class="flex items-center justify-between gap-4">
        <div>
          <h1 class="text-2xl font-semibold text-slate-900">${title}</h1>
          <p class="text-sm text-slate-600">Manage your website content</p>
        </div>
        <div class="flex items-center gap-2">${actionsHtml}</div>
      </div>
    `;
  }

  function setContent(nodeOrHtml) {
    const content = document.getElementById("content");
    if (typeof nodeOrHtml === "string") content.innerHTML = nodeOrHtml;
    else {
      content.innerHTML = "";
      content.appendChild(nodeOrHtml);
    }
  }

  // ---------- Generic UI helpers ----------
  function btn(label, variant = "primary") {
    const cls = variant === "primary"
      ? "px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-medium hover:bg-slate-800"
      : variant === "danger"
      ? "px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-500"
      : "px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50";
    return el("button", cls, label);
  }

  function inputRow(label, name, value = "", type = "text", placeholder = "") {
    const wrap = el("div", "");
    wrap.innerHTML = `
      <label class="text-sm font-medium text-slate-700">${label}</label>
      <input name="${name}" type="${type}" value="${String(value ?? "").replace(/"/g, "&quot;")}" placeholder="${String(placeholder ?? "").replace(/"/g, "&quot;")}" class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-900" />
    `;
    return wrap;
  }

  function selectRow(label, name, value = "", options = []) {
    const normalized = options.map((option) => {
      if (typeof option === "string") return { value: option, label: option };
      return option;
    });

    const exists = normalized.some((option) => option.value === value);
    const items = value && !exists ? [{ value, label: `${value} (current)` }, ...normalized] : normalized;

    const wrap = el("div", "");
    wrap.innerHTML = `
      <label class="text-sm font-medium text-slate-700">${label}</label>
      <select name="${name}" class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-900">
        ${items.map((option) => `<option value="${escapeHTML(option.value)}" ${option.value === value ? "selected" : ""}>${escapeHTML(option.label)}</option>`).join("")}
      </select>
    `;
    return wrap;
  }

  function textareaRow(label, name, value = "") {
    const wrap = el("div", "");
    wrap.innerHTML = `
      <label class="text-sm font-medium text-slate-700">${label}</label>
      <textarea name="${name}" rows="4" class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-900">${value ?? ""}</textarea>
    `;
    return wrap;
  }

  function checkboxRow(label, name, checked = false) {
    const wrap = el("label", "flex items-center gap-2 text-sm text-slate-700");
    wrap.innerHTML = `
      <input type="checkbox" name="${name}" ${checked ? "checked" : ""} class="h-4 w-4 rounded border-slate-300" />
      <span>${label}</span>
    `;
    return wrap;
  }

  function modal(title, bodyNode, onSave, options = {}) {
    const maxWidthClass = options.maxWidthClass || "max-w-xl";
    const saveLabel = options.saveLabel || "Save";
    const cancelLabel = options.cancelLabel || "Cancel";
    const hideSave = !!options.hideSave;
    const closeOnOverlay = options.closeOnOverlay !== false;

    const overlay = el("div", "fixed inset-0 bg-black/40 flex items-center justify-center p-3 sm:p-4 z-50");
    const card = el("div", `w-full ${maxWidthClass} bg-white rounded-2xl shadow-lg border border-slate-200 max-h-[90vh] flex flex-col`);
    card.innerHTML = `
      <div class="p-3 border-b border-slate-200 flex items-center justify-between">
        <div class="text-base font-semibold text-slate-900">${title}</div>
        <button id="mClose" class="px-3 py-1.5 text-sm rounded-lg border border-slate-200 hover:bg-slate-50">Close</button>
      </div>
      <div class="p-3 overflow-y-auto flex-1" id="mBody"></div>
      <div class="p-3 border-t border-slate-200 flex items-center justify-end gap-2">
        <button id="mCancel" class="px-4 py-1.5 text-sm rounded-xl border border-slate-200 hover:bg-slate-50">${cancelLabel}</button>
        <button id="mSave" class="px-4 py-1.5 text-sm rounded-xl bg-slate-900 text-white hover:bg-slate-800" ${hideSave ? 'style="display:none"' : ""}>${saveLabel}</button>
      </div>
    `;
    overlay.appendChild(card);
    document.body.appendChild(overlay);
    card.querySelector("#mBody").appendChild(bodyNode);

    const close = () => {
      if (typeof options.onClose === "function") {
        try { options.onClose(); } catch (err) {}
      }
      overlay.remove();
    };

    card.querySelector("#mClose").onclick = close;
    card.querySelector("#mCancel").onclick = close;

    if (closeOnOverlay) {
      overlay.addEventListener("click", (event) => {
        if (event.target === overlay) close();
      });
    }

    card.querySelector("#mSave").onclick = async () => {
      try {
        await onSave();
        close();
      } catch (err) {
        alert(err.message || err);
      }
    };
  }

  // ---------- Route renderers ----------
  async function renderRoute() {
    if (state.route === "dashboard") return renderDashboard();
    if (state.route === "services") return renderServices();
    if (state.route === "projects") return renderProjects();
    if (state.route === "products") return renderProducts();
    if (state.route === "jobs") return renderJobs();
    if (state.route === "applications") return renderApplications();
    if (state.route === "inquiries") return renderInquiries();
    if (state.route === "orders") return renderOrders();
    if (state.route === "deliveryTeam") return renderDeliveryTeam();
    if (state.route === "reviews") return renderReviews();
    if (state.route === "settings") return renderSettings();
  }

  async function renderDashboard() {
    setHeader("Dashboard");
    setContent(`<div class="text-sm text-slate-700">Loading...</div>`);

    const [services, projects, products, jobs, applications, inquiries, orders, reviews] = await Promise.all([
      fetchJSON(`${API_BASE}/admin/services`),
      fetchJSON(`${API_BASE}/admin/projects`),
      fetchJSON(`${API_BASE}/admin/products`),
      fetchJSON(`${API_BASE}/admin/jobs`),
      fetchJSON(`${API_BASE}/admin/applications`),
      fetchJSON(`${API_BASE}/admin/inquiries`),
      fetchJSON(`${API_BASE}/admin/orders`),
      fetchJSON(`${API_BASE}/admin/reviews`)
    ]);

    const cards = el("div", "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4");
    const mk = (title, value, sub) => {
      const c = el("div", "p-4 rounded-2xl border border-slate-200 bg-white");
      c.innerHTML = `
        <div class="text-sm text-slate-600">${title}</div>
        <div class="text-3xl font-semibold text-slate-900 mt-2">${value}</div>
        <div class="text-xs text-slate-500 mt-2">${sub || ""}</div>
      `;
      return c;
    };
    cards.appendChild(mk("Services", services.length, `${services.filter(s => s.isActive).length} active`));
    cards.appendChild(mk("Projects", projects.length, `${projects.filter(p => p.isPublished).length} published`));
    cards.appendChild(mk("Products", products.length, `${products.filter(p => p.isActive).length} active`));
    cards.appendChild(mk("Jobs", jobs.length, `${jobs.filter(j => j.isPublished).length} published`));
    cards.appendChild(mk("Applications", applications.length, `${applications.filter(a => a.status === "new").length} new`));
    cards.appendChild(mk("Inquiries", inquiries.length, `${inquiries.filter(i => i.status === "new").length} new`));
    cards.appendChild(mk("Orders", orders.length, `${orders.filter(o => o.status === "pending").length} pending`));
    cards.appendChild(mk("Reviews", reviews.length, "All customer reviews"));

    setContent(cards);
  }

  // --- CRUD: Services ---
  async function renderServices() {
    setHeader("Services", `<button id="addBtn" class="px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-medium hover:bg-slate-800">Add Service</button>`);
    setContent(`<div class="text-sm text-slate-700">Loading...</div>`);

    const items = await fetchJSON(`${API_BASE}/admin/services`);
    const wrap = el("div", "overflow-auto");
    const table = el("table", "w-full text-sm");
    table.innerHTML = `
      <thead>
        <tr class="text-left text-slate-600">
          <th class="py-2">Name</th>
          <th class="py-2">Category</th>
          <th class="py-2">From</th>
          <th class="py-2">Active</th>
          <th class="py-2"></th>
        </tr>
      </thead>
      <tbody>
        ${items
          .map(
            (s) => `
          <tr class="border-t border-slate-200">
            <td class="py-2 font-medium text-slate-900">${s.name}</td>
            <td class="py-2">${s.category}</td>
            <td class="py-2">${money(s.priceFromLKR)}</td>
            <td class="py-2">${s.isActive ? "✅" : "—"}</td>
            <td class="py-2 text-right">
              <button data-edit="${s._id}" class="px-3 py-1.5 text-sm rounded-lg border border-slate-200 hover:bg-slate-50">Edit</button>
              <button data-del="${s._id}" class="px-3 py-1.5 text-sm rounded-lg border border-slate-200 hover:bg-slate-50">Delete</button>
            </td>
          </tr>
        `
          )
          .join("")}
      </tbody>
    `;
    wrap.appendChild(table);
    setContent(wrap);

    document.getElementById("addBtn").onclick = () => openServiceModal();
    wrap.querySelectorAll("[data-edit]").forEach((b) => {
      b.onclick = () => openServiceModal(items.find(i => i._id === b.dataset.edit));
    });
    wrap.querySelectorAll("[data-del]").forEach((b) => {
      b.onclick = async () => {
        if (!confirm("Delete this service?")) return;
        await fetchJSON(`${API_BASE}/admin/services/${b.dataset.del}`, { method: "DELETE" });
        renderServices();
      };
    });
  }

  function openServiceModal(item = null) {
    const form = el("form", "space-y-3");
    form.appendChild(inputRow("Category", "category", item?.category || "Construction"));
    form.appendChild(inputRow("Name", "name", item?.name || ""));
    // NOTE: Some deployments missed the imageUrl field in the modal, but the save handler
    // still tried to read form.imageUrl.value, causing:
    //   Cannot read properties of undefined (reading 'value')
    form.appendChild(inputRow("Image URL (optional)", "imageUrl", item?.imageUrl || "", "text", "https://..."));
    form.appendChild(textareaRow("Description", "description", item?.description || ""));
    form.appendChild(inputRow("Price From (LKR)", "priceFromLKR", item?.priceFromLKR ?? 0, "number"));
    form.appendChild(checkboxRow("Active", "isActive", item ? !!item.isActive : true));

    modal(item ? "Edit Service" : "Add Service", form, async () => {
      const payload = {
        category: form.category.value.trim(),
        name: form.name.value.trim(),
        description: form.description.value.trim(),
        priceFromLKR: Number(form.priceFromLKR.value || 0),
        imageUrl: (form.imageUrl?.value || "").trim(),
        isActive: !!form.isActive.checked
      };
      if (!payload.category || !payload.name) throw new Error("Category and Name are required");
      if (item) {
        await fetchJSON(`${API_BASE}/admin/services/${item._id}`, { method: "PUT", body: JSON.stringify(payload) });
      } else {
        await fetchJSON(`${API_BASE}/admin/services`, { method: "POST", body: JSON.stringify(payload) });
      }
      await renderServices();
    });
  }

  // --- CRUD: Projects ---
  async function renderProjects() {
    setHeader("Projects", `<button id="addBtn" class="px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-medium hover:bg-slate-800">Add Project</button>`);
    setContent(`<div class="text-sm text-slate-700">Loading...</div>`);
    const items = await fetchJSON(`${API_BASE}/admin/projects`);

    const wrap = el("div", "overflow-auto");
    const table = el("table", "w-full text-sm");
    table.innerHTML = `
      <thead>
        <tr class="text-left text-slate-600">
          <th class="py-2">Title</th>
          <th class="py-2">Category</th>
          <th class="py-2">Status</th>
          <th class="py-2">Published</th>
          <th class="py-2"></th>
        </tr>
      </thead>
      <tbody>
        ${items.map(p => `
          <tr class="border-t border-slate-200">
            <td class="py-2 font-medium text-slate-900">${p.title}</td>
            <td class="py-2">${p.category}</td>
            <td class="py-2">${p.status}</td>
            <td class="py-2">${p.isPublished ? "✅" : "—"}</td>
            <td class="py-2 text-right">
              <button data-edit="${p._id}" class="px-3 py-1.5 text-sm rounded-lg border border-slate-200 hover:bg-slate-50">Edit</button>
              <button data-del="${p._id}" class="px-3 py-1.5 text-sm rounded-lg border border-slate-200 hover:bg-slate-50">Delete</button>
            </td>
          </tr>
        `).join("")}
      </tbody>
    `;
    wrap.appendChild(table);
    setContent(wrap);

    document.getElementById("addBtn").onclick = () => openProjectModal();
    wrap.querySelectorAll("[data-edit]").forEach((b) => {
      b.onclick = () => openProjectModal(items.find(i => i._id === b.dataset.edit));
    });
    wrap.querySelectorAll("[data-del]").forEach((b) => {
      b.onclick = async () => {
        if (!confirm("Delete this project (and its reviews)?")) return;
        await fetchJSON(`${API_BASE}/admin/projects/${b.dataset.del}`, { method: "DELETE" });
        renderProjects();
      };
    });
  }

  function openProjectModal(item = null) {
    const form = el("form", "space-y-3");
    form.appendChild(inputRow("Title", "title", item?.title || ""));
    // Optional image used on the public projects page
    form.appendChild(inputRow("Image URL (optional)", "imageUrl", item?.imageUrl || "", "text", "https://..."));
    form.appendChild(inputRow("Category", "category", item?.category || "Residential"));
    form.appendChild(inputRow("Location", "location", item?.location || ""));
    form.appendChild(inputRow("Year", "year", item?.year ?? new Date().getFullYear(), "number"));
    form.appendChild(inputRow("Status", "status", item?.status || "Completed"));
    form.appendChild(textareaRow("Description", "description", item?.description || ""));
    form.appendChild(checkboxRow("Published", "isPublished", item ? !!item.isPublished : true));

    modal(item ? "Edit Project" : "Add Project", form, async () => {
      const payload = {
        title: form.title.value.trim(),
        category: form.category.value.trim(),
        location: form.location.value.trim(),
        year: Number(form.year.value || new Date().getFullYear()),
        status: form.status.value.trim(),
        description: form.description.value.trim(),
        imageUrl: (form.imageUrl?.value || "").trim(),
        isPublished: !!form.isPublished.checked
      };
      if (!payload.title || !payload.category) throw new Error("Title and Category are required");
      if (item) {
        await fetchJSON(`${API_BASE}/admin/projects/${item._id}`, { method: "PUT", body: JSON.stringify(payload) });
      } else {
        await fetchJSON(`${API_BASE}/admin/projects`, { method: "POST", body: JSON.stringify(payload) });
      }
      await renderProjects();
    });
  }

  // --- CRUD: Products ---
  async function renderProducts() {
    setHeader("Products", `<button id="addBtn" class="px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-medium hover:bg-slate-800">Add Product</button>`);
    setContent(`<div class="text-sm text-slate-700">Loading...</div>`);
    const items = await fetchJSON(`${API_BASE}/admin/products`);

    const wrap = el("div", "overflow-auto");
    const table = el("table", "w-full text-sm");
    table.innerHTML = `
      <thead>
        <tr class="text-left text-slate-600">
          <th class="py-2">Name</th>
          <th class="py-2">Category</th>
          <th class="py-2">Price</th>
          <th class="py-2">Stock</th>
          <th class="py-2">Active</th>
          <th class="py-2"></th>
        </tr>
      </thead>
      <tbody>
        ${items.map((p) => {
          const specificType = p.displaySubCategory || p.subCategory || "";
          return `
            <tr class="border-t border-slate-200">
              <td class="py-2 font-medium text-slate-900">
                <div>${escapeHTML(p.name)}</div>
                ${p.brand ? `<div class="text-xs text-slate-500 mt-1">${escapeHTML(p.brand)}</div>` : ""}
                <div class="text-xs text-slate-500 mt-1">${p.isReturnable === false ? escapeHTML(p.nonReturnableReason || "No change-of-mind returns") : `Returnable • ${Number(p.warrantyDays || 0)} day(s) warranty support`}</div>
              </td>
              <td class="py-2">
                <div>${escapeHTML(p.shopCategoryLabel || p.category || "—")}</div>
                ${specificType ? `<div class="text-xs text-slate-500 mt-1">${escapeHTML(specificType)}</div>` : ""}
              </td>
              <td class="py-2">${money(p.priceLKR)}</td>
              <td class="py-2">${p.stockQty}</td>
              <td class="py-2">${p.isActive ? "✅" : "—"}</td>
              <td class="py-2 text-right whitespace-nowrap">
                <button data-edit="${p._id}" class="px-3 py-1.5 text-sm rounded-lg border border-slate-200 hover:bg-slate-50">Edit</button>
                <button data-del="${p._id}" class="px-3 py-1.5 text-sm rounded-lg border border-slate-200 hover:bg-slate-50">Delete</button>
              </td>
            </tr>
          `;
        }).join("")}
      </tbody>
    `;
    wrap.appendChild(table);
    setContent(wrap);

    document.getElementById("addBtn").onclick = () => openProductModal();
    wrap.querySelectorAll("[data-edit]").forEach((b) => {
      b.onclick = () => openProductModal(items.find((i) => i._id === b.dataset.edit));
    });
    wrap.querySelectorAll("[data-del]").forEach((b) => {
      b.onclick = async () => {
        if (!confirm("Delete this product?")) return;
        await fetchJSON(`${API_BASE}/admin/products/${b.dataset.del}`, { method: "DELETE" });
        renderProducts();
      };
    });
  }

  function openProductModal(item = null) {
    const currentMainCategory = item?.shopCategoryLabel || item?.category || "Building Materials";
    const currentSpecificType = item?.subCategory || ((item?.category && item?.category !== item?.shopCategoryLabel) ? item.category : "");
    const currentTags = Array.isArray(item?.tags) ? item.tags.join(", ") : "";

    const form = el("form", "space-y-3");
    form.appendChild(inputRow("Name", "name", item?.name || ""));
    form.appendChild(inputRow("Brand (optional)", "brand", item?.brand || "", "text", "e.g. Lanwa, Nippon, Kevilton"));
    form.appendChild(inputRow("Image URL (optional)", "imageUrl", item?.imageUrl || "", "text", "https://..."));
    form.appendChild(selectRow("Main Category", "category", currentMainCategory, PRODUCT_CATEGORY_OPTIONS));
    form.appendChild(inputRow("Specific Type / Sub Category", "subCategory", currentSpecificType, "text", "e.g. Cement, PVC Pipe, TMT Bar, Safety Helmet"));
    form.appendChild(inputRow("Price (LKR)", "priceLKR", item?.priceLKR ?? 0, "number"));
    form.appendChild(inputRow("Stock Qty", "stockQty", item?.stockQty ?? 0, "number"));
    form.appendChild(inputRow("Warranty Support (days)", "warrantyDays", item?.warrantyDays ?? 0, "number"));
    form.appendChild(inputRow("Search Tags (comma separated)", "tags", currentTags, "text", "cement, 50kg, foundation"));
    form.appendChild(textareaRow("Description", "description", item?.description || ""));
    form.appendChild(checkboxRow("Allow change-of-mind returns", "isReturnable", item ? item.isReturnable !== false : true));
    form.appendChild(inputRow("Non-returnable reason", "nonReturnableReason", item?.nonReturnableReason || "", "text", "e.g. Cut-to-size item / custom order"));
    form.appendChild(checkboxRow("Active", "isActive", item ? !!item.isActive : true));

    modal(item ? "Edit Product" : "Add Product", form, async () => {
      const payload = {
        name: form.name.value.trim(),
        brand: form.brand.value.trim(),
        imageUrl: (form.imageUrl?.value || "").trim(),
        category: form.category.value.trim(),
        subCategory: form.subCategory.value.trim(),
        priceLKR: Number(form.priceLKR.value || 0),
        stockQty: Number(form.stockQty.value || 0),
        warrantyDays: Number(form.warrantyDays.value || 0),
        tags: form.tags.value.trim(),
        description: form.description.value.trim(),
        isReturnable: !!form.isReturnable.checked,
        nonReturnableReason: form.nonReturnableReason.value.trim(),
        isActive: !!form.isActive.checked
      };
      if (!payload.name) throw new Error("Name is required");
      if (!payload.category) throw new Error("Main Category is required");
      if (item) {
        await fetchJSON(`${API_BASE}/admin/products/${item._id}`, { method: "PUT", body: JSON.stringify(payload) });
      } else {
        await fetchJSON(`${API_BASE}/admin/products`, { method: "POST", body: JSON.stringify(payload) });
      }
      await renderProducts();
    });
  }

// --- CRUD: Jobs ---
async function renderJobs() {
  setHeader("Jobs", `<button id="addBtn" class="px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-medium hover:bg-slate-800">Add Job</button>`);
  setContent(`<div class="text-sm text-slate-700">Loading...</div>`);

  const items = await fetchJSON(`${API_BASE}/admin/jobs`);
  const wrap = el("div", "overflow-auto");
  const table = el("table", "w-full text-sm");
  table.innerHTML = `
    <thead>
      <tr class="text-left text-slate-600">
        <th class="py-2">Title</th>
        <th class="py-2">Department</th>
        <th class="py-2">Location</th>
        <th class="py-2">Type</th>
        <th class="py-2">Closing</th>
        <th class="py-2">Published</th>
        <th class="py-2"></th>
      </tr>
    </thead>
    <tbody>
      ${items.map(j => `
        <tr class="border-t border-slate-200">
          <td class="py-2 font-medium text-slate-900">${j.title}</td>
          <td class="py-2">${j.department || "—"}</td>
          <td class="py-2">${j.location || "—"}</td>
          <td class="py-2">${j.employmentType || "—"}</td>
          <td class="py-2">${j.closingDate ? formatDate(j.closingDate).split(",")[0] : "—"}</td>
          <td class="py-2">${j.isPublished ? "✅" : "—"}</td>
          <td class="py-2 text-right whitespace-nowrap">
            <button data-edit="${j._id}" class="px-3 py-1.5 text-sm rounded-lg border border-slate-200 hover:bg-slate-50">Edit</button>
            <button data-toggle="${j._id}" class="px-3 py-1.5 text-sm rounded-lg border border-slate-200 hover:bg-slate-50">${j.isPublished ? "Unpublish" : "Publish"}</button>
            <button data-del="${j._id}" class="px-3 py-1.5 text-sm rounded-lg border border-slate-200 hover:bg-slate-50">Delete</button>
          </td>
        </tr>
      `).join("")}
    </tbody>
  `;
  wrap.appendChild(table);
  setContent(wrap);

  document.getElementById("addBtn").onclick = () => openJobModal();
  wrap.querySelectorAll("[data-edit]").forEach((b) => {
    b.onclick = () => openJobModal(items.find(i => i._id === b.dataset.edit));
  });
  wrap.querySelectorAll("[data-toggle]").forEach((b) => {
    b.onclick = async () => {
      const job = items.find(i => i._id === b.dataset.toggle);
      if (!job) return;
      await fetchJSON(`${API_BASE}/admin/jobs/${job._id}`, { method: "PUT", body: JSON.stringify({ isPublished: !job.isPublished }) });
      renderJobs();
    };
  });
  wrap.querySelectorAll("[data-del]").forEach((b) => {
    b.onclick = async () => {
      if (!confirm("Delete this job?")) return;
      await fetchJSON(`${API_BASE}/admin/jobs/${b.dataset.del}`, { method: "DELETE" });
      renderJobs();
    };
  });
}

function openJobModal(item = null) {
  const form = el("form", "space-y-3");
  form.appendChild(inputRow("Title", "title", item?.title || ""));
  form.appendChild(inputRow("Image URL (optional)", "imageUrl", item?.imageUrl || "", "text", "https://..."));
  form.appendChild(inputRow("Department", "department", item?.department || ""));
  form.appendChild(inputRow("Location", "location", item?.location || "Sri Lanka"));
  form.appendChild(inputRow("Employment Type", "employmentType", item?.employmentType || "Full-time"));
  form.appendChild(inputRow("Experience Level", "experienceLevel", item?.experienceLevel || ""));
  form.appendChild(inputRow("Salary Range", "salaryRange", item?.salaryRange || ""));
  form.appendChild(inputRow("Closing Date (YYYY-MM-DD)", "closingDate", item?.closingDate ? new Date(item.closingDate).toISOString().slice(0,10) : "", "text"));
  form.appendChild(textareaRow("Description", "description", item?.description || ""));

  form.appendChild(textareaRow("Responsibilities (one per line)", "responsibilities", (item?.responsibilities || []).join("\n")));
  form.appendChild(textareaRow("Requirements (one per line)", "requirements", (item?.requirements || []).join("\n")));
  form.appendChild(textareaRow("Benefits (one per line)", "benefits", (item?.benefits || []).join("\n")));
  form.appendChild(checkboxRow("Published", "isPublished", item ? !!item.isPublished : true));

  modal(item ? "Edit Job" : "Add Job", form, async () => {
    const lines = (v) => (v || "").split("\n").map(s => s.trim()).filter(Boolean);
    const payload = {
      title: form.title.value.trim(),
      imageUrl: (form.imageUrl?.value || "").trim(),
      department: form.department.value.trim(),
      location: form.location.value.trim(),
      employmentType: form.employmentType.value.trim(),
      experienceLevel: form.experienceLevel.value.trim(),
      salaryRange: form.salaryRange.value.trim(),
      closingDate: form.closingDate.value.trim() ? form.closingDate.value.trim() : null,
      description: form.description.value.trim(),
      responsibilities: lines(form.responsibilities.value),
      requirements: lines(form.requirements.value),
      benefits: lines(form.benefits.value),
      isPublished: !!form.isPublished.checked
    };
    if (!payload.title) throw new Error("Title is required");
    if (item) {
      await fetchJSON(`${API_BASE}/admin/jobs/${item._id}`, { method: "PUT", body: JSON.stringify(payload) });
    } else {
      await fetchJSON(`${API_BASE}/admin/jobs`, { method: "POST", body: JSON.stringify(payload) });
    }
    await renderJobs();
  });
}

// --- Manage: Job Applications ---
async function renderApplications() {
  setHeader("Job Applications");
  setContent(`<div class="text-sm text-slate-700">Loading...</div>`);

  const statusMeta = {
    new: {
      label: "New",
      chip: "bg-blue-50 text-blue-700 border-blue-200",
      hint: "Fresh application waiting for review"
    },
    reviewed: {
      label: "Reviewed",
      chip: "bg-slate-50 text-slate-700 border-slate-200",
      hint: "Initial review completed"
    },
    shortlisted: {
      label: "Shortlisted",
      chip: "bg-emerald-50 text-emerald-700 border-emerald-200",
      hint: "Candidate moved to the next shortlist"
    },
    interview_scheduled: {
      label: "Interview Scheduled",
      chip: "bg-amber-50 text-amber-700 border-amber-200",
      hint: "Interview invitation has been prepared or sent"
    },
    approved: {
      label: "Approved",
      chip: "bg-cyan-50 text-cyan-700 border-cyan-200",
      hint: "Admin approved the next confirmed step"
    },
    hired: {
      label: "Hired",
      chip: "bg-purple-50 text-purple-700 border-purple-200",
      hint: "Candidate has accepted / joined"
    },
    on_hold: {
      label: "On Hold",
      chip: "bg-orange-50 text-orange-700 border-orange-200",
      hint: "Waiting for more information or internal decision"
    },
    rejected: {
      label: "Rejected",
      chip: "bg-red-50 text-red-700 border-red-200",
      hint: "Application has been closed"
    }
  };

  const responsePresets = {
    custom_update: {
      label: "Custom update",
      defaultStatus: "reviewed",
      subject: (app) => `Update on your application - ${app.jobId?.title || "S.Gamage Constructions"}`,
      message: (app) => `Dear ${app.fullName || "Applicant"},

Thank you for applying for the ${app.jobId?.title || "position"} role. We reviewed your application and wanted to share an update with you.

Best regards,
S.Gamage Constructions`,
      note: () => ""
    },
    shortlist_update: {
      label: "Shortlist update",
      defaultStatus: "shortlisted",
      subject: (app) => `Shortlisted - ${app.jobId?.title || "Application Update"}`,
      message: (app) => `Dear ${app.fullName || "Applicant"},

Thank you for applying for the ${app.jobId?.title || "position"} role. We are happy to let you know that you have been shortlisted for the next stage of our hiring process.

We will contact you again shortly with the next step.

Best regards,
S.Gamage Constructions`,
      note: () => ""
    },
    interview_invitation: {
      label: "Interview invitation",
      defaultStatus: "interview_scheduled",
      subject: (app) => `Interview Invitation - ${app.jobId?.title || "Application Update"}`,
      message: (app) => `Dear ${app.fullName || "Applicant"},

Thank you for applying for the ${app.jobId?.title || "position"} role. We would like to invite you for an interview. Please review the interview details below and reply if you need any clarification.

Best regards,
S.Gamage Constructions`,
      note: () => "Please be at the location 10 minutes early and bring any required documents."
    },
    request_more_info: {
      label: "Request more info",
      defaultStatus: "on_hold",
      subject: (app) => `Additional Information Needed - ${app.jobId?.title || "Application Update"}`,
      message: (app) => `Dear ${app.fullName || "Applicant"},

Thank you for applying for the ${app.jobId?.title || "position"} role. Before we move your application forward, please reply to this email with the requested details.

Best regards,
S.Gamage Constructions`,
      note: () => "Example: updated CV, references, NIC copy or availability confirmation."
    },
    approval: {
      label: "Approval / next step",
      defaultStatus: "approved",
      subject: (app) => `Next Step Confirmed - ${app.jobId?.title || "Application Update"}`,
      message: (app) => `Dear ${app.fullName || "Applicant"},

Thank you for applying for the ${app.jobId?.title || "position"} role. We are pleased to move your application to the next confirmed step. Please review the details below and contact us if you need anything clarified.

Best regards,
S.Gamage Constructions`,
      note: () => ""
    },
    rejection: {
      label: "Polite rejection",
      defaultStatus: "rejected",
      subject: (app) => `Update on your application - ${app.jobId?.title || "S.Gamage Constructions"}`,
      message: (app) => `Dear ${app.fullName || "Applicant"},

Thank you for taking the time to apply for the ${app.jobId?.title || "position"} role. After careful review, we will not be moving forward with your application at this stage. We appreciate your interest in S.Gamage Constructions and wish you all the best.

Best regards,
S.Gamage Constructions`,
      note: () => ""
    },
    internal_note: {
      label: "Internal note only",
      defaultStatus: "reviewed",
      subject: (app) => `Internal note - ${app.jobId?.title || "Application"}`,
      message: () => "",
      note: () => "Visible only to admin. Not sent to the candidate."
    }
  };

  const statusOptions = Object.keys(statusMeta);
  const items = await fetchJSON(`${API_BASE}/admin/applications`);

  const wrap = el("div", "space-y-4");
  wrap.innerHTML = `
    <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      <div class="rounded-2xl border border-slate-200 bg-white p-4">
        <div class="text-xs uppercase tracking-wide text-slate-500">Total applications</div>
        <div class="mt-2 text-3xl font-semibold text-slate-900">${items.length}</div>
        <div class="mt-1 text-sm text-slate-500">All careers submissions in the system</div>
      </div>
      <div class="rounded-2xl border border-slate-200 bg-white p-4">
        <div class="text-xs uppercase tracking-wide text-slate-500">New</div>
        <div class="mt-2 text-3xl font-semibold text-slate-900">${items.filter((item) => item.status === "new").length}</div>
        <div class="mt-1 text-sm text-slate-500">Fresh applications waiting for action</div>
      </div>
      <div class="rounded-2xl border border-slate-200 bg-white p-4">
        <div class="text-xs uppercase tracking-wide text-slate-500">Interview stage</div>
        <div class="mt-2 text-3xl font-semibold text-slate-900">${items.filter((item) => ["shortlisted", "interview_scheduled", "approved", "hired"].includes(item.status)).length}</div>
        <div class="mt-1 text-sm text-slate-500">Candidates moving through the next step</div>
      </div>
      <div class="rounded-2xl border border-slate-200 bg-white p-4">
        <div class="text-xs uppercase tracking-wide text-slate-500">Customer updates sent</div>
        <div class="mt-2 text-3xl font-semibold text-slate-900">${items.filter((item) => item.lastContactedAt).length}</div>
        <div class="mt-1 text-sm text-slate-500">Applications with at least one admin response</div>
      </div>
    </div>

    <div class="rounded-2xl border border-slate-200 bg-white p-4">
      <div class="flex flex-col xl:flex-row gap-3 xl:items-end xl:justify-between">
        <div>
          <div class="text-sm font-semibold text-slate-900">Filter and search</div>
          <div class="text-sm text-slate-500 mt-1">Search by candidate name, phone, email or job title. Use View to open every submitted detail, then Send update to email interview details with a note.</div>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-3 w-full xl:max-w-4xl">
          <div>
            <label class="text-xs font-medium text-slate-700">Search</label>
            <input type="text" data-app-search placeholder="Search candidate / job / phone / role" class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label class="text-xs font-medium text-slate-700">Status</label>
            <select data-app-status-filter class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm">
              <option value="all">All statuses</option>
              ${statusOptions.map((status) => `<option value="${status}">${statusMeta[status].label}</option>`).join("")}
            </select>
          </div>
          <div>
            <label class="text-xs font-medium text-slate-700">Job role</label>
            <select data-app-job-filter class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm">
              <option value="all">All job posts</option>
            </select>
          </div>
        </div>
      </div>
    </div>

    <div id="applicationsList" class="space-y-3"></div>
  `;

  const listEl = wrap.querySelector("#applicationsList");
  const searchInput = wrap.querySelector("[data-app-search]");
  const statusFilter = wrap.querySelector("[data-app-status-filter]");
  const jobFilter = wrap.querySelector("[data-app-job-filter]");

  const uniqueJobs = [];
  const seenJobs = new Set();
  items.forEach((item) => {
    const id = String(item?.jobId?._id || "");
    if (!id || seenJobs.has(id)) return;
    seenJobs.add(id);
    uniqueJobs.push({
      id,
      label: item?.jobId?.title || "Untitled job"
    });
  });
  uniqueJobs.sort((a, b) => a.label.localeCompare(b.label));
  jobFilter.insertAdjacentHTML("beforeend", uniqueJobs.map((job) => `<option value="${escapeHTML(job.id)}">${escapeHTML(job.label)}</option>`).join(""));

  const formatPhoneForWhatsApp = (value = "") => {
    const digits = String(value || "").replace(/\D+/g, "");
    if (!digits) return "";
    if (digits.startsWith("0") && digits.length === 10) return `94${digits.slice(1)}`;
    return digits;
  };

  const nl2br = (value) => escapeHTML(value || "").replace(/\n/g, "<br />");

  const getStatusChip = (status) => {
    const meta = statusMeta[status] || statusMeta.reviewed;
    return `<span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${meta.chip}">${escapeHTML(meta.label)}</span>`;
  };

  const getVisibleCommunications = (application) => Array.isArray(application?.communications)
    ? application.communications.filter((entry) => String(entry?.channel || "") === "email")
    : [];

  const getLatestVisibleCommunication = (application) => {
    const list = getVisibleCommunications(application);
    return list.length ? list[list.length - 1] : null;
  };

  const formatDateInput = (value) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const pad = (n) => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  const getInterviewSummary = (application) => {
    const interview = application?.interviewSchedule || {};
    if (!interview?.dateTime) return "";
    const parts = [formatDate(interview.dateTime)];
    if (interview.mode) parts.push(interview.mode);
    if (interview.location) parts.push(interview.location);
    return parts.filter(Boolean).join(" • ");
  };

  const buildDetailBody = (application) => {
    const detail = el("div", "space-y-4");
    const visibleCommunications = getVisibleCommunications(application);
    const interview = application?.interviewSchedule || {};
    const quickLinks = [
      application.email ? `<a class="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50" href="mailto:${escapeHTML(application.email)}">Email</a>` : "",
      application.phone ? `<a class="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50" href="tel:${escapeHTML(application.phone)}">Call</a>` : "",
      application.phone ? `<a class="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50" href="https://wa.me/${escapeHTML(formatPhoneForWhatsApp(application.phone))}" target="_blank" rel="noreferrer">WhatsApp</a>` : ""
    ].filter(Boolean).join("");

    detail.innerHTML = `
      <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div class="flex flex-col lg:flex-row gap-4 lg:items-start lg:justify-between">
          <div>
            <div class="flex flex-wrap items-center gap-2">
              ${getStatusChip(application.status)}
              <span class="text-sm text-slate-500">Submitted ${escapeHTML(formatDate(application.createdAt))}</span>
            </div>
            <h3 class="mt-3 text-xl font-semibold text-slate-900">${escapeHTML(application.fullName || "Applicant")}</h3>
            <div class="mt-1 text-sm text-slate-600">${escapeHTML(application.currentRole || "Role not specified")}${application.experienceYears ? ` • ${escapeHTML(String(application.experienceYears))} year(s) experience` : ""}</div>
          </div>
          <div class="flex flex-wrap gap-2 text-sm">${quickLinks}</div>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div class="rounded-2xl border border-slate-200 p-4">
          <div class="text-sm font-semibold text-slate-900">Candidate details</div>
          <div class="mt-3 space-y-2 text-sm text-slate-700">
            <div><b>Email:</b> ${escapeHTML(application.email || "-")}</div>
            <div><b>Phone:</b> ${escapeHTML(application.phone || "-")}</div>
            <div><b>Address:</b> ${escapeHTML(application.address || "-")}</div>
            <div><b>Expected salary:</b> ${escapeHTML(application.expectedSalary || "-")}</div>
            <div><b>CV link:</b> ${application.cvLink ? `<a href="${escapeHTML(application.cvLink)}" target="_blank" rel="noreferrer" class="underline">Open CV / portfolio</a>` : "-"}</div>
          </div>
        </div>

        <div class="rounded-2xl border border-slate-200 p-4">
          <div class="text-sm font-semibold text-slate-900">Job + workflow</div>
          <div class="mt-3 space-y-2 text-sm text-slate-700">
            <div><b>Job title:</b> ${escapeHTML(application.jobId?.title || "-")}</div>
            <div><b>Department:</b> ${escapeHTML(application.jobId?.department || "-")}</div>
            <div><b>Location:</b> ${escapeHTML(application.jobId?.location || "-")}</div>
            <div><b>Employment:</b> ${escapeHTML(application.jobId?.employmentType || "-")}</div>
            <div><b>Experience level:</b> ${escapeHTML(application.jobId?.experienceLevel || "-")}</div>
            <div><b>Last customer update:</b> ${application.lastContactedAt ? escapeHTML(formatDate(application.lastContactedAt)) : "No update sent yet"}</div>
          </div>
        </div>
      </div>

      <div class="rounded-2xl border border-slate-200 p-4">
        <div class="text-sm font-semibold text-slate-900">Candidate message</div>
        <div class="mt-3 text-sm text-slate-700 whitespace-pre-wrap">${application.message ? nl2br(application.message) : '<span class="text-slate-400">No candidate message added.</span>'}</div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div class="rounded-2xl border border-slate-200 p-4">
          <div class="text-sm font-semibold text-slate-900">Interview schedule</div>
          <div class="mt-3 space-y-2 text-sm text-slate-700">
            <div><b>Date & time:</b> ${interview.dateTime ? escapeHTML(formatDate(interview.dateTime)) : "Not scheduled yet"}</div>
            <div><b>Type:</b> ${escapeHTML(interview.mode || "-")}</div>
            <div><b>Location / meeting:</b> ${escapeHTML(interview.location || interview.meetingLink || "-")}</div>
            <div><b>Note:</b> ${escapeHTML(interview.note || "-")}</div>
          </div>
        </div>

        <div class="rounded-2xl border border-slate-200 p-4">
          <div class="text-sm font-semibold text-slate-900">Internal admin notes</div>
          <div class="mt-3 text-sm text-slate-700 whitespace-pre-wrap">${application.adminNotes ? nl2br(application.adminNotes) : '<span class="text-slate-400">No internal notes yet.</span>'}</div>
        </div>
      </div>

      <div class="rounded-2xl border border-slate-200 p-4">
        <div class="text-sm font-semibold text-slate-900">Customer-visible communication history</div>
        <div class="mt-3 space-y-3">
          ${visibleCommunications.length ? visibleCommunications.map((entry) => `
            <div class="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <div class="font-medium text-slate-900">${escapeHTML(entry.subject || "Application update")}</div>
                <div class="text-xs text-slate-500">${escapeHTML(formatDate(entry.createdAt))}</div>
              </div>
              <div class="mt-2 text-sm text-slate-700 whitespace-pre-wrap">${nl2br(entry.message || "")}</div>
              ${entry.note ? `<div class="mt-2 text-xs text-slate-500"><b>Extra note:</b> ${escapeHTML(entry.note)}</div>` : ""}
              ${entry.interviewDateTime ? `<div class="mt-2 text-xs text-slate-500"><b>Interview:</b> ${escapeHTML(formatDate(entry.interviewDateTime))}${entry.interviewMode ? ` • ${escapeHTML(entry.interviewMode)}` : ""}${entry.interviewLocation ? ` • ${escapeHTML(entry.interviewLocation)}` : ""}</div>` : ""}
            </div>
          `).join("") : `<div class="text-sm text-slate-500">No customer updates have been sent yet.</div>`}
        </div>
      </div>
    `;
    return detail;
  };

  const openViewModal = async (id) => {
    const full = await fetchJSON(`${API_BASE}/admin/applications/${id}`);
    modal("Application Details", buildDetailBody(full), async () => {}, {
      hideSave: true,
      cancelLabel: "Close",
      maxWidthClass: "max-w-5xl"
    });
  };

  const openRespondModal = async (id) => {
    const full = await fetchJSON(`${API_BASE}/admin/applications/${id}`);
    const form = el("form", "space-y-4");
    const visibleCommunications = getVisibleCommunications(full);
    const latestVisible = visibleCommunications.length ? visibleCommunications[visibleCommunications.length - 1] : null;

    form.innerHTML = `
      <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div class="flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
          <div>
            <div class="text-xs uppercase tracking-wide text-slate-500">Candidate</div>
            <div class="text-lg font-semibold text-slate-900">${escapeHTML(full.fullName || "Applicant")}</div>
            <div class="text-sm text-slate-500">${escapeHTML(full.email || "-")} • ${escapeHTML(full.phone || "-")}</div>
          </div>
          <div>
            <div class="text-xs uppercase tracking-wide text-slate-500">Job role</div>
            <div class="text-base font-semibold text-slate-900">${escapeHTML(full.jobId?.title || "-")}</div>
            <div class="text-sm text-slate-500">Current status: ${escapeHTML(statusMeta[full.status]?.label || full.status || "new")}</div>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label class="text-xs font-medium text-slate-700">Response template</label>
          <select name="responseType" class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm">
            ${Object.entries(responsePresets).map(([value, preset]) => `<option value="${value}">${escapeHTML(preset.label)}</option>`).join("")}
          </select>
        </div>
        <div>
          <label class="text-xs font-medium text-slate-700">Status after update</label>
          <select name="status" class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm">
            ${statusOptions.map((status) => `<option value="${status}" ${full.status === status ? "selected" : ""}>${escapeHTML(statusMeta[status].label)}</option>`).join("")}
          </select>
        </div>
      </div>

      <label class="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" name="sendEmail" class="h-4 w-4 rounded border-slate-300" checked />
        <span>Email this update to the candidate now</span>
      </label>

      <div>
        <label class="text-xs font-medium text-slate-700">Email subject</label>
        <input type="text" name="subject" class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
      </div>

      <div>
        <label class="text-xs font-medium text-slate-700">Message for candidate</label>
        <textarea name="message" rows="7" class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"></textarea>
      </div>

      <div class="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4">
        <div class="text-sm font-semibold text-slate-900">Interview details (optional)</div>
        <div class="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="text-xs font-medium text-slate-700">Interview date & time</label>
            <input type="datetime-local" name="interviewDateTime" value="${escapeHTML(formatDateInput(full?.interviewSchedule?.dateTime))}" class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label class="text-xs font-medium text-slate-700">Expected end time</label>
            <input type="datetime-local" name="interviewEndTime" value="${escapeHTML(formatDateInput(full?.interviewSchedule?.endDateTime))}" class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label class="text-xs font-medium text-slate-700">Interview type</label>
            <select name="interviewMode" class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm">
              <option value="">Select type</option>
              <option value="On-site" ${full?.interviewSchedule?.mode === "On-site" ? "selected" : ""}>On-site</option>
              <option value="Phone" ${full?.interviewSchedule?.mode === "Phone" ? "selected" : ""}>Phone</option>
              <option value="Online" ${full?.interviewSchedule?.mode === "Online" ? "selected" : ""}>Online</option>
              <option value="Site visit" ${full?.interviewSchedule?.mode === "Site visit" ? "selected" : ""}>Site visit</option>
            </select>
          </div>
          <div>
            <label class="text-xs font-medium text-slate-700">Location / meeting details</label>
            <input type="text" name="interviewLocation" value="${escapeHTML(full?.interviewSchedule?.location || "")}" placeholder="Office address / Google Meet / Zoom / call details" class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div class="md:col-span-2">
            <label class="text-xs font-medium text-slate-700">Meeting link (optional)</label>
            <input type="text" name="meetingLink" value="${escapeHTML(full?.interviewSchedule?.meetingLink || "")}" placeholder="https://..." class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
          </div>
        </div>
      </div>

      <div>
        <label class="text-xs font-medium text-slate-700">Candidate note / instructions</label>
        <textarea name="note" rows="3" class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"></textarea>
      </div>

      <div>
        <label class="text-xs font-medium text-slate-700">Internal admin notes</label>
        <textarea name="adminNotes" rows="4" class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm">${escapeHTML(full.adminNotes || "")}</textarea>
      </div>

      <div class="rounded-2xl border border-slate-200 p-4">
        <div class="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div class="text-sm font-semibold text-slate-900">Preview</div>
            <div class="text-xs text-slate-500">This shows the candidate-facing content that will be emailed and saved in history.</div>
          </div>
          ${latestVisible ? `<div class="text-xs text-slate-500">Last email: ${escapeHTML(formatDate(latestVisible.createdAt))}</div>` : `<div class="text-xs text-slate-500">No previous email update sent.</div>`}
        </div>
        <div data-preview class="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700"></div>
      </div>
    `;

    const field = (name) => form.elements[name];

    const setPreset = () => {
      const preset = responsePresets[field("responseType").value] || responsePresets.custom_update;
      if (field("responseType").value === "internal_note") {
        field("sendEmail").checked = false;
        field("sendEmail").disabled = true;
      } else {
        field("sendEmail").disabled = false;
      }
      if (!field("subject").dataset.manual) field("subject").value = preset.subject(full);
      if (!field("message").dataset.manual) field("message").value = preset.message(full);
      if (!field("note").dataset.manual) field("note").value = preset.note(full);
      if (!field("status").dataset.manual && preset.defaultStatus) field("status").value = preset.defaultStatus;
      updatePreview();
    };

    const updatePreview = () => {
      const preview = form.querySelector("[data-preview]");
      const interviewBits = [];
      if (field("interviewDateTime").value) interviewBits.push(`<div><b>Date & time:</b> ${escapeHTML(formatDate(field("interviewDateTime").value))}</div>`);
      if (field("interviewEndTime").value) interviewBits.push(`<div><b>Expected end:</b> ${escapeHTML(formatDate(field("interviewEndTime").value))}</div>`);
      if (field("interviewMode").value) interviewBits.push(`<div><b>Type:</b> ${escapeHTML(field("interviewMode").value)}</div>`);
      if (field("interviewLocation").value) interviewBits.push(`<div><b>Location / meeting:</b> ${escapeHTML(field("interviewLocation").value)}</div>`);
      if (field("meetingLink").value) interviewBits.push(`<div><b>Meeting link:</b> ${escapeHTML(field("meetingLink").value)}</div>`);

      preview.innerHTML = `
        <div class="space-y-3">
          <div>
            <div class="text-xs uppercase tracking-wide text-slate-500">Channel</div>
            <div class="font-medium text-slate-900">${field("sendEmail").checked ? "Email to candidate" : "Internal note only"}</div>
          </div>
          <div>
            <div class="text-xs uppercase tracking-wide text-slate-500">Subject</div>
            <div class="font-medium text-slate-900">${escapeHTML(field("subject").value || "(no subject yet)")}</div>
          </div>
          <div>
            <div class="text-xs uppercase tracking-wide text-slate-500">Message</div>
            <div class="mt-1 whitespace-pre-wrap">${nl2br(field("message").value || "(no message yet)")}</div>
          </div>
          ${interviewBits.length ? `<div class="rounded-xl border border-blue-100 bg-blue-50 p-3">${interviewBits.join("")}</div>` : ""}
          ${field("note").value ? `<div class="rounded-xl border border-slate-200 bg-white p-3"><div class="text-xs uppercase tracking-wide text-slate-500">Extra note</div><div class="mt-1 whitespace-pre-wrap">${nl2br(field("note").value)}</div></div>` : ""}
          <div class="text-xs text-slate-500">Status after update: ${escapeHTML(statusMeta[field("status").value]?.label || field("status").value || "-")}</div>
        </div>
      `;
    };

    ["subject", "message", "note", "status", "interviewDateTime", "interviewEndTime", "interviewMode", "interviewLocation", "meetingLink"].forEach((name) => {
      const input = field(name);
      if (!input) return;
      input.addEventListener("input", () => {
        if (["subject", "message", "note", "status"].includes(name)) {
          input.dataset.manual = "1";
        }
        updatePreview();
      });
      input.addEventListener("change", () => {
        if (["subject", "message", "note", "status"].includes(name)) {
          input.dataset.manual = "1";
        }
        updatePreview();
      });
    });

    field("responseType").addEventListener("change", () => {
      ["subject", "message", "note", "status"].forEach((name) => {
        delete field(name).dataset.manual;
      });
      setPreset();
    });

    field("sendEmail").addEventListener("change", updatePreview);

    setPreset();

    modal("Send Application Update", form, async () => {
      const payload = {
        responseType: field("responseType").value,
        status: field("status").value,
        sendEmail: !!field("sendEmail").checked,
        subject: field("subject").value.trim(),
        message: field("message").value.trim(),
        note: field("note").value.trim(),
        interviewDateTime: field("interviewDateTime").value || "",
        interviewEndTime: field("interviewEndTime").value || "",
        interviewMode: field("interviewMode").value,
        interviewLocation: field("interviewLocation").value.trim(),
        meetingLink: field("meetingLink").value.trim(),
        adminNotes: field("adminNotes").value
      };

      const result = await fetchJSON(`${API_BASE}/admin/applications/${id}/respond`, {
        method: "POST",
        body: JSON.stringify(payload)
      });

      alert(result.emailSent ? "Update sent successfully to the candidate." : "Internal note saved successfully.");
      await renderApplications();
    }, {
      maxWidthClass: "max-w-5xl",
      saveLabel: "Send Update"
    });
  };

  const bindListActions = () => {
    listEl.querySelectorAll("[data-app-view]").forEach((button) => {
      button.onclick = () => openViewModal(button.dataset.appView);
    });

    listEl.querySelectorAll("[data-app-respond]").forEach((button) => {
      button.onclick = () => openRespondModal(button.dataset.appRespond);
    });

    listEl.querySelectorAll("[data-app-delete]").forEach((button) => {
      button.onclick = async () => {
        if (!confirm("Delete this application?")) return;
        await fetchJSON(`${API_BASE}/admin/applications/${button.dataset.appDelete}`, { method: "DELETE" });
        await renderApplications();
      };
    });

    listEl.querySelectorAll("[data-quick-status]").forEach((select) => {
      select.onchange = async () => {
        try {
          await fetchJSON(`${API_BASE}/admin/applications/${select.dataset.quickStatus}`, {
            method: "PUT",
            body: JSON.stringify({ status: select.value })
          });
          await renderApplications();
        } catch (err) {
          alert(err.message || err);
        }
      };
    });
  };

  const renderList = () => {
    const q = String(searchInput.value || "").trim().toLowerCase();
    const statusValue = statusFilter.value;
    const jobValue = jobFilter.value;

    const filtered = items.filter((item) => {
      const matchesStatus = statusValue === "all" || item.status === statusValue;
      const matchesJob = jobValue === "all" || String(item?.jobId?._id || "") === jobValue;
      const searchable = [
        item.fullName,
        item.phone,
        item.email,
        item.currentRole,
        item.expectedSalary,
        item.jobId?.title,
        item.jobId?.department,
        item.jobId?.location
      ].join(" ").toLowerCase();
      const matchesSearch = !q || searchable.includes(q);
      return matchesStatus && matchesJob && matchesSearch;
    });

    if (!filtered.length) {
      listEl.innerHTML = `
        <div class="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500">
          No applications matched the selected filters.
        </div>
      `;
      return;
    }

    listEl.innerHTML = filtered.map((application) => {
      const latestVisible = getLatestVisibleCommunication(application);
      const interviewSummary = getInterviewSummary(application);
      const customerLinks = [
        application.email ? `<a href="mailto:${escapeHTML(application.email)}" class="underline">${escapeHTML(application.email)}</a>` : "",
        application.phone ? `<a href="tel:${escapeHTML(application.phone)}" class="underline">${escapeHTML(application.phone)}</a>` : "",
        application.cvLink ? `<a href="${escapeHTML(application.cvLink)}" target="_blank" rel="noreferrer" class="underline">CV</a>` : ""
      ].filter(Boolean).join(" • ");

      return `
        <div class="rounded-2xl border border-slate-200 bg-white p-4">
          <div class="flex flex-col xl:flex-row gap-4 xl:items-start xl:justify-between">
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                ${getStatusChip(application.status)}
                <span class="text-xs text-slate-500">Applied ${escapeHTML(formatDate(application.createdAt))}</span>
                ${application.lastContactedAt ? `<span class="text-xs text-slate-500">• Last update ${escapeHTML(formatDate(application.lastContactedAt))}</span>` : ""}
              </div>
              <div class="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
                <h3 class="text-lg font-semibold text-slate-900">${escapeHTML(application.fullName || "Applicant")}</h3>
                <span class="text-sm text-slate-500">${escapeHTML(application.currentRole || "Role not specified")}</span>
                ${application.experienceYears ? `<span class="text-sm text-slate-500">• ${escapeHTML(String(application.experienceYears))} year(s) exp.</span>` : ""}
              </div>
              <div class="mt-1 text-sm text-slate-600">${escapeHTML(application.jobId?.title || "Untitled job")}${application.jobId?.department ? ` • ${escapeHTML(application.jobId.department)}` : ""}${application.jobId?.location ? ` • ${escapeHTML(application.jobId.location)}` : ""}</div>
              <div class="mt-2 text-sm text-slate-600">${customerLinks || '<span class="text-slate-400">No contact links</span>'}</div>
              <div class="mt-3 grid grid-cols-1 lg:grid-cols-3 gap-3 text-sm">
                <div class="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div class="text-xs uppercase tracking-wide text-slate-500">Candidate summary</div>
                  <div class="mt-1 text-slate-700">${escapeHTML(application.address || "Address not provided")}</div>
                  ${application.expectedSalary ? `<div class="mt-1 text-slate-500">Expected salary: ${escapeHTML(application.expectedSalary)}</div>` : ""}
                </div>
                <div class="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div class="text-xs uppercase tracking-wide text-slate-500">Interview</div>
                  <div class="mt-1 text-slate-700">${interviewSummary ? escapeHTML(interviewSummary) : "Not scheduled yet"}</div>
                </div>
                <div class="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div class="text-xs uppercase tracking-wide text-slate-500">Latest customer update</div>
                  <div class="mt-1 text-slate-700">${latestVisible ? escapeHTML(latestVisible.subject || "Application update") : "No email update yet"}</div>
                  ${latestVisible ? `<div class="mt-1 text-xs text-slate-500">${escapeHTML(formatDate(latestVisible.createdAt))}</div>` : ""}
                </div>
              </div>
              ${application.message ? `<div class="mt-3 rounded-xl border border-slate-200 p-3 text-sm text-slate-700"><b>Candidate message:</b> ${escapeHTML(application.message.length > 220 ? `${application.message.slice(0, 220)}...` : application.message)}</div>` : ""}
            </div>

            <div class="xl:w-[270px] shrink-0 space-y-3">
              <div>
                <label class="text-xs font-medium text-slate-700">Quick status</label>
                <select data-quick-status="${application._id}" class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm">
                  ${statusOptions.map((status) => `<option value="${status}" ${application.status === status ? "selected" : ""}>${escapeHTML(statusMeta[status].label)}</option>`).join("")}
                </select>
                <div class="mt-1 text-xs text-slate-500">${escapeHTML(statusMeta[application.status]?.hint || "")}</div>
              </div>
              <div class="grid grid-cols-1 gap-2">
                <button data-app-view="${application._id}" class="px-3 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50">View full application</button>
                <button data-app-respond="${application._id}" class="px-3 py-2 rounded-xl bg-slate-900 text-sm font-medium text-white hover:bg-slate-800">Send update / interview</button>
                <button data-app-delete="${application._id}" class="px-3 py-2 rounded-xl border border-red-200 text-sm font-medium text-red-600 hover:bg-red-50">Delete application</button>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join("");

    bindListActions();
  };

  [searchInput, statusFilter, jobFilter].forEach((input) => {
    input.addEventListener("input", renderList);
    input.addEventListener("change", renderList);
  });

  setContent(wrap);
  renderList();
}

  // --- Manage: Inquiries ---
  async function renderInquiries() {
    setHeader("Inquiries");
    setContent(`<div class="text-sm text-slate-700">Loading...</div>`);
    const items = await fetchJSON(`${API_BASE}/admin/inquiries`);

    const wrap = el("div", "space-y-3");
    wrap.innerHTML = items.length ? "" : `<div class="text-sm text-slate-600">No inquiries yet.</div>`;
    for (const i of items) {
      const card = el("div", "p-4 rounded-2xl border border-slate-200");

      const msgs = Array.isArray(i.messages) && i.messages.length
        ? i.messages
        : (String(i.message || "").trim()
          ? [{ sender: "customer", text: String(i.message || ""), createdAt: i.createdAt }]
          : []);

      const renderMsgs = () => {
        if (!msgs.length) {
          return `<div class="text-xs text-slate-500">No messages yet.</div>`;
        }
        return msgs
          .map((m) => {
            const isAdmin = m.sender === "admin";
            const who = isAdmin ? "Admin" : (i.name || "Customer");
            const when = m.createdAt ? formatDate(m.createdAt) : "";
            return `
              <div class="flex ${isAdmin ? "justify-end" : "justify-start"}">
                <div class="max-w-[85%] rounded-2xl px-3 py-2 ${isAdmin ? "bg-slate-900 text-white" : "bg-white border border-slate-200 text-slate-800"}">
                  <div class="text-[11px] ${isAdmin ? "text-slate-200" : "text-slate-500"}">${escapeHTML(who)}${when ? " • " + escapeHTML(when) : ""}</div>
                  <div class="text-sm whitespace-pre-wrap mt-0.5">${escapeHTML(m.text || "")}</div>
                </div>
              </div>
            `;
          })
          .join("");
      };

      card.innerHTML = `
        <div class="flex items-start justify-between gap-4">
          <div>
            <div class="font-semibold text-slate-900">${escapeHTML(i.name)} <span class="text-slate-500 font-normal">(${escapeHTML(i.phone)})</span></div>
            <div class="text-xs text-slate-500 mt-0.5">${i.email ? escapeHTML(i.email) : ""}</div>
            <div class="text-sm text-slate-600 mt-1">${escapeHTML(i.service || "")} ${i.location ? "• " + escapeHTML(i.location) : ""}</div>
            <div class="text-sm text-slate-700 mt-2 whitespace-pre-wrap"><b>Initial:</b> ${escapeHTML(i.message || "")}</div>
            <div class="text-xs text-slate-500 mt-2">Created: ${formatDate(i.createdAt)} • Updated: ${formatDate(i.updatedAt)}</div>
          </div>
          <div class="text-right">
            <select data-status class="text-sm rounded-xl border border-slate-300 px-3 py-2">
              ${["new", "contacted", "closed"].map(s => `<option ${i.status === s ? "selected" : ""}>${s}</option>`).join("")}
            </select>
            <div class="mt-2">
              <button data-chat class="px-3 py-1.5 text-sm rounded-lg bg-slate-900 text-white hover:bg-slate-800">Chat / Reply</button>
              <button data-del class="px-3 py-1.5 text-sm rounded-lg border border-slate-200 hover:bg-slate-50">Delete</button>
            </div>
          </div>
        </div>

        <div data-chatbox class="mt-3 hidden">
          <div class="text-sm font-semibold text-slate-900 mb-2">Conversation</div>
          <div class="space-y-2 max-h-64 overflow-auto border border-slate-200 rounded-2xl p-3 bg-slate-50" data-msgs>
            ${renderMsgs()}
          </div>

          <div class="mt-3 grid grid-cols-1 gap-2">
            <textarea data-reply rows="3" class="w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm" placeholder="Type your reply..."></textarea>
            <div class="flex items-center gap-2 flex-wrap">
              <button data-send class="px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-medium hover:bg-slate-800">Send Reply</button>
              <div data-sendstatus class="text-xs text-slate-600"></div>
              <div class="text-xs text-slate-500">(Reply will auto-set status to <b>contacted</b> if it was new.)</div>
            </div>
          </div>
        </div>
      `;
      card.querySelector("[data-status]").onchange = async (e) => {
        await fetchJSON(`${API_BASE}/admin/inquiries/${i._id}`, { method: "PATCH", body: JSON.stringify({ status: e.target.value }) });
      };

      // Toggle chat
      const chatBtn = card.querySelector("[data-chat]");
      const chatBox = card.querySelector("[data-chatbox]");
      if (chatBtn && chatBox) {
        chatBtn.onclick = () => {
          chatBox.classList.toggle("hidden");
        };
      }

      // Send reply
      const sendBtn = card.querySelector("[data-send]");
      const replyInput = card.querySelector("[data-reply]");
      const sendStatus = card.querySelector("[data-sendstatus]");
      if (sendBtn && replyInput) {
        sendBtn.onclick = async () => {
          const text = String(replyInput.value || "").trim();
          if (!text) {
            if (sendStatus) sendStatus.textContent = "Please type a reply.";
            return;
          }
          if (sendStatus) sendStatus.textContent = "Sending...";
          try {
            await fetchJSON(`${API_BASE}/admin/inquiries/${i._id}/reply`, {
              method: "POST",
              body: JSON.stringify({ text })
            });
            replyInput.value = "";
            if (sendStatus) sendStatus.textContent = "✅ Sent";
            // Refresh list to show latest messages/status
            renderInquiries();
          } catch (err) {
            if (sendStatus) sendStatus.textContent = "❌ " + (err.message || err);
          }
        };
      }

      card.querySelector("[data-del]").onclick = async () => {
        if (!confirm("Delete this inquiry?")) return;
        await fetchJSON(`${API_BASE}/admin/inquiries/${i._id}`, { method: "DELETE" });
        renderInquiries();
      };
      wrap.appendChild(card);
    }
    setContent(wrap);
  }

  // --- Manage: Orders ---
  async function renderOrders() {
    setHeader("Orders");
    const activeSearch = String(state.orderSearch || "").trim();
    setContent(`<div class="text-sm text-slate-700">Loading orders...</div>`);

    const query = activeSearch ? `?search=${encodeURIComponent(activeSearch)}` : "";
    const [items, deliveryTeamData] = await Promise.all([
      fetchJSON(`${API_BASE}/admin/orders${query}`),
      fetchJSON(`${API_BASE}/admin/delivery-boys`)
    ]);
    state.deliveryBoys = deliveryTeamData.items || [];
    state.deliveryTeamRecentActivities = deliveryTeamData.recentActivities || [];
    const wrap = el("div", "space-y-4");

    const returnStatusLabel = (status) => ({
      requested: "Requested",
      under_review: "Under review",
      approved: "Approved",
      awaiting_item: "Awaiting item",
      received: "Received",
      completed: "Completed",
      rejected: "Rejected",
      cancelled: "Cancelled"
    }[status] || status || "Requested");

    const resolutionLabel = (value) => ({
      replacement: "Replacement",
      refund: "Refund",
      exchange: "Exchange",
      store_credit: "Store credit",
      repair: "Repair",
      warranty_support: "Warranty support"
    }[value] || value || "Replacement");

    const paymentStatusLabel = (value) => ({
      none: "None",
      advance_required: "Advance required",
      advance_submitted: "Advance submitted",
      advance_received: "Advance received",
      balance_pending: "Balance pending",
      paid: "Paid in full",
      partially_refunded: "Partially refunded",
      refunded: "Refunded",
      failed: "Payment issue"
    }[value] || value || "Payment pending");

    const paymentStatusOptions = [
      "none",
      "advance_required",
      "advance_submitted",
      "advance_received",
      "balance_pending",
      "paid",
      "partially_refunded",
      "refunded",
      "failed"
    ];

    const searchCard = el("div", "rounded-2xl border border-slate-200 bg-white p-4 space-y-3");
    searchCard.innerHTML = `
      <div class="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div class="text-sm font-semibold text-slate-900">Search customer order ID</div>
          <div class="text-xs text-slate-500 mt-1">Search using the order number shown to the customer, such as <span class="font-medium text-slate-700">SGC-20260322-FH73M</span>.</div>
        </div>
        <div class="text-xs text-slate-500">${activeSearch ? `Filtered results: <span class="font-semibold text-slate-700">${escapeHTML(activeSearch)}</span>` : "Showing latest orders"}</div>
      </div>
      <form id="orderSearchForm" class="flex flex-col lg:flex-row gap-3 lg:items-end">
        <div class="flex-1">
          <label class="text-xs font-medium text-slate-700">Order ID / Order Number</label>
          <input name="search" type="search" value="${escapeHTML(activeSearch)}" placeholder="e.g. SGC-20260322-FH73M or Order SGC-20260322-FH73M" class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-900" />
          <div class="mt-2 text-xs text-slate-500">Tip: you can paste the full label like <span class="font-medium text-slate-700">Order SGC-20260322-FH73M</span> too.</div>
        </div>
        <div class="flex gap-2 flex-wrap">
          <button type="submit" class="px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-medium hover:bg-slate-800">Search</button>
          <button type="button" data-clear-search class="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50">Clear</button>
        </div>
      </form>
      <div class="text-xs text-slate-500">${activeSearch ? `${items.length} matching order(s) found.` : `${items.length} order(s) loaded.`}</div>
    `;
    wrap.appendChild(searchCard);

    const searchForm = searchCard.querySelector("#orderSearchForm");
    const searchInput = searchCard.querySelector('input[name="search"]');
    const clearBtn = searchCard.querySelector("[data-clear-search]");

    searchForm.onsubmit = (e) => {
      e.preventDefault();
      state.orderSearch = searchInput.value.trim();
      renderOrders();
    };

    searchInput?.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && searchInput.value) {
        e.preventDefault();
        searchInput.value = "";
        state.orderSearch = "";
        renderOrders();
      }
    });

    clearBtn.onclick = () => {
      searchInput.value = "";
      state.orderSearch = "";
      renderOrders();
    };

    if (!items.length) {
      const empty = el("div", "rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center");
      empty.innerHTML = activeSearch
        ? `<div class="text-sm font-medium text-slate-800">No orders found for <span class="text-slate-900">${escapeHTML(activeSearch)}</span>.</div><div class="text-xs text-slate-500 mt-2">Check the order ID and try again, or click Clear to see all recent orders.</div>`
        : `<div class="text-sm text-slate-600">No orders yet.</div>`;
      wrap.appendChild(empty);
      setContent(wrap);
      return;
    }

    for (const o of items) {
      const card = el("div", "p-4 rounded-2xl border border-slate-200 bg-white space-y-4");
      const list = (o.items || [])
        .map((it) => `
          <li class="text-sm text-slate-700">
            <b>${escapeHTML(it.name)}</b> • qty ${Number(it.qty || 0)} • ${money(it.priceLKR)}
            <div class="text-xs text-slate-500 mt-1">${it.isReturnable === false ? escapeHTML(it.nonReturnableReason || "No change-of-mind return") : `Returnable • ${Number(it.warrantyDays || 0)} day(s) warranty support`}</div>
          </li>
        `)
        .join("");

      const paymentProofHtml = Array.isArray(o.paymentProofImages) && o.paymentProofImages.length
        ? `
            <div class="mt-3 flex flex-wrap gap-2">
              ${o.paymentProofImages
                .map((url) => `
                  <a href="${escapeHTML(url)}" target="_blank" rel="noopener noreferrer" class="block h-20 w-20 overflow-hidden rounded-xl border border-slate-200">
                    <img src="${escapeHTML(url)}" alt="Payment proof" class="h-full w-full object-cover" />
                  </a>
                `)
                .join("")}
            </div>
          `
        : `<div class="mt-3 text-xs text-slate-500">No payment proof uploaded.</div>`;

      const requestCards = (o.returnRequests || []).length
        ? (o.returnRequests || [])
            .map((request) => {
              const requestItems = (request.items || [])
                .map((it) => `<li>${escapeHTML(it.name || "Item")} • qty ${Number(it.qty || 0)} • ${escapeHTML(it.reasonCode || "reason")}</li>`)
                .join("");
              const evidence = Array.isArray(request.evidenceImages) && request.evidenceImages.length
                ? `
                  <div class="mt-3 flex flex-wrap gap-2">
                    ${request.evidenceImages
                      .map((url) => `
                        <a href="${escapeHTML(url)}" target="_blank" rel="noopener noreferrer" class="block h-20 w-20 overflow-hidden rounded-xl border border-slate-200">
                          <img src="${escapeHTML(url)}" alt="Return evidence" class="h-full w-full object-cover" />
                        </a>
                      `)
                      .join("")}
                  </div>
                `
                : "";

              return `
                <div class="rounded-2xl border border-slate-200 p-4 bg-slate-50">
                  <div class="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                      <div class="inline-flex rounded-full bg-slate-900 px-3 py-1 text-xs font-medium text-white">${escapeHTML(returnStatusLabel(request.status))}</div>
                      <h4 class="mt-2 text-sm font-semibold text-slate-900">${escapeHTML(request.requestNumber || "Return request")}</h4>
                      <div class="text-xs text-slate-500 mt-1">Submitted ${formatDate(request.createdAt)}</div>
                    </div>
                    <div class="text-xs text-slate-600 text-right">
                      <div><b>Requested:</b> ${escapeHTML(resolutionLabel(request.requestedResolution))}</div>
                      <div><b>Current:</b> ${escapeHTML(resolutionLabel(request.resolutionType))}</div>
                      ${request.refundAmountLKR ? `<div><b>Refund:</b> ${money(request.refundAmountLKR)}</div>` : ""}
                    </div>
                  </div>

                  <ul class="mt-3 list-disc pl-5 text-sm text-slate-700">${requestItems}</ul>
                  ${request.description ? `<div class="mt-3 text-sm text-slate-700 whitespace-pre-wrap"><b>Customer note:</b> ${escapeHTML(request.description)}</div>` : ""}
                  ${request.customerVisibleNote ? `<div class="mt-3 text-sm text-amber-700 whitespace-pre-wrap"><b>Visible to customer:</b> ${escapeHTML(request.customerVisibleNote)}</div>` : ""}
                  ${evidence}

                  <form class="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3" data-return-form="${request._id}" data-order-id="${o._id}">
                    <div>
                      <label class="text-xs font-medium text-slate-700">Status</label>
                      <select name="status" class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm">
                        ${["requested", "under_review", "approved", "awaiting_item", "received", "completed", "rejected", "cancelled"].map((status) => `<option value="${status}" ${request.status === status ? "selected" : ""}>${returnStatusLabel(status)}</option>`).join("")}
                      </select>
                    </div>
                    <div>
                      <label class="text-xs font-medium text-slate-700">Resolution</label>
                      <select name="resolutionType" class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm">
                        ${["replacement", "refund", "exchange", "store_credit", "repair", "warranty_support"].map((value) => `<option value="${value}" ${request.resolutionType === value ? "selected" : ""}>${resolutionLabel(value)}</option>`).join("")}
                      </select>
                    </div>
                    <div>
                      <label class="text-xs font-medium text-slate-700">Refund Amount (LKR)</label>
                      <input name="refundAmountLKR" type="number" value="${Number(request.refundAmountLKR || 0)}" class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
                    </div>
                    <div>
                      <label class="text-xs font-medium text-slate-700">Payment Status</label>
                      <select name="paymentStatus" class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm">
                        ${paymentStatusOptions.map((value) => `<option value="${value}" ${o.paymentStatus === value ? "selected" : ""}>${paymentStatusLabel(value)}</option>`).join("")}
                      </select>
                    </div>
                    <label class="md:col-span-2 flex items-center gap-2 text-sm text-slate-700">
                      <input type="checkbox" name="restockToInventory" ${request.restockToInventory ? "checked" : ""} class="h-4 w-4 rounded border-slate-300" />
                      <span>Restock returned quantity back to inventory when completed</span>
                    </label>
                    <div class="md:col-span-2">
                      <label class="text-xs font-medium text-slate-700">Customer-visible note</label>
                      <textarea name="customerVisibleNote" rows="2" class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm">${request.customerVisibleNote || ""}</textarea>
                    </div>
                    <div class="md:col-span-2">
                      <label class="text-xs font-medium text-slate-700">Internal admin notes</label>
                      <textarea name="adminNotes" rows="2" class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm">${request.adminNotes || ""}</textarea>
                    </div>
                    <div class="md:col-span-2 flex items-center gap-3 flex-wrap">
                      <button type="submit" class="px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-medium hover:bg-slate-800">Save Return Update</button>
                      <div data-return-status class="text-sm text-slate-600"></div>
                    </div>
                  </form>
                </div>
              `;
            })
            .join("")
        : `<div class="text-sm text-slate-500">No return requests for this order yet.</div>`;

      card.innerHTML = `
        <div class="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div class="font-semibold text-slate-900">${escapeHTML(o.customerName)} <span class="text-slate-500 font-normal">(${escapeHTML(o.phone || "-")})</span></div>
            <div class="text-xs text-slate-500 mt-1">Order ${escapeHTML(o.orderNumber || o._id)} • Created ${formatDate(o.createdAt)}</div>
            <div class="text-sm text-slate-600 mt-2 whitespace-pre-wrap">${escapeHTML(o.address || "No address provided")}</div>
            <ul class="mt-3 list-disc pl-5 space-y-2">${list}</ul>
            <div class="mt-3 text-sm"><b>Total:</b> ${money(o.totalLKR)}</div>
            ${o.deliveredAt ? `<div class="text-xs text-slate-500 mt-1">Delivered: ${formatDate(o.deliveredAt)}</div>` : ""}
          </div>
          <div class="w-full sm:w-auto grid grid-cols-1 gap-2">
            <select data-status class="text-sm rounded-xl border border-slate-300 px-3 py-2">
              ${["pending", "confirmed", "delivered", "partially_returned", "returned", "cancelled"].map((status) => `<option value="${status}" ${o.status === status ? "selected" : ""}>${status}</option>`).join("")}
            </select>
            <select data-payment-status class="text-sm rounded-xl border border-slate-300 px-3 py-2">
              ${paymentStatusOptions.map((value) => `<option value="${value}" ${o.paymentStatus === value ? "selected" : ""}>${paymentStatusLabel(value)}</option>`).join("")}
            </select>
            <button data-del class="px-3 py-2 text-sm rounded-lg border border-slate-200 hover:bg-slate-50">Delete</button>
          </div>
        </div>

        <div class="rounded-2xl border border-slate-200 p-4 bg-slate-50">
          <div class="text-sm font-semibold text-slate-900">${isFullPaymentOrder(o) ? "Full payment details" : "Advance payment details"}</div>
          <div class="mt-3 grid grid-cols-1 md:grid-cols-4 gap-3">
            <div class="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700"><div class="text-xs text-slate-500">${isFullPaymentOrder(o) ? "Paid upfront" : "Advance %"}</div><div class="mt-1 font-semibold text-slate-900">${isFullPaymentOrder(o) ? "Yes - before dispatch" : `${Number(o.advancePercent || 0)}%`}</div></div>
            <div class="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700"><div class="text-xs text-slate-500">${isFullPaymentOrder(o) ? "Full payment due" : "Advance due"}</div><div class="mt-1 font-semibold text-slate-900">${money(o.advanceDueLKR)}</div></div>
            <div class="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700"><div class="text-xs text-slate-500">${isFullPaymentOrder(o) ? "Balance remaining" : "Balance due"}</div><div class="mt-1 font-semibold text-slate-900">${money(o.balanceDueLKR)}</div></div>
            <div class="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700"><div class="text-xs text-slate-500">Payment status</div><div class="mt-1 font-semibold text-slate-900">${escapeHTML(paymentStatusLabel(o.paymentStatus))}</div></div>
          </div>

          <div class="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-slate-700">
            <div class="rounded-xl border border-slate-200 bg-white p-3">
              <div><b>Method:</b> ${escapeHTML(o.paymentMethodLabel || o.paymentMethod || "Manual payment")}</div>
              ${o.paymentReference ? `<div class="mt-2"><b>Reference:</b> ${escapeHTML(o.paymentReference)}</div>` : ""}
              ${o.paymentSubmittedAt ? `<div class="mt-2"><b>Slip submitted:</b> ${formatDate(o.paymentSubmittedAt)}</div>` : ""}
              ${o.paymentNote ? `<div class="mt-2 whitespace-pre-wrap"><b>Customer note:</b> ${escapeHTML(o.paymentNote)}</div>` : ""}
            </div>
            <div class="rounded-xl border border-slate-200 bg-white p-3">
              ${o.cryptoTxHash ? `<div><b>Crypto TX Hash:</b></div><div class="mt-2 break-all text-xs text-slate-600">${escapeHTML(o.cryptoTxHash)}</div>` : `<div class="text-slate-500">No crypto transaction hash for this order.</div>`}
            </div>
          </div>
          ${paymentProofHtml}
        </div>

        ${renderAdminDeliverySection(o)}

        <div class="rounded-2xl border border-slate-200 p-4 bg-slate-50">
          <div class="text-sm font-semibold text-slate-900">Return requests</div>
          <div class="mt-3 space-y-3">${requestCards}</div>
        </div>
      `;

      card.querySelector("[data-status]").onchange = async (e) => {
        await fetchJSON(`${API_BASE}/admin/orders/${o._id}`, { method: "PATCH", body: JSON.stringify({ status: e.target.value }) });
        renderOrders();
      };

      card.querySelector("[data-payment-status]").onchange = async (e) => {
        await fetchJSON(`${API_BASE}/admin/orders/${o._id}`, { method: "PATCH", body: JSON.stringify({ paymentStatus: e.target.value }) });
        renderOrders();
      };

      card.querySelector("[data-del]").onclick = async () => {
        if (!confirm("Delete this order?")) return;
        await fetchJSON(`${API_BASE}/admin/orders/${o._id}`, { method: "DELETE" });
        renderOrders();
      };

      const deliveryForm = card.querySelector("[data-delivery-form]");
      if (deliveryForm) {
        const deliveryStatusBox = deliveryForm.querySelector("[data-delivery-status-box]");
        const uploadBtn = deliveryForm.querySelector("[data-delivery-upload]");
        const uploadStatus = deliveryForm.querySelector("[data-delivery-upload-status]");
        const proofFileInput = deliveryForm.querySelector("[data-delivery-proof-file]");
        const proofPreview = deliveryForm.querySelector("[data-delivery-proof-preview]");
        const proofUrlInput = deliveryForm.querySelector('input[name="proofImageUrl"]');
        const deliveryBoySelect = deliveryForm.querySelector('select[name="deliveryBoyId"]');
        const deliveryBoySummary = deliveryForm.querySelector('[data-delivery-boy-summary]');
        const suggestionBtn = deliveryForm.querySelector('[data-assignment-suggest]');
        const suggestionStatus = deliveryForm.querySelector('[data-assignment-suggest-status]');

        const refreshDeliveryBoySummary = () => {
          if (deliveryBoySummary) {
            deliveryBoySummary.innerHTML = renderDeliveryBoySummaryCard(deliveryBoySelect?.value || "");
          }
        };
        deliveryBoySelect?.addEventListener("change", refreshDeliveryBoySummary);
        refreshDeliveryBoySummary();

        if (uploadBtn) {
          uploadBtn.onclick = async () => {
            const file = proofFileInput?.files?.[0];
            if (!file) {
              if (uploadStatus) uploadStatus.textContent = "Choose an image first.";
              return;
            }
            if (uploadStatus) uploadStatus.textContent = "Uploading...";
            try {
              const out = await uploadAdminFile(`/uploads/admin-delivery-proof`, file);
              const url = out?.file?.url || "";
              if (proofUrlInput) proofUrlInput.value = url;
              if (proofPreview) {
                proofPreview.innerHTML = url
                  ? `<a href="${escapeHTML(url)}" target="_blank" rel="noopener noreferrer" class="block h-24 w-24 overflow-hidden rounded-xl border border-slate-200"><img src="${escapeHTML(url)}" alt="Delivery proof" class="h-full w-full object-cover" /></a>`
                  : `<div class="text-xs text-slate-500">No delivery proof uploaded yet.</div>`;
              }
              if (uploadStatus) uploadStatus.textContent = "✅ Proof uploaded";
            } catch (err) {
              if (uploadStatus) uploadStatus.textContent = "❌ " + (err.message || err);
            }
          };
        }

        if (suggestionBtn) {
          suggestionBtn.onclick = async () => {
            if (suggestionStatus) {
              suggestionStatus.className = "text-xs text-slate-500";
              suggestionStatus.textContent = "Checking best rider...";
            }
            try {
              const routeZone = deliveryForm.elements.routeZone.value.trim();
              const scheduledDate = deliveryForm.elements.scheduledDate.value;
              const customerAddress = String(o.address || "").trim().toLowerCase();
              const qs = new URLSearchParams();
              if (routeZone && routeZone.toLowerCase() !== customerAddress) qs.set("routeZone", routeZone);
              if (scheduledDate) qs.set("scheduledDate", scheduledDate);
              const url = `${API_BASE}/admin/orders/${o._id}/delivery-suggestions${qs.toString() ? `?${qs.toString()}` : ""}`;
              const out = await fetchJSON(url);
              const best = out?.recommended;
              if (!best) {
                if (suggestionStatus) {
                  suggestionStatus.className = "text-xs text-red-600";
                  suggestionStatus.textContent = "No active delivery boys found.";
                }
                return;
              }
              if (deliveryBoySelect) deliveryBoySelect.value = best.deliveryBoyId || "";
              if (!deliveryForm.elements.routeZone.value && out?.routeZone) deliveryForm.elements.routeZone.value = out.routeZone;
              
              refreshDeliveryBoySummary();
              if (suggestionStatus) {
                suggestionStatus.className = "text-xs text-emerald-700";
                suggestionStatus.textContent = `${best.fullName} suggested • ${best.rationale}`;
              }
            } catch (err) {
              if (suggestionStatus) {
                suggestionStatus.className = "text-xs text-red-600";
                suggestionStatus.textContent = "❌ " + (err.message || err);
              }
            }
          };
        }

        deliveryForm.onsubmit = async (e) => {
          e.preventDefault();
          if (deliveryStatusBox) {
            deliveryStatusBox.className = "text-sm text-slate-600";
            deliveryStatusBox.textContent = "Saving delivery update...";
          }

          const fields = deliveryForm.elements;
          const payload = {
            status: fields.status.value,
            scheduledDate: fields.scheduledDate.value || null,
            scheduledWindow: fields.scheduledWindow.value.trim(),
            deliveryBoyId: fields.deliveryBoyId.value || "",
            routeZone: fields.routeZone.value.trim(),
            routePriority: fields.routePriority.value,
            assignmentStatus: fields.assignmentStatus.value,
            assignmentNote: fields.assignmentNote.value.trim(),
            driverName: fields.driverName.value.trim(),
            driverPhone: fields.driverPhone.value.trim(),
            vehicleNumber: fields.vehicleNumber.value.trim(),
            siteContactName: fields.siteContactName.value.trim(),
            siteContactPhone: fields.siteContactPhone.value.trim(),
            unloadingSupport: fields.unloadingSupport.value,
            balanceCollectionMode: fields.balanceCollectionMode.value,
            requiresCallBeforeDelivery: !!fields.requiresCallBeforeDelivery.checked,
            allowSplitDelivery: !!fields.allowSplitDelivery.checked,
            accessNotes: fields.accessNotes.value.trim(),
            issueReason: fields.issueReason.value.trim(),
            publicNote: fields.publicNote.value.trim(),
            adminNote: fields.adminNote.value.trim(),
            proofRecipientName: fields.proofRecipientName.value.trim(),
            proofImageUrl: proofUrlInput?.value?.trim() || "",
            eventNote: fields.eventNote.value.trim()
          };

          const verificationCodeInput = fields.verificationCodeInput.value.trim();
          if (verificationCodeInput) payload.verificationCodeInput = verificationCodeInput;

          try {
            await fetchJSON(`${API_BASE}/admin/orders/${o._id}/delivery`, {
              method: "PATCH",
              body: JSON.stringify(payload)
            });
            if (deliveryStatusBox) {
              deliveryStatusBox.className = "text-sm text-emerald-700";
              deliveryStatusBox.textContent = "Delivery update saved";
            }
            renderOrders();
          } catch (err) {
            if (deliveryStatusBox) {
              deliveryStatusBox.className = "text-sm text-red-600";
              deliveryStatusBox.textContent = "❌ " + (err.message || err);
            }
          }
        };
      }

      card.querySelectorAll("[data-return-form]").forEach((form) => {
        form.onsubmit = async (e) => {
          e.preventDefault();
          const requestId = form.getAttribute("data-return-form");
          const statusBox = form.querySelector("[data-return-status]");
          if (statusBox) {
            statusBox.className = "text-sm text-slate-600";
            statusBox.textContent = "Saving...";
          }
          try {
            await fetchJSON(`${API_BASE}/admin/orders/${o._id}/returns/${requestId}`, {
              method: "PATCH",
              body: JSON.stringify({
                status: form.status.value,
                resolutionType: form.resolutionType.value,
                refundAmountLKR: Number(form.refundAmountLKR.value || 0),
                paymentStatus: form.paymentStatus.value,
                restockToInventory: !!form.restockToInventory.checked,
                customerVisibleNote: form.customerVisibleNote.value.trim(),
                adminNotes: form.adminNotes.value.trim()
              })
            });
            if (statusBox) {
              statusBox.className = "text-sm text-emerald-700";
              statusBox.textContent = "Saved";
            }
            renderOrders();
          } catch (err) {
            if (statusBox) {
              statusBox.className = "text-sm text-red-600";
              statusBox.textContent = "❌ " + (err.message || err);
            }
          }
        };
      });

      wrap.appendChild(card);
    }

    setContent(wrap);
  }

  function openDeliveryBoyModal(existing = null) {
    const form = el("form", "grid grid-cols-1 md:grid-cols-2 gap-3");
    form.appendChild(inputRow("Full name", "fullName", existing?.fullName || ""));
    form.appendChild(inputRow("Username", "username", existing?.username || ""));
    form.appendChild(inputRow("Phone", "phone", existing?.phone || ""));
    form.appendChild(inputRow("Vehicle number", "vehicleNumber", existing?.vehicleNumber || ""));
    form.appendChild(inputRow("Vehicle type", "vehicleType", existing?.vehicleType || "Owner vehicle"));
    form.appendChild(inputRow("Service areas", "serviceAreas", Array.isArray(existing?.serviceAreas) ? existing.serviceAreas.join(", ") : "", "text", "e.g. Maharagama, Kottawa, Nugegoda"));
    form.appendChild(inputRow("Max daily stops", "maxDailyStops", existing?.maxDailyStops || 8, "number"));
    form.appendChild(inputRow("Max concurrent assignments", "maxConcurrentAssignments", existing?.maxConcurrentAssignments || 4, "number"));
    form.appendChild(selectRow("Availability", "availabilityStatus", existing?.availabilityStatus || "available", Object.entries(DELIVERY_BOY_AVAILABILITY_META).map(([value, label]) => ({ value, label }))));
    const noteWrap = textareaRow("Notes", "notes", existing?.notes || "");
    noteWrap.classList.add("md:col-span-2");
    form.appendChild(noteWrap);
    if (!existing) {
      form.appendChild(inputRow("Password", "password", "", "password"));
    }
    const activeWrap = el("div", "md:col-span-2");
    activeWrap.appendChild(checkboxRow("Active account", "isActive", existing ? existing.isActive !== false : true));
    form.appendChild(activeWrap);

    modal(existing ? `Edit ${existing.fullName}` : "Add delivery boy", form, async () => {
      const payload = {
        fullName: form.querySelector('[name="fullName"]').value.trim(),
        username: form.querySelector('[name="username"]').value.trim(),
        phone: form.querySelector('[name="phone"]').value.trim(),
        vehicleNumber: form.querySelector('[name="vehicleNumber"]').value.trim(),
        vehicleType: form.querySelector('[name="vehicleType"]').value.trim(),
        serviceAreas: form.querySelector('[name="serviceAreas"]').value.trim(),
        maxDailyStops: Number(form.querySelector('[name="maxDailyStops"]').value || 1),
        maxConcurrentAssignments: Number(form.querySelector('[name="maxConcurrentAssignments"]').value || 1),
        availabilityStatus: form.querySelector('[name="availabilityStatus"]').value,
        notes: form.querySelector('[name="notes"]').value.trim(),
        isActive: !!form.querySelector('[name="isActive"]').checked
      };
      if (!existing) {
        payload.password = form.querySelector('[name="password"]').value;
      }
      await fetchJSON(existing ? `${API_BASE}/admin/delivery-boys/${existing._id}` : `${API_BASE}/admin/delivery-boys`, {
        method: existing ? "PATCH" : "POST",
        body: JSON.stringify(payload)
      });
      await renderDeliveryTeam();
    });
  }

  function openDeliveryBoyPasswordResetModal(item) {
    const form = el("form", "grid grid-cols-1 gap-3");
    form.appendChild(inputRow("New password", "newPassword", "", "password"));
    modal(`Reset password • ${item.fullName}`, form, async () => {
      const payload = { newPassword: form.querySelector('[name="newPassword"]').value };
      await fetchJSON(`${API_BASE}/admin/delivery-boys/${item._id}/reset-password`, {
        method: "POST",
        body: JSON.stringify(payload)
      });
      alert("✅ Password reset successfully.");
    });
  }

  async function renderDeliveryTeam() {
    setHeader("Delivery Team", `<button id="addDeliveryBoyBtn" class="px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-medium hover:bg-slate-800">Add Delivery Boy</button>`);
    setContent(`<div class="text-sm text-slate-700">Loading delivery team...</div>`);

    const data = await fetchJSON(`${API_BASE}/admin/delivery-boys`);
    state.deliveryBoys = data.items || [];
    state.deliveryTeamRecentActivities = data.recentActivities || [];

    const items = state.deliveryBoys;
    const recentActivities = state.deliveryTeamRecentActivities;
    const wrap = el("div", "space-y-4");

    const totalActiveAssignments = items.reduce((sum, item) => sum + Number(item?.stats?.activeAssignments || 0), 0);
    const availableCount = items.filter((item) => item.isActive !== false && item.availabilityStatus === "available").length;
    const onRouteCount = items.filter((item) => item.availabilityStatus === "on_route").length;

    wrap.innerHTML = `
      <div class="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4"><div class="text-xs text-slate-500">Total riders</div><div class="mt-1 text-2xl font-semibold text-slate-900">${items.length}</div></div>
        <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4"><div class="text-xs text-slate-500">Available now</div><div class="mt-1 text-2xl font-semibold text-slate-900">${availableCount}</div></div>
        <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4"><div class="text-xs text-slate-500">On route</div><div class="mt-1 text-2xl font-semibold text-slate-900">${onRouteCount}</div></div>
        <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4"><div class="text-xs text-slate-500">Active assigned jobs</div><div class="mt-1 text-2xl font-semibold text-slate-900">${totalActiveAssignments}</div></div>
      </div>

      <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
        Delivery portal URL: <a href="../delivery/login.html" class="font-semibold text-slate-900 underline" target="_blank" rel="noopener noreferrer">../delivery/login.html</a>
      </div>
    `;

    const grid = el("div", "grid grid-cols-1 xl:grid-cols-2 gap-4");
    if (!items.length) {
      const empty = el("div", "rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500", "No delivery boys added yet.");
      grid.appendChild(empty);
    }

    for (const item of items) {
      const card = el("div", "rounded-2xl border border-slate-200 bg-white p-4 space-y-4");
      const areas = (item.serviceAreas || []).map((area) => `<span class="px-2 py-1 rounded-full bg-slate-100 text-slate-700 text-xs">${escapeHTML(area)}</span>`).join(" ") || `<span class="text-xs text-slate-500">No route areas set</span>`;
      const assignments = (item.currentAssignments || []).map((assignment) => `
        <div class="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
          <div class="font-medium text-slate-900">${escapeHTML(assignment.orderNumber)}</div>
          <div class="text-xs text-slate-500 mt-1">${escapeHTML(assignment.customerName || "-")} • ${escapeHTML(assignment.routeZone || "No zone")}</div>
          <div class="text-xs text-slate-500 mt-1">${assignment.scheduledDate ? escapeHTML(formatDate(assignment.scheduledDate)) : "No schedule yet"}</div>
        </div>
      `).join("") || `<div class="text-sm text-slate-500">No active assignments.</div>`;

      card.innerHTML = `
        <div class="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div class="text-lg font-semibold text-slate-900">${escapeHTML(item.fullName)}</div>
            <div class="text-xs text-slate-500 mt-1">@${escapeHTML(item.username)} • ${escapeHTML(item.phone || "-")}</div>
            <div class="text-xs text-slate-500 mt-1">${escapeHTML(item.vehicleType || "Owner vehicle")} • ${escapeHTML(item.vehicleNumber || "Vehicle not set")}</div>
          </div>
          <div class="flex items-center gap-2 flex-wrap justify-end">
            <span class="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">${escapeHTML(DELIVERY_BOY_AVAILABILITY_META[item.availabilityStatus] || item.availabilityStatus || "available")}</span>
            <span class="inline-flex rounded-full ${item.isActive === false ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"} px-3 py-1 text-xs font-medium">${item.isActive === false ? "Inactive" : "Active"}</span>
          </div>
        </div>

        <div class="flex flex-wrap gap-1">${areas}</div>

        <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div class="rounded-xl border border-slate-200 bg-slate-50 p-3"><div class="text-xs text-slate-500">Active jobs</div><div class="mt-1 text-lg font-semibold text-slate-900">${Number(item?.stats?.activeAssignments || 0)}</div></div>
          <div class="rounded-xl border border-slate-200 bg-slate-50 p-3"><div class="text-xs text-slate-500">Today stops</div><div class="mt-1 text-lg font-semibold text-slate-900">${Number(item?.stats?.todaysStops || 0)}</div></div>
          <div class="rounded-xl border border-slate-200 bg-slate-50 p-3"><div class="text-xs text-slate-500">Done this week</div><div class="mt-1 text-lg font-semibold text-slate-900">${Number(item?.stats?.completedThisWeek || 0)}</div></div>
          <div class="rounded-xl border border-slate-200 bg-slate-50 p-3"><div class="text-xs text-slate-500">Utilization</div><div class="mt-1 text-lg font-semibold text-slate-900">${Number(item?.stats?.utilizationPct || 0)}%</div></div>
        </div>

        <div>
          <div class="text-sm font-semibold text-slate-900">Current assignments</div>
          <div class="mt-3 space-y-2">${assignments}</div>
        </div>

        ${item.notes ? `<div class="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 whitespace-pre-wrap"><b>Notes:</b> ${escapeHTML(item.notes)}</div>` : ""}

        <div class="flex items-center gap-2 flex-wrap">
          <button data-edit class="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50">Edit</button>
          <button data-reset class="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50">Reset Password</button>
          <button data-toggle-active class="px-4 py-2 rounded-xl ${item.isActive === false ? "bg-emerald-600 hover:bg-emerald-500 text-white" : "bg-red-600 hover:bg-red-500 text-white"} text-sm font-medium">${item.isActive === false ? "Reactivate" : "Deactivate"}</button>
        </div>
      `;

      card.querySelector("[data-edit]").onclick = () => openDeliveryBoyModal(item);
      card.querySelector("[data-reset]").onclick = () => openDeliveryBoyPasswordResetModal(item);
      card.querySelector("[data-toggle-active]").onclick = async () => {
        if (item.isActive === false) {
          await fetchJSON(`${API_BASE}/admin/delivery-boys/${item._id}`, {
            method: "PATCH",
            body: JSON.stringify({ isActive: true, availabilityStatus: item.availabilityStatus === "off_duty" ? "available" : item.availabilityStatus })
          });
        } else {
          if (!confirm(`Deactivate ${item.fullName}?`)) return;
          await fetchJSON(`${API_BASE}/admin/delivery-boys/${item._id}`, { method: "DELETE" });
        }
        await renderDeliveryTeam();
      };
      grid.appendChild(card);
    }
    wrap.appendChild(grid);

    const activityCard = el("div", "rounded-2xl border border-slate-200 bg-white p-4");
    activityCard.innerHTML = `
      <div class="text-sm font-semibold text-slate-900">Recent delivery-boy activity</div>
      <div class="mt-3 space-y-2">
        ${recentActivities.length ? recentActivities.map((log) => `
          <div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
            <div class="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <div class="font-medium text-slate-900">${escapeHTML(log.actorName || "Rider")} • ${escapeHTML(log.orderNumber || "-")}</div>
                <div class="text-xs text-slate-500 mt-1">${escapeHTML(formatDate(log.createdAt))} • ${escapeHTML(log.routeZone || "No zone")}</div>
              </div>
              <div class="inline-flex rounded-full bg-white px-2.5 py-1 text-xs text-slate-700 border border-slate-200">${escapeHTML((log.activityType || "note").replaceAll("_", " "))}</div>
            </div>
            ${log.note ? `<div class="mt-2 whitespace-pre-wrap">${escapeHTML(log.note)}</div>` : ""}
            ${log.publicNote ? `<div class="mt-2 text-xs text-blue-700"><b>Customer note:</b> ${escapeHTML(log.publicNote)}</div>` : ""}
          </div>
        `).join("") : `<div class="text-sm text-slate-500">No rider activity logs yet.</div>`}
      </div>
    `;
    wrap.appendChild(activityCard);

    setContent(wrap);
    document.getElementById("addDeliveryBoyBtn")?.addEventListener("click", () => openDeliveryBoyModal());
  }

  async function renderReviews() {
    setHeader("Reviews");
    setContent(`<div class="text-sm text-slate-700">Loading...</div>`);
    const items = await fetchJSON(`${API_BASE}/admin/reviews`);

    const wrap = el("div", "space-y-3");
    wrap.innerHTML = items.length ? "" : `<div class="text-sm text-slate-600">No reviews yet.</div>`;
    for (const r of items) {
      const card = el("div", "p-4 rounded-2xl border border-slate-200");
      card.innerHTML = `
        <div class="flex items-start justify-between gap-4">
          <div>
            <div class="font-semibold text-slate-900">${r.customerName}</div>
            <div class="text-sm text-slate-600 mt-1">Rating: ${"★★★★★☆☆☆☆☆".slice(5 - Math.round(r.rating), 10 - Math.round(r.rating))} (${r.rating}/5)</div>
            <div class="text-sm text-slate-700 mt-2 whitespace-pre-wrap">${r.feedback}</div>
            <div class="text-xs text-slate-500 mt-2">${formatDate(r.createdAt)}</div>
          </div>
          <button data-del class="px-3 py-1.5 text-sm rounded-lg border border-slate-200 hover:bg-slate-50">Delete</button>
        </div>
      `;
      card.querySelector("[data-del]").onclick = async () => {
        if (!confirm("Delete this review?")) return;
        await fetchJSON(`${API_BASE}/admin/reviews/${r._id}`, { method: "DELETE" });
        renderReviews();
      };
      wrap.appendChild(card);
    }
    setContent(wrap);
  }

  // --- Settings ---
  async function renderSettings() {
    setHeader("Settings", `<button id="saveBtn" class="px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-medium hover:bg-slate-800">Save Settings</button>`);
    setContent(`<div class="text-sm text-slate-700">Loading...</div>`);
    const s = await fetchJSON(`${API_BASE}/admin/settings`);

    const form = el("form", "space-y-6");

    const section = (title, subtitle = "") => {
      const card = el("section", "rounded-2xl border border-slate-200 bg-white p-4 space-y-4");
      card.innerHTML = `
        <div>
          <h3 class="text-lg font-semibold text-slate-900">${escapeHTML(title)}</h3>
          ${subtitle ? `<p class="text-sm text-slate-500 mt-1">${escapeHTML(subtitle)}</p>` : ""}
        </div>
      `;
      return card;
    };

    const general = section("General Site Settings", "Brand, contact and WhatsApp details used across the website.");
    const generalGrid = el("div", "grid grid-cols-1 lg:grid-cols-2 gap-4");
    generalGrid.appendChild(inputRow("Site Name", "siteName", s.siteName));
    generalGrid.appendChild(inputRow("Tagline", "tagline", s.tagline));
    generalGrid.appendChild(inputRow("Email", "email", s.email));
    generalGrid.appendChild(inputRow("Phone", "phone", s.phone));
    generalGrid.appendChild(inputRow("Address", "address", s.address));
    generalGrid.appendChild(inputRow("Facebook URL", "facebook", s.facebook));
    generalGrid.appendChild(inputRow("Instagram URL", "instagram", s.instagram));
    generalGrid.appendChild(inputRow("WhatsApp Number", "whatsapp", s.whatsapp, "text", "Use international format e.g. 9471xxxxxxx"));
    generalGrid.appendChild(inputRow("Hero Title", "heroTitle", s.heroTitle));
    generalGrid.appendChild(textareaRow("Hero Subtitle", "heroSubtitle", s.heroSubtitle));
    general.appendChild(generalGrid);
    form.appendChild(general);

    const policy = section("Advance Payment Policy", "Configure the default advance percentage and the customer-facing terms shown before checkout.");
    const policyGrid = el("div", "grid grid-cols-1 lg:grid-cols-2 gap-4");
    policyGrid.appendChild(inputRow("Required Advance %", "orderAdvancePercent", s.orderAdvancePercent ?? 25, "number"));
    policyGrid.appendChild(textareaRow("Advance Terms", "advanceTermsText", s.advanceTermsText || ""));
    policyGrid.appendChild(textareaRow("Balance Terms", "balanceTermsText", s.balanceTermsText || ""));
    policyGrid.appendChild(textareaRow("Cancellation / Special Order Terms", "cancellationTermsText", s.cancellationTermsText || ""));
    policyGrid.appendChild(textareaRow("WhatsApp Checkout Note", "whatsappCheckoutNote", s.whatsappCheckoutNote || ""));
    policy.appendChild(policyGrid);
    form.appendChild(policy);

    const delivery = section("Own Vehicle Delivery Settings", "Customer-visible rules for hardware deliveries handled by the owner vehicle and delivery boy.");
    const deliveryGrid = el("div", "grid grid-cols-1 lg:grid-cols-2 gap-4");
    deliveryGrid.appendChild(inputRow("Delivery service label", "deliveryServiceLabel", s.deliveryServiceLabel || "Owner vehicle delivery"));
    deliveryGrid.appendChild(inputRow("Lead time text", "deliveryLeadTimeText", s.deliveryLeadTimeText || "1 to 3 working days after advance verification"));
    deliveryGrid.appendChild(inputRow("Coverage text", "deliveryCoverageText", s.deliveryCoverageText || "Delivery radius based on route planning and order value"));
    deliveryGrid.appendChild(inputRow("Window text", "deliveryWindowText", s.deliveryWindowText || "Scheduled route / call before arrival"));
    deliveryGrid.appendChild(textareaRow("Access / unloading terms", "deliveryAccessTermsText", s.deliveryAccessTermsText || "Customer must ensure road access, unloading space and labour / equipment for heavy materials."));
    deliveryGrid.appendChild(textareaRow("Inspection / handover text", "deliveryInspectionText", s.deliveryInspectionText || "Customer should inspect visible damage, count materials and sign / confirm at handover."));
    delivery.appendChild(deliveryGrid);
    form.appendChild(delivery);

    const banking = section("Bank / Manual Payment Methods", "Enable the free/manual methods and set the account details customers will see during checkout.");
    const bankingToggles = el("div", "grid grid-cols-1 md:grid-cols-3 gap-4");
    bankingToggles.appendChild(checkboxRow("Enable bank transfer", "bankTransferEnabled", s.bankTransferEnabled !== false));
    bankingToggles.appendChild(checkboxRow("Enable cash deposit", "cashDepositEnabled", s.cashDepositEnabled !== false));
    bankingToggles.appendChild(checkboxRow("Enable mobile banking / app transfer", "mobileBankingEnabled", s.mobileBankingEnabled !== false));
    banking.appendChild(bankingToggles);
    const bankingGrid = el("div", "grid grid-cols-1 lg:grid-cols-2 gap-4");
    bankingGrid.appendChild(inputRow("Bank Name", "bankName", s.bankName || ""));
    bankingGrid.appendChild(inputRow("Bank Branch", "bankBranch", s.bankBranch || ""));
    bankingGrid.appendChild(inputRow("Account Name", "bankAccountName", s.bankAccountName || ""));
    bankingGrid.appendChild(inputRow("Account Number", "bankAccountNumber", s.bankAccountNumber || ""));
    bankingGrid.appendChild(textareaRow("Bank Transfer Instructions", "bankInstructions", s.bankInstructions || ""));
    bankingGrid.appendChild(textareaRow("Cash Deposit Instructions", "cashDepositInstructions", s.cashDepositInstructions || ""));
    bankingGrid.appendChild(inputRow("Mobile Banking Receiver Name", "mobileBankingName", s.mobileBankingName || ""));
    bankingGrid.appendChild(inputRow("Mobile Banking Number / ID", "mobileBankingNumber", s.mobileBankingNumber || ""));
    bankingGrid.appendChild(textareaRow("Mobile Banking Instructions", "mobileBankingInstructions", s.mobileBankingInstructions || ""));
    banking.appendChild(bankingGrid);
    form.appendChild(banking);

    const digital = section("Skrill + Crypto", "Optional extra payment channels for international or digital-wallet customers.");
    const digitalToggles = el("div", "grid grid-cols-1 md:grid-cols-2 gap-4");
    digitalToggles.appendChild(checkboxRow("Enable Skrill", "skrillEnabled", !!s.skrillEnabled));
    digitalToggles.appendChild(checkboxRow("Enable Crypto", "cryptoEnabled", !!s.cryptoEnabled));
    digital.appendChild(digitalToggles);
    const digitalGrid = el("div", "grid grid-cols-1 lg:grid-cols-2 gap-4");
    digitalGrid.appendChild(inputRow("Skrill Email", "skrillEmail", s.skrillEmail || ""));
    digitalGrid.appendChild(textareaRow("Skrill Instructions", "skrillInstructions", s.skrillInstructions || ""));
    digitalGrid.appendChild(inputRow("Crypto Currency", "cryptoCurrency", s.cryptoCurrency || "USDT"));
    digitalGrid.appendChild(inputRow("Crypto Network", "cryptoNetwork", s.cryptoNetwork || "TRC20"));
    digitalGrid.appendChild(inputRow("Crypto Wallet Address", "cryptoWalletAddress", s.cryptoWalletAddress || ""));
    digitalGrid.appendChild(textareaRow("Crypto Instructions", "cryptoInstructions", s.cryptoInstructions || ""));
    digital.appendChild(digitalGrid);

    const qrCard = el("div", "rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3");
    qrCard.innerHTML = `
      <div class="text-sm font-semibold text-slate-900">Crypto QR Code</div>
      <p class="text-sm text-slate-500">Upload a wallet QR image that the customer can scan directly from checkout.</p>
      <div class="flex items-center gap-3 flex-wrap">
        <input type="hidden" name="cryptoQrImageUrl" value="${escapeHTML(s.cryptoQrImageUrl || "")}">
        <input type="file" name="cryptoQrFile" accept="image/png,image/jpeg,image/webp" class="text-sm">
        <button type="button" id="uploadCryptoQrBtn" class="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50">Upload QR</button>
        <span id="cryptoQrStatus" class="text-sm text-slate-500"></span>
      </div>
      <div>
        <img id="cryptoQrPreview" src="${escapeHTML(s.cryptoQrImageUrl || "")}" alt="Crypto QR Preview" style="${s.cryptoQrImageUrl ? "display:block" : "display:none"};max-width:220px;border-radius:16px;border:1px solid #e2e8f0;background:#fff;padding:10px" />
      </div>
    `;
    digital.appendChild(qrCard);
    form.appendChild(digital);

    setContent(form);

    const qrButton = document.getElementById("uploadCryptoQrBtn");
    const qrStatus = document.getElementById("cryptoQrStatus");
    const qrPreview = document.getElementById("cryptoQrPreview");
    if (qrButton) {
      qrButton.onclick = async () => {
        const file = form.cryptoQrFile?.files?.[0];
        if (!file) {
          if (qrStatus) qrStatus.textContent = "Choose an image first.";
          return;
        }
        if (qrStatus) qrStatus.textContent = "Uploading...";
        try {
          const out = await uploadAdminFile(`/uploads/admin-crypto-qr`, file);
          const url = out?.file?.url || "";
          form.cryptoQrImageUrl.value = url;
          if (qrPreview && url) {
            qrPreview.src = url;
            qrPreview.style.display = "block";
          }
          if (qrStatus) qrStatus.textContent = "✅ QR uploaded";
        } catch (err) {
          if (qrStatus) qrStatus.textContent = "❌ " + (err.message || err);
        }
      };
    }

    document.getElementById("saveBtn").onclick = async () => {
      const payload = {
        siteName: form.siteName.value.trim(),
        tagline: form.tagline.value.trim(),
        email: form.email.value.trim(),
        phone: form.phone.value.trim(),
        address: form.address.value.trim(),
        facebook: form.facebook.value.trim(),
        instagram: form.instagram.value.trim(),
        whatsapp: form.whatsapp.value.trim(),
        heroTitle: form.heroTitle.value.trim(),
        heroSubtitle: form.heroSubtitle.value.trim(),

        orderAdvancePercent: Number(form.orderAdvancePercent.value || 25),
        advanceTermsText: form.advanceTermsText.value.trim(),
        balanceTermsText: form.balanceTermsText.value.trim(),
        cancellationTermsText: form.cancellationTermsText.value.trim(),
        whatsappCheckoutNote: form.whatsappCheckoutNote.value.trim(),

        deliveryServiceLabel: form.deliveryServiceLabel.value.trim(),
        deliveryLeadTimeText: form.deliveryLeadTimeText.value.trim(),
        deliveryCoverageText: form.deliveryCoverageText.value.trim(),
        deliveryWindowText: form.deliveryWindowText.value.trim(),
        deliveryAccessTermsText: form.deliveryAccessTermsText.value.trim(),
        deliveryInspectionText: form.deliveryInspectionText.value.trim(),

        bankTransferEnabled: !!form.bankTransferEnabled.checked,
        cashDepositEnabled: !!form.cashDepositEnabled.checked,
        mobileBankingEnabled: !!form.mobileBankingEnabled.checked,
        bankName: form.bankName.value.trim(),
        bankBranch: form.bankBranch.value.trim(),
        bankAccountName: form.bankAccountName.value.trim(),
        bankAccountNumber: form.bankAccountNumber.value.trim(),
        bankInstructions: form.bankInstructions.value.trim(),
        cashDepositInstructions: form.cashDepositInstructions.value.trim(),
        mobileBankingName: form.mobileBankingName.value.trim(),
        mobileBankingNumber: form.mobileBankingNumber.value.trim(),
        mobileBankingInstructions: form.mobileBankingInstructions.value.trim(),

        skrillEnabled: !!form.skrillEnabled.checked,
        skrillEmail: form.skrillEmail.value.trim(),
        skrillInstructions: form.skrillInstructions.value.trim(),

        cryptoEnabled: !!form.cryptoEnabled.checked,
        cryptoCurrency: form.cryptoCurrency.value.trim(),
        cryptoNetwork: form.cryptoNetwork.value.trim(),
        cryptoWalletAddress: form.cryptoWalletAddress.value.trim(),
        cryptoQrImageUrl: form.cryptoQrImageUrl.value.trim(),
        cryptoInstructions: form.cryptoInstructions.value.trim()
      };
      await fetchJSON(`${API_BASE}/admin/settings`, { method: "PUT", body: JSON.stringify(payload) });
      alert("✅ Settings saved. Refresh the storefront checkout to see the updated payment flow.");
    };
  }


  return { mountLogin, mountApp };
})();
