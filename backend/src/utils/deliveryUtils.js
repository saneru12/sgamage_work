const DELIVERY_STATUSES = [
  "awaiting_advance_verification",
  "confirmed",
  "scheduling_in_progress",
  "scheduled",
  "packed",
  "out_for_delivery",
  "arriving_soon",
  "delivered",
  "delivery_issue",
  "rescheduled",
  "cancelled"
];

const DELIVERY_TIME_SLOT_OPTIONS = [
  "morning_8_11",
  "midday_11_2",
  "afternoon_2_5",
  "full_day_8_5",
  "call_to_confirm"
];

const UNLOADING_SUPPORT_OPTIONS = [
  "customer_team_available",
  "delivery_boy_only",
  "site_labour_required",
  "forklift_available",
  "unsure"
];

const BALANCE_COLLECTION_MODES = [
  "before_dispatch",
  "cash_on_delivery",
  "bank_transfer_before_delivery",
  "card_or_transfer_on_arrival",
  "already_paid",
  "to_be_confirmed"
];

const DELIVERY_BOY_AVAILABILITY = ["available", "on_route", "off_duty", "leave"];
const DELIVERY_ASSIGNMENT_STATUSES = ["unassigned", "assigned", "accepted", "issue_reported", "completed"];
const DELIVERY_ROUTE_PRIORITIES = ["low", "normal", "high", "urgent"];
const DELIVERY_ACTIVITY_TYPES = [
  "assignment",
  "accepted",
  "status_update",
  "load_check",
  "departure",
  "arrival",
  "delivery_completed",
  "issue",
  "reschedule",
  "proof_uploaded",
  "note"
];

const DELIVERY_STATUS_META = {
  awaiting_advance_verification: {
    label: "Payment under review",
    timelineTitle: "Payment submitted",
    orderStatus: "pending"
  },
  confirmed: {
    label: "Order confirmed",
    timelineTitle: "Order confirmed for delivery",
    orderStatus: "confirmed"
  },
  scheduling_in_progress: {
    label: "Planning delivery",
    timelineTitle: "Delivery planning started",
    orderStatus: "confirmed"
  },
  scheduled: {
    label: "Delivery scheduled",
    timelineTitle: "Delivery window scheduled",
    orderStatus: "confirmed"
  },
  packed: {
    label: "Packed & ready",
    timelineTitle: "Order packed and ready",
    orderStatus: "confirmed"
  },
  out_for_delivery: {
    label: "Out for delivery",
    timelineTitle: "Vehicle dispatched",
    orderStatus: "confirmed"
  },
  arriving_soon: {
    label: "Arriving soon",
    timelineTitle: "Driver is nearby",
    orderStatus: "confirmed"
  },
  delivered: {
    label: "Delivered",
    timelineTitle: "Delivery completed",
    orderStatus: "delivered"
  },
  delivery_issue: {
    label: "Delivery issue",
    timelineTitle: "Delivery issue reported",
    orderStatus: "confirmed"
  },
  rescheduled: {
    label: "Rescheduled",
    timelineTitle: "Delivery rescheduled",
    orderStatus: "confirmed"
  },
  cancelled: {
    label: "Cancelled",
    timelineTitle: "Delivery cancelled",
    orderStatus: "cancelled"
  }
};

function normalizeText(value = "") {
  return String(value || "").trim();
}

function normalizeDeliveryUsername(value = "") {
  return normalizeText(value).toLowerCase();
}

function normalizeStringArray(value) {
  const rawItems = Array.isArray(value)
    ? value
    : String(value || "")
        .split(/[\n,|]/g)
        .map((item) => item.trim());

  return [...new Set(rawItems.map((item) => normalizeText(item)).filter(Boolean))];
}

function getDeliveryStatusMeta(status = "") {
  return DELIVERY_STATUS_META[normalizeText(status)] || DELIVERY_STATUS_META.awaiting_advance_verification;
}

function normalizeOptionalDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function generateDeliveryVerificationCode() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

function getDeliveryTimeSlotLabel(value = "") {
  const key = normalizeText(value);
  return {
    morning_8_11: "Morning (8:00 AM - 11:00 AM)",
    midday_11_2: "Midday (11:00 AM - 2:00 PM)",
    afternoon_2_5: "Afternoon (2:00 PM - 5:00 PM)",
    full_day_8_5: "Full day route (8:00 AM - 5:00 PM)",
    call_to_confirm: "Call to confirm"
  }[key] || "Call to confirm";
}

function buildDeliveryEvent(status, note = "", actor = "system") {
  const safeStatus = DELIVERY_STATUSES.includes(normalizeText(status))
    ? normalizeText(status)
    : "awaiting_advance_verification";
  const meta = getDeliveryStatusMeta(safeStatus);
  return {
    status: safeStatus,
    title: meta.timelineTitle,
    note: normalizeText(note),
    actor: normalizeText(actor) || "system",
    createdAt: new Date()
  };
}

