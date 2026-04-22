const express = require("express");
const mongoose = require("mongoose");
const Order = require("../models/Order");
const Product = require("../models/Product");
const DeliveryBoy = require("../models/DeliveryBoy");
const { requireAdmin } = require("../middleware/auth");
const {
  RETURN_REQUEST_STATUSES,
  RETURN_RESOLUTIONS,
  syncOrderStatusWithReturns
} = require("../utils/returnPolicy");
const { PAYMENT_STATUSES, roundLKR } = require("../utils/paymentUtils");
const {
  DELIVERY_STATUSES,
  UNLOADING_SUPPORT_OPTIONS,
  BALANCE_COLLECTION_MODES,
  DELIVERY_ASSIGNMENT_STATUSES,
  DELIVERY_ROUTE_PRIORITIES,
  ensureDeliveryContainer,
  applyDeliveryStatus,
  buildDeliveryEvent,
  createDeliveryActivityLog,
  normalizeOptionalDate
} = require("../utils/deliveryUtils");

const router = express.Router();
router.use(requireAdmin);

const ACTIVE_ASSIGNMENT_STATUSES = ["assigned", "accepted", "issue_reported"];
const TERMINAL_ORDER_STATUSES = ["delivered", "cancelled", "returned", "partially_returned"];

const escapeRegex = (value = "") => String(value)
  .split("")
  .map((char) => "\\^$.*+?()[]{}|".includes(char) ? "\\" + char : char)
  .join("");
