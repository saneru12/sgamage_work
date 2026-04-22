const express = require("express");
const bcrypt = require("bcryptjs");
const DeliveryBoy = require("../models/DeliveryBoy");
const Order = require("../models/Order");
const { requireAdmin } = require("../middleware/auth");
const {
  DELIVERY_BOY_AVAILABILITY,
  normalizeDeliveryUsername,
  normalizeStringArray
} = require("../utils/deliveryUtils");

const ACTIVE_ASSIGNMENT_STATUSES = ["assigned", "accepted", "issue_reported"];
const TERMINAL_ORDER_STATUSES = ["delivered", "cancelled", "returned", "partially_returned"];

const router = express.Router();
router.use(requireAdmin);

function normalizePhone(value = "") {
  return String(value || "").trim();
}

function toIdString(value) {
  return String(value || "");
}

function isSameDay(a, b) {
  if (!a || !b) return false;
  const first = new Date(a);
  const second = new Date(b);
  if (Number.isNaN(first.getTime()) || Number.isNaN(second.getTime())) return false;
  return first.getFullYear() === second.getFullYear()
    && first.getMonth() === second.getMonth()
    && first.getDate() === second.getDate();
}

function buildOrderCard(order) {
  return {
    orderId: order._id,
    orderNumber: order.orderNumber,
    customerName: order.customerName,
    phone: order.phone,
    address: order.address,
    status: order.status,
    deliveryStatus: order.delivery?.status || "awaiting_advance_verification",
    assignmentStatus: order.delivery?.assignmentStatus || "unassigned",
    scheduledDate: order.delivery?.scheduledDate || null,
    scheduledWindow: order.delivery?.scheduledWindow || "",
    routeZone: order.delivery?.routeZone || "",
    routePriority: order.delivery?.routePriority || "normal",
    routeSequence: Number(order.delivery?.routeSequence || 0),
    totalLKR: order.totalLKR,
    balanceDueLKR: order.balanceDueLKR
  };
}

router.get("/", async (_req, res) => {
  try {
    const items = await DeliveryBoy.find({}).sort({ createdAt: -1 });
    const ids = items.map((item) => item._id);
    const relatedOrders = ids.length
      ? await Order.find({ "delivery.assignedDeliveryBoyId": { $in: ids } })
          .select("orderNumber customerName phone address totalLKR balanceDueLKR status delivery")
          .sort({ createdAt: -1 })
      : [];

    const today = new Date();
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const recentActivities = [];

    const enriched = items.map((item) => {
      const currentId = toIdString(item._id);
      const orders = relatedOrders.filter((order) => toIdString(order.delivery?.assignedDeliveryBoyId) === currentId);
      const activeAssignments = orders.filter((order) => {
        const assignmentStatus = String(order.delivery?.assignmentStatus || "");
        return ACTIVE_ASSIGNMENT_STATUSES.includes(assignmentStatus) && !TERMINAL_ORDER_STATUSES.includes(String(order.status || ""));
      });
      const todaysStops = orders.filter((order) => isSameDay(order.delivery?.scheduledDate || order.delivery?.preferredDate, today)).length;
      const completedThisWeek = orders.filter((order) => {
        const doneAt = order.delivery?.deliveryBoyCompletedAt || order.delivery?.completedAt || order.deliveredAt;
        return doneAt && new Date(doneAt) >= weekAgo;
      }).length;

      for (const order of orders) {
        for (const log of order.delivery?.activityLogs || []) {
          if (String(log.actorRole) !== "delivery_boy") continue;
          if (log.actorId && String(log.actorId) !== currentId) continue;
          recentActivities.push({
            orderId: order._id,
            orderNumber: order.orderNumber,
            customerName: order.customerName,
            routeZone: order.delivery?.routeZone || "",
            deliveryStatus: log.deliveryStatus || order.delivery?.status || "",
            activityType: log.activityType || "note",
            note: log.note || "",
            publicNote: log.publicNote || "",
            recipientName: log.recipientName || "",
            proofImageUrl: log.proofImageUrl || "",
            actorName: log.actorName || item.fullName,
            actorId: log.actorId || currentId,
            createdAt: log.createdAt || order.updatedAt
          });
        }
      }

      return {
        ...item.toObject(),
        stats: {
          activeAssignments: activeAssignments.length,
          todaysStops,
          completedThisWeek,
          utilizationPct: Math.min(100, Math.round((activeAssignments.length / Math.max(1, Number(item.maxConcurrentAssignments || 1))) * 100))
        },
        currentAssignments: activeAssignments.slice(0, 8).map(buildOrderCard)
      };
    });

    recentActivities.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    res.json({
      items: enriched,
      recentActivities: recentActivities.slice(0, 40)
    });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to load delivery boys" });
  }
});

