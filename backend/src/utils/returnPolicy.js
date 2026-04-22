const RETURN_REASON_RULES = {
  damaged_on_arrival: {
    label: "Damaged on arrival",
    windowHours: 48,
    windowLabel: "48 hours",
    allowedResolutions: ["replacement", "refund", "store_credit"]
  },
  wrong_item_or_missing_parts: {
    label: "Wrong item / missing parts",
    windowHours: 48,
    windowLabel: "48 hours",
    allowedResolutions: ["replacement", "refund"]
  },
  defective_or_quality_issue: {
    label: "Defective / quality issue",
    windowDays: 7,
    windowLabel: "7 days",
    allowedResolutions: ["replacement", "repair", "refund", "store_credit"]
  },
  unused_unopened: {
    label: "Unused / unopened standard item",
    windowDays: 14,
    windowLabel: "14 days",
    allowedConditions: ["sealed", "unused"],
    allowedResolutions: ["exchange", "store_credit", "refund"]
  }
};

const RETURN_REQUEST_STATUSES = [
  "requested",
  "under_review",
  "approved",
  "awaiting_item",
  "received",
  "completed",
  "rejected",
  "cancelled"
];

const RETURN_RESOLUTIONS = [
  "replacement",
  "refund",
  "exchange",
  "store_credit",
  "repair",
  "warranty_support"
];

function toDate(value) {
  const d = value ? new Date(value) : null;
  return d && !Number.isNaN(d.getTime()) ? d : null;
}

function addHours(date, hours) {
  return new Date(toDate(date).getTime() + Number(hours || 0) * 60 * 60 * 1000);
}

function addDays(date, days) {
  return new Date(toDate(date).getTime() + Number(days || 0) * 24 * 60 * 60 * 1000);
}

function getReasonRule(reasonCode) {
  return RETURN_REASON_RULES[String(reasonCode || "").trim()] || null;
}

function getOrderDeliveryDate(order = {}) {
  return toDate(order.deliveredAt) || toDate(order.updatedAt) || toDate(order.createdAt);
}

function getReturnDeadline(deliveredAt, reasonCode) {
  const rule = getReasonRule(reasonCode);
  const date = toDate(deliveredAt);
  if (!rule || !date) return null;
  if (rule.windowHours) return addHours(date, rule.windowHours);
  if (rule.windowDays) return addDays(date, rule.windowDays);
  return null;
}

function formatPolicyWindow(rule = {}) {
  return rule.windowLabel || (rule.windowDays ? `${rule.windowDays} days` : rule.windowHours ? `${rule.windowHours} hours` : "policy window");
}

function isReturnStatusActive(status) {
  return !["rejected", "cancelled"].includes(String(status || "").trim());
}

function countRequestedQty(order = {}, productId, { onlyCompleted = false } = {}) {
  const target = String(productId || "");
  let total = 0;

  for (const request of order.returnRequests || []) {
    const status = String(request?.status || "").trim();
    if (!isReturnStatusActive(status)) continue;
    if (onlyCompleted && status !== "completed") continue;

    for (const item of request.items || []) {
      if (String(item?.productId || "") === target) {
        total += Number(item?.qty || 0);
      }
    }
  }

  return total;
}

function getRemainingReturnableQty(order = {}, productId) {
  const target = String(productId || "");
  const orderedQty = Number((order.items || []).find((item) => String(item?.productId || "") === target)?.qty || 0);
  const alreadyRequested = countRequestedQty(order, productId);
  return Math.max(0, orderedQty - alreadyRequested);
}

function evaluateReturnEligibility({ order, orderItem, reasonCode, condition }) {
  const rule = getReasonRule(reasonCode);
  if (!rule) {
    return { ok: false, message: "Please select a valid return reason." };
  }

  if (!orderItem) {
    return { ok: false, message: "Selected item is not part of this order." };
  }

  const deliveredAt = getOrderDeliveryDate(order);
  if (!deliveredAt || !["delivered", "partially_returned", "returned"].includes(String(order?.status || ""))) {
    return { ok: false, message: "Return requests are available only after the order is marked as delivered." };
  }

  const deadline = getReturnDeadline(deliveredAt, reasonCode);
  if (!deadline) {
    return { ok: false, message: "Unable to determine the return window for this request." };
  }

  if (new Date() > deadline) {
    return {
      ok: false,
      message: `${rule.label} must be reported within ${formatPolicyWindow(rule)} of delivery.`,
      deadline,
      rule
    };
  }

  if (rule.allowedConditions?.length && !rule.allowedConditions.includes(String(condition || "").trim())) {
    return {
      ok: false,
      message: `For ${rule.label.toLowerCase()}, the item must be sealed or unused.`,
      deadline,
      rule
    };
  }

  if (reasonCode === "unused_unopened" && orderItem.isReturnable === false) {
    return {
      ok: false,
      message: orderItem.nonReturnableReason || "This item is not eligible for change-of-mind returns.",
      deadline,
      rule
    };
  }

  return { ok: true, deadline, rule };
}

function generateOrderNumber() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `SGC-${yyyy}${mm}${dd}-${rand}`;
}

function generateReturnRequestNumber() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `RET-${yyyy}${mm}${dd}-${rand}`;
}

function syncOrderStatusWithReturns(order) {
  if (!order || String(order.status || "") === "cancelled") return order;

  const purchasedQty = (order.items || []).reduce((sum, item) => sum + Number(item?.qty || 0), 0);
  const completedReturnQty = (order.returnRequests || [])
    .filter((request) => String(request?.status || "") === "completed")
    .reduce((sum, request) => sum + (request.items || []).reduce((inner, item) => inner + Number(item?.qty || 0), 0), 0);

  if (!purchasedQty) return order;

  if (completedReturnQty >= purchasedQty && completedReturnQty > 0) {
    order.status = "returned";
  } else if (completedReturnQty > 0) {
    order.status = "partially_returned";
  } else if (["partially_returned", "returned"].includes(String(order.status || ""))) {
    order.status = "delivered";
  }

  return order;
}

module.exports = {
  RETURN_REASON_RULES,
  RETURN_REQUEST_STATUSES,
  RETURN_RESOLUTIONS,
  getReasonRule,
  getOrderDeliveryDate,
  getReturnDeadline,
  countRequestedQty,
  getRemainingReturnableQty,
  evaluateReturnEligibility,
  generateOrderNumber,
  generateReturnRequestNumber,
  syncOrderStatusWithReturns,
  formatPolicyWindow,
  isReturnStatusActive
};