const normalizeOrderSearch = (value = "") => String(value || "")
  .trim()
  .replace(/^order[\s#:_-]*/i, "")
  .trim();
const toIdString = (value) => String(value || "");
const normalizeText = (value = "") => String(value || "").trim();
const normalizeRouteZone = (value = "") => normalizeText(value);

function startOfDay(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfDay(value) {
  const date = startOfDay(value);
  if (!date) return null;
  date.setHours(23, 59, 59, 999);
  return date;
}

function isSameDay(a, b) {
  const first = startOfDay(a);
  const second = startOfDay(b);
  if (!first || !second) return false;
  return first.getTime() === second.getTime();
}

function detectRouteZone(order, boys = []) {
  const address = String(order?.address || "").toLowerCase();
  if (!address) return "";

  const areaPool = [...new Set(boys.flatMap((boy) => boy.serviceAreas || []).map((item) => String(item || "").trim()).filter(Boolean))];
  const exact = areaPool.find((area) => address.includes(String(area).toLowerCase()));
  return exact || "";
}

function resolveRouteZoneForMatching(value = "", boys = []) {
  const normalized = normalizeRouteZone(value);
  if (!normalized) return "";

  const exactArea = (boys || [])
    .flatMap((boy) => boy.serviceAreas || [])
    .map((item) => String(item || "").trim())
    .find((area) => area && area.toLowerCase() === normalized.toLowerCase());

  if (exactArea) return exactArea;

  const inferred = detectRouteZone({ address: normalized }, boys);
  return inferred || normalized;
}

async function buildDeliverySuggestions(order, override = {}) {
  const boys = await DeliveryBoy.find({ isActive: true }).sort({ createdAt: 1 });
  if (!boys.length) {
    return { routeZone: "", scheduledDate: null, recommended: null, candidates: [] };
  }

  const ids = boys.map((boy) => boy._id);
  const relatedOrders = await Order.find({ "delivery.assignedDeliveryBoyId": { $in: ids } })
    .select("status orderNumber customerName delivery")
    .sort({ createdAt: -1 });

  const targetDate = normalizeOptionalDate(override.scheduledDate || order?.delivery?.scheduledDate || order?.delivery?.preferredDate || new Date());
  const rawRouteZone = normalizeRouteZone(override.routeZone) || normalizeRouteZone(order?.delivery?.routeZone) || normalizeRouteZone(order?.address) || detectRouteZone(order, boys);
  const routeZone = resolveRouteZoneForMatching(rawRouteZone, boys);

  const candidates = boys.map((boy) => {
    const currentId = toIdString(boy._id);
    const assignedOrders = relatedOrders.filter((entry) => toIdString(entry.delivery?.assignedDeliveryBoyId) === currentId);
    const activeAssignments = assignedOrders.filter((entry) => {
      const assignmentStatus = String(entry.delivery?.assignmentStatus || "");
      return ACTIVE_ASSIGNMENT_STATUSES.includes(assignmentStatus) && !TERMINAL_ORDER_STATUSES.includes(String(entry.status || ""));
    });

    const sameDayStops = assignedOrders.filter((entry) => isSameDay(entry.delivery?.scheduledDate || entry.delivery?.preferredDate, targetDate)).length;
    const sameZoneStops = routeZone
      ? assignedOrders.filter((entry) => String(entry.delivery?.routeZone || "").toLowerCase() === routeZone.toLowerCase()).length
      : 0;

    const serviceAreas = boy.serviceAreas || [];
    const zoneCovered = routeZone ? serviceAreas.some((area) => String(area || "").toLowerCase() === routeZone.toLowerCase()) : false;
    const availabilityPenalty = boy.availabilityStatus === "available" ? 0 : boy.availabilityStatus === "on_route" ? 10 : 60;
    const concurrencyPenalty = activeAssignments.length * 25;
    const capacityPenalty = activeAssignments.length >= Number(boy.maxConcurrentAssignments || 1)
      ? 80 + ((activeAssignments.length - Number(boy.maxConcurrentAssignments || 1) + 1) * 20)
      : 0;
    const dailyPenalty = sameDayStops * 6;
    const dailyCapPenalty = sameDayStops >= Number(boy.maxDailyStops || 1)
      ? 40 + ((sameDayStops - Number(boy.maxDailyStops || 1) + 1) * 10)
      : 0;
    const zonePenalty = routeZone ? (zoneCovered ? -15 : 18) : 0;
    const zoneBonus = sameZoneStops ? Math.min(12, sameZoneStops * 3) : 0;
    const score = availabilityPenalty + concurrencyPenalty + capacityPenalty + dailyPenalty + dailyCapPenalty + zonePenalty - zoneBonus;

    return {
      deliveryBoyId: boy._id,
      fullName: boy.fullName,
      username: boy.username,
      phone: boy.phone,
      vehicleNumber: boy.vehicleNumber,
      vehicleType: boy.vehicleType,
      availabilityStatus: boy.availabilityStatus,
      serviceAreas,
      stats: {
        activeAssignments: activeAssignments.length,
        sameDayStops,
        sameZoneStops,
        maxDailyStops: boy.maxDailyStops,
        maxConcurrentAssignments: boy.maxConcurrentAssignments,
        suggestedRouteSequence: sameDayStops + 1
      },
      score,
      rationale: [
        zoneCovered && routeZone ? `covers ${routeZone}` : routeZone ? `new zone for ${boy.fullName}` : "zone not specified",
        `${activeAssignments.length} active assigned order(s)`,
        `${sameDayStops} stop(s) on target day`,
        boy.availabilityStatus.replaceAll("_", " ")
      ].join(" • ")
    };
  }).sort((a, b) => a.score - b.score);

  return {
    routeZone,
    scheduledDate: targetDate,
    recommended: candidates[0] || null,
    candidates
  };
}

router.get("/", async (req, res) => {
  try {
    const rawSearch = req.query.search ?? req.query.q ?? "";
    const search = normalizeOrderSearch(rawSearch);
    const filter = {};

    if (search) {
      const matcher = new RegExp(escapeRegex(search), "i");
      filter.$or = [{ orderNumber: matcher }];
      if (mongoose.Types.ObjectId.isValid(search)) {
        filter.$or.push({ _id: new mongoose.Types.ObjectId(search) });
      }
    }

    const items = await Order.find(filter).sort({ createdAt: -1 });
    res.json(items);
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to load orders" });
  }
});

router.get("/:id/delivery-suggestions", async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });

    const suggestions = await buildDeliverySuggestions(order, {
      scheduledDate: req.query.scheduledDate,
      routeZone: req.query.routeZone
    });

    res.json(suggestions);
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to build delivery suggestions" });
  }
});

