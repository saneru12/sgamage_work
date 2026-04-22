const express = require("express");
const Order = require("../models/Order");
const DeliveryBoy = require("../models/DeliveryBoy");
const { requireDeliveryBoy } = require("../middleware/auth");
const {
  DELIVERY_STATUSES,
  DELIVERY_BOY_AVAILABILITY,
  ensureDeliveryContainer,
  applyDeliveryStatus,
  createDeliveryActivityLog
} = require("../utils/deliveryUtils");

const router = express.Router();
router.use(requireDeliveryBoy);

function toIdString(value) {
  return String(value || "");
}

function activityTypeFromStatus(status = "", fallback = "note") {
  const map = {
    packed: "load_check",
    out_for_delivery: "departure",
    arriving_soon: "arrival",
    delivered: "delivery_completed",
    delivery_issue: "issue",
    rescheduled: "reschedule"
  };
  return map[String(status || "")] || fallback;
}

function buildStats(orders = []) {
  const today = new Date();
  return {
    assigned: orders.filter((order) => ["assigned", "accepted", "issue_reported"].includes(String(order.delivery?.assignmentStatus || ""))).length,
    inTransit: orders.filter((order) => ["out_for_delivery", "arriving_soon"].includes(String(order.delivery?.status || ""))).length,
    todayStops: orders.filter((order) => {
      const date = order.delivery?.scheduledDate || order.delivery?.preferredDate;
      if (!date) return false;
      const current = new Date(date);
      return current.getFullYear() === today.getFullYear() && current.getMonth() === today.getMonth() && current.getDate() === today.getDate();
    }).length,
    completed: orders.filter((order) => String(order.delivery?.assignmentStatus || "") === "completed").length
  };
}

router.get("/me", async (req, res) => {
  try {
    const item = await DeliveryBoy.findById(req.deliveryBoy.id);
    if (!item || !item.isActive) return res.status(404).json({ message: "Delivery boy not found" });

    item.lastSeenAt = new Date();
    await item.save();

    const orders = await Order.find({ "delivery.assignedDeliveryBoyId": item._id })
      .select("orderNumber customerName phone address totalLKR balanceDueLKR status delivery")
      .sort({ "delivery.scheduledDate": 1, createdAt: -1 });

    res.json({
      deliveryBoy: item,
      stats: buildStats(orders)
    });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to load profile" });
  }
});

router.patch("/me", async (req, res) => {
  try {
    const updates = {};
    if (req.body.availabilityStatus !== undefined) {
      if (!DELIVERY_BOY_AVAILABILITY.includes(String(req.body.availabilityStatus || ""))) {
        return res.status(400).json({ message: "Invalid availability status" });
      }
      updates.availabilityStatus = String(req.body.availabilityStatus);
    }

    const updated = await DeliveryBoy.findByIdAndUpdate(
      req.deliveryBoy.id,
      { ...updates, lastSeenAt: new Date() },
      { new: true, runValidators: true }
    );
    if (!updated) return res.status(404).json({ message: "Delivery boy not found" });

    res.json({ message: "Profile updated", deliveryBoy: updated });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to update profile" });
  }
});

router.get("/orders", async (req, res) => {
  try {
    const view = String(req.query.view || "active");
    const orders = await Order.find({ "delivery.assignedDeliveryBoyId": req.deliveryBoy.id })
      .sort({ "delivery.scheduledDate": 1, createdAt: -1 });

    let filtered = orders;
    if (view === "active") {
      filtered = orders.filter((order) => ["assigned", "accepted", "issue_reported"].includes(String(order.delivery?.assignmentStatus || "")));
    } else if (view === "completed") {
      filtered = orders.filter((order) => String(order.delivery?.assignmentStatus || "") === "completed");
    } else if (view === "today") {
      const today = new Date();
      filtered = orders.filter((order) => {
        const date = order.delivery?.scheduledDate || order.delivery?.preferredDate;
        if (!date) return false;
        const current = new Date(date);
        return current.getFullYear() === today.getFullYear() && current.getMonth() === today.getMonth() && current.getDate() === today.getDate();
      });
    }

    await DeliveryBoy.findByIdAndUpdate(req.deliveryBoy.id, { lastSeenAt: new Date() });

    res.json({ items: filtered, stats: buildStats(orders) });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to load orders" });
  }
});