function createDeliveryActivityLog({
  activityType = "note",
  deliveryStatus = "",
  note = "",
  publicNote = "",
  proofImageUrl = "",
  recipientName = "",
  verificationCodeChecked = false,
  actorRole = "system",
  actorName = "system",
  actorId = ""
} = {}) {
  const safeActivityType = DELIVERY_ACTIVITY_TYPES.includes(normalizeText(activityType))
    ? normalizeText(activityType)
    : "note";
  const safeDeliveryStatus = DELIVERY_STATUSES.includes(normalizeText(deliveryStatus))
    ? normalizeText(deliveryStatus)
    : "";
  return {
    activityType: safeActivityType,
    deliveryStatus: safeDeliveryStatus,
    note: normalizeText(note),
    publicNote: normalizeText(publicNote),
    proofImageUrl: normalizeText(proofImageUrl),
    recipientName: normalizeText(recipientName),
    verificationCodeChecked: !!verificationCodeChecked,
    actorRole: ["system", "admin", "delivery_boy"].includes(normalizeText(actorRole))
      ? normalizeText(actorRole)
      : "system",
    actorName: normalizeText(actorName) || "system",
    actorId: normalizeText(actorId),
    createdAt: new Date()
  };
}

function ensureDeliveryContainer(order) {
  if (!order.delivery) {
    order.delivery = {
      status: "awaiting_advance_verification",
      method: "own_vehicle",
      serviceLabel: "Owner vehicle delivery",
      verificationCode: generateDeliveryVerificationCode(),
      events: [],
      activityLogs: []
    };
  }
  if (!Array.isArray(order.delivery.events)) order.delivery.events = [];
  if (!Array.isArray(order.delivery.activityLogs)) order.delivery.activityLogs = [];
  if (!order.delivery.verificationCode) order.delivery.verificationCode = generateDeliveryVerificationCode();
  if (!order.delivery.status) order.delivery.status = "awaiting_advance_verification";
  if (!order.delivery.method) order.delivery.method = "own_vehicle";
  if (!order.delivery.serviceLabel) order.delivery.serviceLabel = "Owner vehicle delivery";
  if (!order.delivery.assignmentStatus) {
    order.delivery.assignmentStatus = order.delivery.assignedDeliveryBoyId ? "assigned" : "unassigned";
  }
  if (!DELIVERY_ROUTE_PRIORITIES.includes(String(order.delivery.routePriority || ""))) {
    order.delivery.routePriority = "normal";
  }
  if (typeof order.delivery.routeSequence !== "number") order.delivery.routeSequence = Number(order.delivery.routeSequence || 0);
  if (!order.delivery.driverName && order.delivery.assignedDeliveryBoyName) {
    order.delivery.driverName = order.delivery.assignedDeliveryBoyName;
  }
  if (!order.delivery.driverPhone && order.delivery.assignedDeliveryBoyPhone) {
    order.delivery.driverPhone = order.delivery.assignedDeliveryBoyPhone;
  }
  return order.delivery;
}

function syncOrderLifecycleFromDelivery(order, status) {
  if (!order) return;

  if (["confirmed", "scheduling_in_progress", "scheduled", "packed", "out_for_delivery", "arriving_soon", "delivery_issue", "rescheduled"].includes(status)) {
    if (!["returned", "partially_returned", "cancelled"].includes(String(order.status || ""))) {
      order.status = "confirmed";
    }
    if (!order.confirmedAt) order.confirmedAt = new Date();
  }

  if (status === "delivered") {
    if (!["returned", "partially_returned"].includes(String(order.status || ""))) {
      order.status = "delivered";
    }
    if (!order.confirmedAt) order.confirmedAt = new Date();
    if (!order.deliveredAt) order.deliveredAt = new Date();
  }

  if (status === "cancelled") {
    order.status = "cancelled";
    if (!order.cancelledAt) order.cancelledAt = new Date();
  }
}