router.patch("/:orderId/returns/:returnId", async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId);
    if (!order) return res.status(404).json({ message: "Order not found" });

    const request = order.returnRequests.id(req.params.returnId);
    if (!request) return res.status(404).json({ message: "Return request not found" });

    const {
      status,
      resolutionType,
      customerVisibleNote,
      adminNotes,
      refundAmountLKR,
      restockingFeeLKR,
      restockToInventory,
      pickupPreference,
      paymentStatus
    } = req.body || {};

    if (status !== undefined) {
      if (!RETURN_REQUEST_STATUSES.includes(String(status))) {
        return res.status(400).json({ message: "Invalid return request status" });
      }
      request.status = String(status);
      if (request.status === "approved" && !request.approvedAt) request.approvedAt = new Date();
      if (request.status === "received" && !request.receivedAt) request.receivedAt = new Date();
      if (request.status === "completed") request.completedAt = new Date();
    }

    if (resolutionType !== undefined) {
      if (!RETURN_RESOLUTIONS.includes(String(resolutionType))) {
        return res.status(400).json({ message: "Invalid resolution type" });
      }
      request.resolutionType = String(resolutionType);
    }

    if (pickupPreference !== undefined) {
      request.pickupPreference = ["drop_off", "pickup"].includes(String(pickupPreference))
        ? String(pickupPreference)
        : request.pickupPreference;
    }

    if (customerVisibleNote !== undefined) request.customerVisibleNote = String(customerVisibleNote || "").trim();
    if (adminNotes !== undefined) request.adminNotes = String(adminNotes || "").trim();
    if (refundAmountLKR !== undefined) request.refundAmountLKR = Math.max(0, Number(refundAmountLKR || 0));
    if (restockingFeeLKR !== undefined) request.restockingFeeLKR = Math.max(0, Number(restockingFeeLKR || 0));
    if (restockToInventory !== undefined) request.restockToInventory = !!restockToInventory;

    if (paymentStatus !== undefined) {
      if (!PAYMENT_STATUSES.includes(String(paymentStatus))) {
        return res.status(400).json({ message: "Invalid payment status" });
      }
      order.paymentStatus = String(paymentStatus);
    }

    if (request.status === "completed" && request.restockToInventory && !request.stockRestoredAt) {
      for (const item of request.items || []) {
        await Product.findByIdAndUpdate(item.productId, { $inc: { stockQty: Number(item.qty || 0) } });
      }
      request.stockRestoredAt = new Date();
    }

    if (request.status === "completed" && request.resolutionType === "refund") {
      const totalReturnedQty = (order.returnRequests || [])
        .filter((entry) => String(entry.status) === "completed")
        .reduce((sum, entry) => sum + (entry.items || []).reduce((inner, item) => inner + Number(item.qty || 0), 0), 0);
      const totalPurchasedQty = (order.items || []).reduce((sum, item) => sum + Number(item.qty || 0), 0);
      order.paymentStatus = totalReturnedQty >= totalPurchasedQty ? "refunded" : "partially_refunded";
    }

    syncOrderStatusWithReturns(order);
    await order.save();

    res.json({
      message: "Return request updated",
      order,
      returnRequest: request
    });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to update return request" });
  }
});