router.post("/orders/:id/activity", async (req, res) => {
  try {
    const order = await Order.findOne({
      _id: req.params.id,
      "delivery.assignedDeliveryBoyId": req.deliveryBoy.id
    });
    if (!order) return res.status(404).json({ message: "Assigned order not found" });

    const delivery = ensureDeliveryContainer(order);
    const boy = await DeliveryBoy.findById(req.deliveryBoy.id);
    if (!boy || !boy.isActive) return res.status(404).json({ message: "Delivery boy not found" });

    const {
      activityType = "note",
      status,
      note = "",
      publicNote = "",
      proofImageUrl = "",
      proofRecipientName = "",
      verificationCodeInput = "",
      issueReason = "",
      availabilityStatus
    } = req.body || {};

    const safeStatus = status !== undefined ? String(status || "").trim() : "";
    if (safeStatus && !DELIVERY_STATUSES.includes(safeStatus)) {
      return res.status(400).json({ message: "Invalid delivery status" });
    }

    const suppliedCode = String(verificationCodeInput || "").trim();
    if (suppliedCode) {
      if (suppliedCode !== String(delivery.verificationCode || "")) {
        return res.status(400).json({ message: "Delivery verification code does not match the customer code." });
      }
      delivery.verificationCodeVerifiedAt = new Date();
    }

    if (proofImageUrl !== undefined && String(proofImageUrl || "").trim()) {
      delivery.proofImageUrl = String(proofImageUrl || "").trim();
    }
    if (proofRecipientName !== undefined) {
      delivery.proofRecipientName = String(proofRecipientName || "").trim();
    }
    if (publicNote !== undefined && String(publicNote || "").trim()) {
      delivery.publicNote = String(publicNote || "").trim();
    }
    if (issueReason !== undefined && String(issueReason || "").trim()) {
      delivery.issueReason = String(issueReason || "").trim();
    }

    const noteForTimeline = String(publicNote || note || issueReason || "").trim();
    if (safeStatus) {
      applyDeliveryStatus(order, safeStatus, {
        actor: `delivery boy: ${req.deliveryBoy.fullName}`,
        note: noteForTimeline,
        pushEvent: true
      });
    }

    if (["accepted", "packed", "out_for_delivery", "arriving_soon"].includes(String(activityType || "")) || ["packed", "out_for_delivery", "arriving_soon"].includes(safeStatus)) {
      if (delivery.assignmentStatus === "unassigned" || delivery.assignmentStatus === "assigned") {
        delivery.assignmentStatus = "accepted";
      }
      if (!delivery.acceptedAt) delivery.acceptedAt = new Date();
    }

    if (safeStatus === "delivery_issue") {
      delivery.assignmentStatus = "issue_reported";
    }
    if (safeStatus === "delivered") {
      delivery.assignmentStatus = "completed";
      if (!delivery.deliveryBoyCompletedAt) delivery.deliveryBoyCompletedAt = new Date();
    }

    delivery.activityLogs.push(
      createDeliveryActivityLog({
        activityType: activityTypeFromStatus(safeStatus, String(activityType || "note")),
        deliveryStatus: safeStatus || delivery.status,
        note: String(note || "").trim() || String(issueReason || "").trim(),
        publicNote: String(publicNote || "").trim(),
        proofImageUrl: delivery.proofImageUrl || "",
        recipientName: delivery.proofRecipientName || "",
        verificationCodeChecked: !!suppliedCode,
        actorRole: "delivery_boy",
        actorName: req.deliveryBoy.fullName,
        actorId: req.deliveryBoy.id
      })
    );
    delivery.lastUpdatedAt = new Date();

    if (availabilityStatus !== undefined) {
      if (!DELIVERY_BOY_AVAILABILITY.includes(String(availabilityStatus || ""))) {
        return res.status(400).json({ message: "Invalid availability status" });
      }
      boy.availabilityStatus = String(availabilityStatus);
    } else if (["out_for_delivery", "arriving_soon"].includes(safeStatus)) {
      boy.availabilityStatus = "on_route";
    } else if (["delivered", "delivery_issue", "rescheduled", "cancelled"].includes(safeStatus)) {
      boy.availabilityStatus = "available";
    }

    boy.lastSeenAt = new Date();

    await order.save();
    await boy.save();

    res.json({
      message: "Activity logged",
      order,
      delivery: order.delivery,
      deliveryBoy: {
        id: boy._id,
        availabilityStatus: boy.availabilityStatus,
        lastSeenAt: boy.lastSeenAt
      }
    });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to log activity" });
  }
});

module.exports = router;