function applyDeliveryStatus(order, status, { actor = "system", note = "", pushEvent = true } = {}) {
  if (!order) return { changed: false };

  const delivery = ensureDeliveryContainer(order);
  const nextStatus = normalizeText(status);
  if (!DELIVERY_STATUSES.includes(nextStatus)) {
    throw new Error("Invalid delivery status");
  }

  const previousStatus = normalizeText(delivery.status) || "awaiting_advance_verification";
  const changed = previousStatus !== nextStatus;
  delivery.status = nextStatus;

  if (nextStatus === "confirmed" && !delivery.confirmedAt) delivery.confirmedAt = new Date();
  if (nextStatus === "scheduled" && !delivery.scheduledAt) delivery.scheduledAt = new Date();
  if (nextStatus === "packed" && !delivery.packedAt) delivery.packedAt = new Date();
  if (nextStatus === "out_for_delivery" && !delivery.outForDeliveryAt) {
    delivery.outForDeliveryAt = new Date();
    delivery.dispatchCount = Number(delivery.dispatchCount || 0) + 1;
  }
  if (nextStatus === "arriving_soon" && !delivery.arrivedNearbyAt) delivery.arrivedNearbyAt = new Date();
  if (nextStatus === "delivered" && !delivery.completedAt) delivery.completedAt = new Date();
  if (nextStatus === "delivery_issue") {
    delivery.lastIssueAt = new Date();
    delivery.failedAttempts = Number(delivery.failedAttempts || 0) + 1;
  }
  if (nextStatus === "rescheduled") delivery.lastRescheduledAt = new Date();
  if (nextStatus === "cancelled") delivery.cancelledAt = new Date();

  if (delivery.assignedDeliveryBoyId) {
    if (nextStatus === "delivered") {
      delivery.assignmentStatus = "completed";
      if (!delivery.deliveryBoyCompletedAt) delivery.deliveryBoyCompletedAt = new Date();
    } else if (nextStatus === "delivery_issue") {
      delivery.assignmentStatus = "issue_reported";
    } else if (["scheduled", "packed", "out_for_delivery", "arriving_soon"].includes(nextStatus) && delivery.assignmentStatus === "unassigned") {
      delivery.assignmentStatus = "assigned";
    }
  }

  syncOrderLifecycleFromDelivery(order, nextStatus);

  const safeNote = normalizeText(note);
  if (pushEvent && (changed || safeNote)) {
    delivery.events.push(buildDeliveryEvent(nextStatus, safeNote, actor));
  }

  delivery.lastUpdatedAt = new Date();
  return { changed, delivery };
}

function createInitialDeliveryPayload(settings = {}, payload = {}) {
  const preferredDate = normalizeOptionalDate(payload.preferredDate);
  const preferredTimeSlot = DELIVERY_TIME_SLOT_OPTIONS.includes(normalizeText(payload.preferredTimeSlot))
    ? normalizeText(payload.preferredTimeSlot)
    : "call_to_confirm";
  const balanceCollectionMode = BALANCE_COLLECTION_MODES.includes(normalizeText(payload.balanceCollectionMode))
    ? normalizeText(payload.balanceCollectionMode)
    : "to_be_confirmed";
  const paymentLabel = balanceCollectionMode === "before_dispatch" ? "Full payment" : "Advance";
  return {
    method: "own_vehicle",
    serviceLabel: normalizeText(settings.deliveryServiceLabel) || "Owner vehicle delivery",
    status: "awaiting_advance_verification",
    verificationCode: generateDeliveryVerificationCode(),
    siteContactName: normalizeText(payload.siteContactName) || normalizeText(payload.customerName),
    siteContactPhone: normalizeText(payload.siteContactPhone) || normalizeText(payload.phone),
    preferredDate,
    preferredTimeSlot,
    scheduledWindow: normalizeText(payload.scheduledWindow) || getDeliveryTimeSlotLabel(preferredTimeSlot),
    routeZone: normalizeText(payload.routeZone) || normalizeText(payload.address),
    accessNotes: normalizeText(payload.accessNotes),
    requiresCallBeforeDelivery: payload.requiresCallBeforeDelivery !== false,
    unloadingSupport: UNLOADING_SUPPORT_OPTIONS.includes(normalizeText(payload.unloadingSupport))
      ? normalizeText(payload.unloadingSupport)
      : "unsure",
    balanceCollectionMode,
    allowSplitDelivery: payload.allowSplitDelivery !== false,
    routePriority: "normal",
    assignmentStatus: "unassigned",
    publicNote: `${paymentLabel} proof received. Our team will verify the payment and contact you to lock the delivery window.`,
    adminNote: "",
    activityLogs: [],
    events: [
      buildDeliveryEvent(
        "awaiting_advance_verification",
        `${paymentLabel} proof received. Waiting for admin verification before delivery scheduling.`,
        "system"
      )
    ]
  };
}

module.exports = {
  DELIVERY_STATUSES,
  DELIVERY_STATUS_META,
  DELIVERY_TIME_SLOT_OPTIONS,
  UNLOADING_SUPPORT_OPTIONS,
  BALANCE_COLLECTION_MODES,
  DELIVERY_BOY_AVAILABILITY,
  DELIVERY_ASSIGNMENT_STATUSES,
  DELIVERY_ROUTE_PRIORITIES,
  DELIVERY_ACTIVITY_TYPES,
  getDeliveryStatusMeta,
  normalizeDeliveryUsername,
  normalizeStringArray,
  normalizeOptionalDate,
  generateDeliveryVerificationCode,
  getDeliveryTimeSlotLabel,
  buildDeliveryEvent,
  createDeliveryActivityLog,
  ensureDeliveryContainer,
  applyDeliveryStatus,
  createInitialDeliveryPayload
};