router.patch("/:id/delivery", async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });

    const delivery = ensureDeliveryContainer(order);
    const previousDeliveryBoyId = toIdString(delivery.assignedDeliveryBoyId);
    const {
      status,
      scheduledDate,
      scheduledWindow,
      deliveryBoyId,
      routeZone,
      routePriority,
      routeSequence,
      assignmentStatus,
      assignmentNote,
      driverName,
      driverPhone,
      vehicleNumber,
      siteContactName,
      siteContactPhone,
      accessNotes,
      requiresCallBeforeDelivery,
      unloadingSupport,
      balanceCollectionMode,
      allowSplitDelivery,
      publicNote,
      adminNote,
      issueReason,
      proofImageUrl,
      proofRecipientName,
      verificationCodeInput,
      eventNote
    } = req.body || {};

    if (scheduledDate !== undefined) {
      if (!scheduledDate) {
        delivery.scheduledDate = null;
      } else {
        const parsed = normalizeOptionalDate(scheduledDate);
        if (!parsed) return res.status(400).json({ message: "Please provide a valid scheduled delivery date." });
        delivery.scheduledDate = parsed;
      }
    }

    if (scheduledWindow !== undefined) delivery.scheduledWindow = normalizeText(scheduledWindow);
    if (routeZone !== undefined) delivery.routeZone = normalizeRouteZone(routeZone);
    if (routePriority !== undefined) {
      if (!DELIVERY_ROUTE_PRIORITIES.includes(String(routePriority || ""))) {
        return res.status(400).json({ message: "Invalid route priority" });
      }
      delivery.routePriority = String(routePriority);
    }
    if (routeSequence !== undefined) delivery.routeSequence = Math.max(0, Number(routeSequence || 0));
    if (assignmentNote !== undefined) delivery.assignmentNote = normalizeText(assignmentNote);
    if (siteContactName !== undefined) delivery.siteContactName = normalizeText(siteContactName);
    if (siteContactPhone !== undefined) delivery.siteContactPhone = normalizeText(siteContactPhone);
    if (accessNotes !== undefined) delivery.accessNotes = normalizeText(accessNotes);
    if (requiresCallBeforeDelivery !== undefined) delivery.requiresCallBeforeDelivery = !!requiresCallBeforeDelivery;
    if (allowSplitDelivery !== undefined) delivery.allowSplitDelivery = !!allowSplitDelivery;
    if (publicNote !== undefined) delivery.publicNote = normalizeText(publicNote);
    if (adminNote !== undefined) delivery.adminNote = normalizeText(adminNote);
    if (issueReason !== undefined) delivery.issueReason = normalizeText(issueReason);
    if (proofImageUrl !== undefined) delivery.proofImageUrl = normalizeText(proofImageUrl);
    if (proofRecipientName !== undefined) delivery.proofRecipientName = normalizeText(proofRecipientName);

    if (unloadingSupport !== undefined) {
      if (!UNLOADING_SUPPORT_OPTIONS.includes(String(unloadingSupport || ""))) {
        return res.status(400).json({ message: "Invalid unloading support option" });
      }
      delivery.unloadingSupport = String(unloadingSupport);
    }

    if (balanceCollectionMode !== undefined) {
      if (!BALANCE_COLLECTION_MODES.includes(String(balanceCollectionMode || ""))) {
        return res.status(400).json({ message: "Invalid balance collection mode" });
      }
      delivery.balanceCollectionMode = String(balanceCollectionMode);
    }

    let selectedBoy = null;
    if (deliveryBoyId !== undefined) {
      const safeId = normalizeText(deliveryBoyId);
      if (safeId) {
        selectedBoy = await DeliveryBoy.findOne({ _id: safeId, isActive: true });
        if (!selectedBoy) {
          return res.status(404).json({ message: "Selected delivery boy not found or inactive" });
        }

        delivery.assignedDeliveryBoyId = selectedBoy._id;
        delivery.assignedDeliveryBoyName = selectedBoy.fullName;
        delivery.assignedDeliveryBoyPhone = selectedBoy.phone;
        delivery.assignedDeliveryBoyUsername = selectedBoy.username;
        delivery.driverName = selectedBoy.fullName;
        delivery.driverPhone = selectedBoy.phone;
        if (!normalizeText(vehicleNumber)) {
          delivery.vehicleNumber = normalizeText(selectedBoy.vehicleNumber);
        }
        if (!delivery.routeZone) {
          delivery.routeZone = detectRouteZone(order, [selectedBoy]) || delivery.routeZone;
        }

        if (previousDeliveryBoyId !== toIdString(selectedBoy._id)) {
          delivery.assignmentStatus = "assigned";
          delivery.assignedAt = new Date();
          delivery.acceptedAt = null;
          delivery.deliveryBoyCompletedAt = null;

          if (!routeSequence && delivery.scheduledDate) {
            const existingCount = await Order.countDocuments({
              _id: { $ne: order._id },
              "delivery.assignedDeliveryBoyId": selectedBoy._id,
              "delivery.scheduledDate": {
                $gte: startOfDay(delivery.scheduledDate),
                $lte: endOfDay(delivery.scheduledDate)
              },
              status: { $ne: "cancelled" }
            });
            delivery.routeSequence = existingCount + 1;
          }

          const assignmentTimelineNote = [
            `Assigned to ${selectedBoy.fullName}`,
            delivery.routeZone ? `zone ${delivery.routeZone}` : "",
            delivery.assignmentNote ? delivery.assignmentNote : ""
          ].filter(Boolean).join(" • ");

          delivery.events.push(buildDeliveryEvent(delivery.status || "confirmed", assignmentTimelineNote, "admin"));
          delivery.activityLogs.push(createDeliveryActivityLog({
            activityType: "assignment",
            deliveryStatus: delivery.status,
            note: assignmentTimelineNote,
            actorRole: "admin",
            actorName: req.admin?.displayName || req.admin?.username || "admin",
            actorId: req.admin?.sub || ""
          }));
        }
      } else {
        delivery.assignedDeliveryBoyId = undefined;
        delivery.assignedDeliveryBoyName = "";
        delivery.assignedDeliveryBoyPhone = "";
        delivery.assignedDeliveryBoyUsername = "";
        delivery.assignmentStatus = "unassigned";
        delivery.assignedAt = null;
        delivery.acceptedAt = null;
        delivery.deliveryBoyCompletedAt = null;
        if (previousDeliveryBoyId) {
          const clearNote = "Delivery-boy assignment cleared by admin.";
          delivery.activityLogs.push(createDeliveryActivityLog({
            activityType: "assignment",
            deliveryStatus: delivery.status,
            note: clearNote,
            actorRole: "admin",
            actorName: req.admin?.displayName || req.admin?.username || "admin",
            actorId: req.admin?.sub || ""
          }));
          delivery.events.push(buildDeliveryEvent(delivery.status || "confirmed", clearNote, "admin"));
        }
      }
    }

    if (driverName !== undefined && !selectedBoy) delivery.driverName = normalizeText(driverName);
    if (driverPhone !== undefined && !selectedBoy) delivery.driverPhone = normalizeText(driverPhone);
    if (vehicleNumber !== undefined) delivery.vehicleNumber = normalizeText(vehicleNumber);

    if (assignmentStatus !== undefined) {
      if (!DELIVERY_ASSIGNMENT_STATUSES.includes(String(assignmentStatus || ""))) {
        return res.status(400).json({ message: "Invalid assignment status" });
      }
      delivery.assignmentStatus = String(assignmentStatus);
      if (delivery.assignmentStatus === "accepted" && !delivery.acceptedAt) delivery.acceptedAt = new Date();
      if (delivery.assignmentStatus === "completed" && !delivery.deliveryBoyCompletedAt) delivery.deliveryBoyCompletedAt = new Date();
    }

    if (verificationCodeInput !== undefined) {
      const suppliedCode = normalizeText(verificationCodeInput);
      if (suppliedCode) {
        if (suppliedCode !== String(delivery.verificationCode || "")) {
          return res.status(400).json({ message: "Delivery verification code does not match the customer code." });
        }
        delivery.verificationCodeVerifiedAt = new Date();
      }
    }

    let pushedEvent = false;
    const noteForTimeline = normalizeText(eventNote) || normalizeText(publicNote) || normalizeText(assignmentNote);

    if (status !== undefined) {
      if (!DELIVERY_STATUSES.includes(String(status || ""))) {
        return res.status(400).json({ message: "Invalid delivery status" });
      }
      applyDeliveryStatus(order, String(status), {
        actor: "admin",
        note: noteForTimeline,
        pushEvent: true
      });
      pushedEvent = true;
    }

    if (!pushedEvent && noteForTimeline) {
      delivery.events.push(buildDeliveryEvent(delivery.status, noteForTimeline, "admin"));
      delivery.lastUpdatedAt = new Date();
    }

    if (!pushedEvent && ["confirmed", "scheduling_in_progress", "scheduled", "packed", "out_for_delivery", "arriving_soon", "delivery_issue", "rescheduled"].includes(String(delivery.status || ""))) {
      if (!["returned", "partially_returned", "cancelled"].includes(String(order.status || ""))) {
        order.status = "confirmed";
      }
      if (!order.confirmedAt) order.confirmedAt = new Date();
    }

    if (String(delivery.status || "") === "delivered") {
      if (!["returned", "partially_returned"].includes(String(order.status || ""))) {
        order.status = "delivered";
      }
      if (!order.deliveredAt) order.deliveredAt = new Date();
    }

    const shouldLogAdminActivity = [
      status !== undefined,
      normalizeText(eventNote),
      normalizeText(publicNote),
      normalizeText(adminNote),
      normalizeText(assignmentNote),
      normalizeText(issueReason),
      normalizeText(proofImageUrl),
      normalizeText(verificationCodeInput)
    ].some(Boolean);

    if (shouldLogAdminActivity) {
      delivery.activityLogs.push(createDeliveryActivityLog({
        activityType: normalizeText(proofImageUrl)
          ? "proof_uploaded"
          : normalizeText(issueReason)
          ? "issue"
          : status === "rescheduled"
          ? "reschedule"
          : status
          ? "status_update"
          : "note",
        deliveryStatus: delivery.status,
        note: [normalizeText(eventNote), normalizeText(adminNote), normalizeText(assignmentNote), normalizeText(issueReason)].filter(Boolean).join(" • "),
        publicNote: normalizeText(publicNote),
        proofImageUrl: delivery.proofImageUrl,
        recipientName: delivery.proofRecipientName,
        verificationCodeChecked: !!normalizeText(verificationCodeInput),
        actorRole: "admin",
        actorName: req.admin?.displayName || req.admin?.username || "admin",
        actorId: req.admin?.sub || ""
      }));
      delivery.lastUpdatedAt = new Date();
    }

    await order.save();
    res.json({ message: "Delivery updated", order, delivery: order.delivery });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to update delivery" });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });

    const allowedStatuses = ["pending", "confirmed", "delivered", "partially_returned", "returned", "cancelled"];

    if (req.body.status !== undefined) {
      const nextStatus = String(req.body.status);
      if (!allowedStatuses.includes(nextStatus)) {
        return res.status(400).json({ message: "Invalid order status" });
      }
      order.status = nextStatus;
      if (nextStatus === "confirmed" && !order.confirmedAt) order.confirmedAt = new Date();
      if (nextStatus === "delivered" && !order.deliveredAt) order.deliveredAt = new Date();
      if (nextStatus === "cancelled" && !order.cancelledAt) order.cancelledAt = new Date();

      const delivery = ensureDeliveryContainer(order);
      if (nextStatus === "confirmed" && String(delivery.status || "") === "awaiting_advance_verification") {
        applyDeliveryStatus(order, "confirmed", {
          actor: "admin",
          note: String(order?.delivery?.balanceCollectionMode || "") === "before_dispatch" && Number(order?.balanceDueLKR || 0) === 0
            ? "Full payment verified. Order confirmed and moved to delivery planning."
            : "Advance verified. Order confirmed and moved to delivery planning."
        });
      }
      if (nextStatus === "delivered") {
        applyDeliveryStatus(order, "delivered", {
          actor: "admin",
          note: "Delivery completed and handed over to the customer."
        });
      }
      if (nextStatus === "cancelled") {
        applyDeliveryStatus(order, "cancelled", {
          actor: "admin",
          note: "Order cancelled."
        });
      }
    }

    if (req.body.paymentStatus !== undefined) {
      const nextPaymentStatus = String(req.body.paymentStatus);
      if (!PAYMENT_STATUSES.includes(nextPaymentStatus)) {
        return res.status(400).json({ message: "Invalid payment status" });
      }
      order.paymentStatus = nextPaymentStatus;
    }

    if (req.body.address !== undefined) order.address = String(req.body.address || "").trim();
    if (req.body.phone !== undefined) order.phone = String(req.body.phone || "").trim();
    if (req.body.customerName !== undefined) order.customerName = String(req.body.customerName || "").trim();
    if (req.body.paymentReference !== undefined) order.paymentReference = String(req.body.paymentReference || "").trim();
    if (req.body.paymentNote !== undefined) order.paymentNote = String(req.body.paymentNote || "").trim();
    if (req.body.cryptoTxHash !== undefined) order.cryptoTxHash = String(req.body.cryptoTxHash || "").trim();
    if (req.body.advanceDueLKR !== undefined) order.advanceDueLKR = roundLKR(req.body.advanceDueLKR);
    if (req.body.balanceDueLKR !== undefined) order.balanceDueLKR = roundLKR(req.body.balanceDueLKR);

    await order.save();
    res.json(order);
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to update order" });
  }
});

router.delete("/:id", async (req, res) => {
  const deleted = await Order.findByIdAndDelete(req.params.id);
  if (!deleted) return res.status(404).json({ message: "Order not found" });
  res.json({ ok: true });
});

module.exports = router;
