const express = require("express");
const Order = require("../models/Order");
const Product = require("../models/Product");
const Setting = require("../models/Setting");
const { requireCustomer } = require("../middleware/auth");
const {
  RETURN_RESOLUTIONS,
  evaluateReturnEligibility,
  getRemainingReturnableQty,
  generateOrderNumber,
  generateReturnRequestNumber
} = require("../utils/returnPolicy");
const {
  computeCheckoutPaymentBreakdown,
  isFullPaymentBalanceMode,
  getPaymentMethodConfig,
  buildOrderWhatsAppUrl
} = require("../utils/paymentUtils");
const {
  DELIVERY_TIME_SLOT_OPTIONS,
  UNLOADING_SUPPORT_OPTIONS,
  BALANCE_COLLECTION_MODES,
  createInitialDeliveryPayload,
  normalizeOptionalDate
} = require("../utils/deliveryUtils");

const router = express.Router();

const CHECKOUT_BALANCE_COLLECTION_MODES = ["before_dispatch", "cash_on_delivery"];

async function getSingletonSettings() {
  let settings = await Setting.findOne({ singleton: true });
  if (!settings) settings = await Setting.create({ singleton: true });
  return settings;
}

router.post("/", requireCustomer, async (req, res) => {
  const {
    address = "",
    items = [],
    paymentMethod = "",
    paymentProofImages = [],
    paymentReference = "",
    paymentNote = "",
    cryptoTxHash = "",
    siteContactName = "",
    siteContactPhone = "",
    preferredDate = "",
    preferredTimeSlot = "call_to_confirm",
    accessNotes = "",
    unloadingSupport = "unsure",
    balanceCollectionMode = "to_be_confirmed",
    requiresCallBeforeDelivery = true,
    allowSplitDelivery = true
  } = req.body || {};

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: "items[] are required" });
  }

  const parsedPreferredDate = preferredDate ? normalizeOptionalDate(preferredDate) : null;
  if (preferredDate && !parsedPreferredDate) {
    return res.status(400).json({ message: "Please provide a valid preferred delivery date." });
  }

  if (!DELIVERY_TIME_SLOT_OPTIONS.includes(String(preferredTimeSlot || "call_to_confirm"))) {
    return res.status(400).json({ message: "Please select a valid preferred delivery time slot." });
  }

  if (!UNLOADING_SUPPORT_OPTIONS.includes(String(unloadingSupport || "unsure"))) {
    return res.status(400).json({ message: "Please select a valid unloading support option." });
  }

  if (!CHECKOUT_BALANCE_COLLECTION_MODES.includes(String(balanceCollectionMode || ""))) {
    return res.status(400).json({ message: "Please select a valid balance settlement option." });
  }

  const settings = await getSingletonSettings();
  const paymentConfig = getPaymentMethodConfig(settings, paymentMethod);
  if (!paymentConfig) {
    return res.status(400).json({ message: "Please select a valid payment method." });
  }

  const normalizedProofImages = Array.isArray(paymentProofImages)
    ? paymentProofImages.map((item) => String(item || "").trim()).filter(Boolean).slice(0, 5)
    : [];

  const requiresFullPayment = isFullPaymentBalanceMode(balanceCollectionMode);

  if (paymentConfig.requiresProof && !normalizedProofImages.length) {
    return res.status(400).json({
      message: requiresFullPayment
        ? "Please upload your full payment slip / proof before placing the order."
        : "Please upload your advance payment slip / proof before placing the order."
    });
  }

  if (paymentMethod === "crypto" && !String(cryptoTxHash || "").trim()) {
    return res.status(400).json({ message: "Please enter the crypto transaction hash/reference." });
  }

  let total = 0;
  const normalized = [];

  for (const it of items) {
    const prod = await Product.findById(it.productId);
    if (!prod) return res.status(404).json({ message: "Product not found: " + it.productId });

    const qty = Number(it.qty || 1);
    if (qty < 1) return res.status(400).json({ message: "qty must be >= 1" });

    if (Number(prod.stockQty || 0) < qty) {
      return res.status(400).json({ message: `Not enough stock for ${prod.name}. Available: ${prod.stockQty}` });
    }

    total += qty * prod.priceLKR;
    normalized.push({
      productId: prod._id,
      name: prod.name,
      brand: prod.brand || "",
      qty,
      priceLKR: prod.priceLKR,
      imageUrl: prod.imageUrl || "",
      isReturnable: prod.isReturnable !== false,
      nonReturnableReason: prod.nonReturnableReason || "",
      warrantyDays: Number(prod.warrantyDays || 0)
    });
  }

  const paymentSummary = computeCheckoutPaymentBreakdown(total, settings, balanceCollectionMode);

  const decremented = [];
  try {
    for (const it of normalized) {
      const updated = await Product.findOneAndUpdate(
        { _id: it.productId, stockQty: { $gte: it.qty } },
        { $inc: { stockQty: -it.qty } },
        { new: true }
      );
      if (!updated) throw new Error("Stock changed, please try again");
      decremented.push(it);
    }

    const delivery = createInitialDeliveryPayload(settings, {
      customerName: req.customer.fullName,
      phone: req.customer.phone,
      siteContactName,
      siteContactPhone,
      preferredDate: parsedPreferredDate,
      preferredTimeSlot,
      address: String(address || req.customer.address || "").trim(),
      accessNotes,
      unloadingSupport,
      balanceCollectionMode,
      requiresCallBeforeDelivery,
      allowSplitDelivery
    });

    const created = await Order.create({
      orderNumber: generateOrderNumber(),
      customerId: req.customer.id,
      customerName: req.customer.fullName,
      phone: req.customer.phone,
      address: String(address || req.customer.address || "").trim(),
      items: normalized,
      totalLKR: paymentSummary.totalLKR,
      advancePercent: paymentSummary.advancePercent,
      advanceDueLKR: paymentSummary.advanceDueLKR,
      balanceDueLKR: paymentSummary.balanceDueLKR,
      paymentMethod: paymentConfig.key,
      paymentMethodLabel: paymentConfig.label,
      paymentReference: String(paymentReference || "").trim(),
      paymentNote: String(paymentNote || "").trim(),
      cryptoTxHash: String(cryptoTxHash || "").trim(),
      paymentProofImages: normalizedProofImages,
      paymentSubmittedAt: normalizedProofImages.length ? new Date() : null,
      paymentStatus: normalizedProofImages.length ? "advance_submitted" : "advance_required",
      status: "pending",
      delivery
    });

    const whatsappUrl = buildOrderWhatsAppUrl(settings, created.toObject());

    return res.status(201).json({
      message: requiresFullPayment ? "Full-payment order placed" : "Advance-payment order placed",
      order: created,
      whatsappUrl,
      paymentSummary
    });
  } catch (err) {
    for (const it of decremented) {
      await Product.findByIdAndUpdate(it.productId, { $inc: { stockQty: it.qty } });
    }
    return res.status(409).json({ message: err.message || "Order failed" });
  }
});