router.post("/", async (req, res) => {
  try {
    const {
      fullName,
      username,
      phone,
      password,
      vehicleNumber = "",
      vehicleType = "Owner vehicle",
      serviceAreas = [],
      maxDailyStops = 8,
      maxConcurrentAssignments = 4,
      availabilityStatus = "available",
      notes = "",
      isActive = true
    } = req.body || {};

    if (!fullName || !username || !phone || !password) {
      return res.status(400).json({ message: "fullName, username, phone and password are required" });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }
    if (!DELIVERY_BOY_AVAILABILITY.includes(String(availabilityStatus || "available"))) {
      return res.status(400).json({ message: "Invalid availability status" });
    }

    const passwordHash = await bcrypt.hash(String(password), 10);

    const created = await DeliveryBoy.create({
      fullName: String(fullName).trim(),
      username: normalizeDeliveryUsername(username),
      phone: normalizePhone(phone),
      passwordHash,
      vehicleNumber: String(vehicleNumber || "").trim(),
      vehicleType: String(vehicleType || "Owner vehicle").trim(),
      serviceAreas: normalizeStringArray(serviceAreas),
      maxDailyStops: Math.max(1, Number(maxDailyStops || 8)),
      maxConcurrentAssignments: Math.max(1, Number(maxConcurrentAssignments || 4)),
      availabilityStatus: String(availabilityStatus),
      notes: String(notes || "").trim(),
      isActive: !!isActive
    });

    res.status(201).json({
      message: "Delivery boy created",
      item: created
    });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ message: "That delivery-boy username is already in use." });
    }
    res.status(500).json({ message: err.message || "Failed to create delivery boy" });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const updates = {};
    if (req.body.fullName !== undefined) updates.fullName = String(req.body.fullName || "").trim();
    if (req.body.username !== undefined) updates.username = normalizeDeliveryUsername(req.body.username);
    if (req.body.phone !== undefined) updates.phone = normalizePhone(req.body.phone);
    if (req.body.vehicleNumber !== undefined) updates.vehicleNumber = String(req.body.vehicleNumber || "").trim();
    if (req.body.vehicleType !== undefined) updates.vehicleType = String(req.body.vehicleType || "").trim();
    if (req.body.serviceAreas !== undefined) updates.serviceAreas = normalizeStringArray(req.body.serviceAreas);
    if (req.body.maxDailyStops !== undefined) updates.maxDailyStops = Math.max(1, Number(req.body.maxDailyStops || 1));
    if (req.body.maxConcurrentAssignments !== undefined) updates.maxConcurrentAssignments = Math.max(1, Number(req.body.maxConcurrentAssignments || 1));
    if (req.body.notes !== undefined) updates.notes = String(req.body.notes || "").trim();
    if (req.body.isActive !== undefined) updates.isActive = !!req.body.isActive;

    if (req.body.availabilityStatus !== undefined) {
      if (!DELIVERY_BOY_AVAILABILITY.includes(String(req.body.availabilityStatus || ""))) {
        return res.status(400).json({ message: "Invalid availability status" });
      }
      updates.availabilityStatus = String(req.body.availabilityStatus);
    }

    const updated = await DeliveryBoy.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    if (!updated) return res.status(404).json({ message: "Delivery boy not found" });

    res.json({ message: "Delivery boy updated", item: updated });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ message: "That delivery-boy username is already in use." });
    }
    res.status(500).json({ message: err.message || "Failed to update delivery boy" });
  }
});

router.post("/:id/reset-password", async (req, res) => {
  try {
    const { newPassword } = req.body || {};
    if (!newPassword || String(newPassword).length < 6) {
      return res.status(400).json({ message: "newPassword must be at least 6 characters" });
    }

    const passwordHash = await bcrypt.hash(String(newPassword), 10);
    const updated = await DeliveryBoy.findByIdAndUpdate(req.params.id, { passwordHash }, { new: true });
    if (!updated) return res.status(404).json({ message: "Delivery boy not found" });

    res.json({ message: "Password reset successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to reset password" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const activeAssignments = await Order.countDocuments({
      "delivery.assignedDeliveryBoyId": req.params.id,
      "delivery.assignmentStatus": { $in: ACTIVE_ASSIGNMENT_STATUSES },
      status: { $nin: TERMINAL_ORDER_STATUSES }
    });

    if (activeAssignments > 0) {
      return res.status(409).json({
        message: "This delivery boy still has active assigned orders. Reassign those orders first."
      });
    }

    const updated = await DeliveryBoy.findByIdAndUpdate(
      req.params.id,
      { isActive: false, availabilityStatus: "off_duty" },
      { new: true }
    );
    if (!updated) return res.status(404).json({ message: "Delivery boy not found" });

    res.json({ message: "Delivery boy deactivated", item: updated });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to deactivate delivery boy" });
  }
});

module.exports = router;