router.post("/:id/returns", requireCustomer, async (req, res) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, customerId: req.customer.id });
    if (!order) return res.status(404).json({ message: "Order not found" });

    const {
      items = [],
      description = "",
      requestedResolution = "replacement",
      pickupPreference = "drop_off",
      evidenceImages = [],
      contactPhone = "",
      bankName = "",
      bankAccountName = "",
      bankAccountNumber = "",
      bankBranch = ""
    } = req.body || {};

    if (!Array.isArray(items) || !items.length) {
      return res.status(400).json({ message: "Please select at least one order item to return." });
    }

    if (!RETURN_RESOLUTIONS.includes(String(requestedResolution || ""))) {
      return res.status(400).json({ message: "Please select a valid requested resolution." });
    }

    const imageUrls = Array.isArray(evidenceImages)
      ? evidenceImages.map((item) => String(item || "").trim()).filter(Boolean).slice(0, 4)
      : [];

    const localRequestQty = new Map();
    const preparedItems = [];
    const deadlines = [];
    const windowLabels = new Set();

    for (const row of items) {
      const productId = String(row?.productId || "").trim();
      const qty = Number(row?.qty || 0);
      const reasonCode = String(row?.reasonCode || "").trim();
      const condition = String(row?.condition || "opened").trim();

      if (!productId) {
        return res.status(400).json({ message: "Each return item must include productId." });
      }
      if (!qty || qty < 1) {
        return res.status(400).json({ message: "Return quantity must be at least 1." });
      }

      const orderItem = (order.items || []).find((item) => String(item?.productId || "") === productId);
      if (!orderItem) {
        return res.status(400).json({ message: "Selected product was not found in this order." });
      }

      const alreadyInPayload = Number(localRequestQty.get(productId) || 0);
      const remainingQty = getRemainingReturnableQty(order, productId) - alreadyInPayload;
      if (qty > remainingQty) {
        return res.status(400).json({
          message: `You can request up to ${Math.max(remainingQty, 0)} more item(s) for ${orderItem.name}.`
        });
      }

      const eligibility = evaluateReturnEligibility({ order, orderItem, reasonCode, condition });
      if (!eligibility.ok) {
        return res.status(400).json({ message: `${orderItem.name}: ${eligibility.message}` });
      }

      if (eligibility.rule?.allowedResolutions?.length && !eligibility.rule.allowedResolutions.includes(requestedResolution)) {
        return res.status(400).json({
          message: `${orderItem.name}: ${requestedResolution.replaceAll("_", " ")} is not available for this return reason.`
        });
      }

      localRequestQty.set(productId, alreadyInPayload + qty);
      if (eligibility.deadline) deadlines.push(new Date(eligibility.deadline));
      if (eligibility.rule?.windowLabel) windowLabels.add(eligibility.rule.windowLabel);

      preparedItems.push({
        productId: orderItem.productId,
        name: orderItem.name,
        qty,
        priceLKR: orderItem.priceLKR,
        reasonCode,
        condition
      });
    }

    if (!preparedItems.length) {
      return res.status(400).json({ message: "No valid items were selected for return." });
    }

    const eligibleUntil = deadlines.length
      ? new Date(Math.min(...deadlines.map((d) => d.getTime())))
      : null;

    order.returnRequests.push({
      requestNumber: generateReturnRequestNumber(),
      status: "requested",
      requestedResolution,
      resolutionType: requestedResolution,
      items: preparedItems,
      description: String(description || "").trim(),
      evidenceImages: imageUrls,
      pickupPreference: ["drop_off", "pickup"].includes(String(pickupPreference || "")) ? pickupPreference : "drop_off",
      contactPhone: String(contactPhone || req.customer.phone || "").trim(),
      bankName: String(bankName || "").trim(),
      bankAccountName: String(bankAccountName || "").trim(),
      bankAccountNumber: String(bankAccountNumber || "").trim(),
      bankBranch: String(bankBranch || "").trim(),
      eligibleUntil,
      policyWindowLabel: Array.from(windowLabels).join(" / ") || "As per return policy"
    });

    await order.save();

    const created = order.returnRequests[order.returnRequests.length - 1];
    res.status(201).json({
      message: "Return request submitted successfully",
      returnRequest: created,
      order
    });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to submit return request" });
  }
});

router.get("/", async (req, res) => {
  res.status(410).json({ message: "Use /api/customers/me/orders" });
});

module.exports = router;
