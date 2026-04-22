const { DELIVERY_TIME_SLOT_OPTIONS, BALANCE_COLLECTION_MODES } = require("./deliveryUtils");

const PAYMENT_METHODS = {
  bank_transfer: {
    key: "bank_transfer",
    label: "Bank Transfer"
  },
  cash_deposit: {
    key: "cash_deposit",
    label: "Cash Deposit"
  },
  mobile_banking: {
    key: "mobile_banking",
    label: "Mobile Banking / App Transfer"
  },
  skrill: {
    key: "skrill",
    label: "Skrill"
  },
  crypto: {
    key: "crypto",
    label: "Crypto Transfer"
  }
};

const PAYMENT_STATUSES = [
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

function roundLKR(value) {
  return Math.max(0, Math.round(Number(value || 0)));
}

function clampAdvancePercent(value) {
  const pct = Number(value);
  if (Number.isNaN(pct)) return 25;
  return Math.min(100, Math.max(0, Math.round(pct * 100) / 100));
}

function getAdvancePercent(settings) {
  return clampAdvancePercent(settings?.orderAdvancePercent);
}

function isFullPaymentBalanceMode(balanceCollectionMode = "") {
  return String(balanceCollectionMode || "").trim() === "before_dispatch";
}

function computeCheckoutPaymentBreakdown(totalLKR, settings, balanceCollectionMode = "") {
  const total = roundLKR(totalLKR);
  if (isFullPaymentBalanceMode(balanceCollectionMode)) {
    return {
      totalLKR: total,
      advancePercent: total > 0 ? 100 : 0,
      advanceDueLKR: total,
      balanceDueLKR: 0,
      requiresFullPayment: true
    };
  }

  const advancePercent = getAdvancePercent(settings);
  const advanceDueLKR = roundLKR((total * advancePercent) / 100);
  const balanceDueLKR = roundLKR(total - advanceDueLKR);
  return {
    totalLKR: total,
    advancePercent,
    advanceDueLKR,
    balanceDueLKR,
    requiresFullPayment: false
  };
}

function computeAdvanceBreakdown(totalLKR, settings) {
  return computeCheckoutPaymentBreakdown(totalLKR, settings);
}

function getPaymentMethodConfig(settings, key) {
  const methodKey = String(key || "").trim();
  switch (methodKey) {
    case "bank_transfer":
      if (!settings?.bankTransferEnabled) return null;
      return {
        key: methodKey,
        label: PAYMENT_METHODS.bank_transfer.label,
        requiresProof: true,
        details: {
          accountName: settings.bankAccountName || "",
          accountNumber: settings.bankAccountNumber || "",
          bankName: settings.bankName || "",
          branch: settings.bankBranch || "",
          instructions: settings.bankInstructions || ""
        }
      };
    case "cash_deposit":
      if (!settings?.cashDepositEnabled) return null;
      return {
        key: methodKey,
        label: PAYMENT_METHODS.cash_deposit.label,
        requiresProof: true,
        details: {
          accountName: settings.bankAccountName || "",
          accountNumber: settings.bankAccountNumber || "",
          bankName: settings.bankName || "",
          branch: settings.bankBranch || "",
          instructions: settings.cashDepositInstructions || settings.bankInstructions || ""
        }
      };
    case "mobile_banking":
      if (!settings?.mobileBankingEnabled) return null;
      return {
        key: methodKey,
        label: PAYMENT_METHODS.mobile_banking.label,
        requiresProof: true,
        details: {
          providerName: settings.mobileBankingName || "",
          receiverNumber: settings.mobileBankingNumber || "",
          instructions: settings.mobileBankingInstructions || ""
        }
      };
    case "skrill":
      if (!settings?.skrillEnabled) return null;
      return {
        key: methodKey,
        label: PAYMENT_METHODS.skrill.label,
        requiresProof: true,
        details: {
          email: settings.skrillEmail || "",
          instructions: settings.skrillInstructions || ""
        }
      };
    case "crypto":
      if (!settings?.cryptoEnabled) return null;
      return {
        key: methodKey,
        label: PAYMENT_METHODS.crypto.label,
        requiresProof: true,
        details: {
          currency: settings.cryptoCurrency || "USDT",
          network: settings.cryptoNetwork || "TRC20",
          walletAddress: settings.cryptoWalletAddress || "",
          qrImageUrl: settings.cryptoQrImageUrl || "",
          instructions: settings.cryptoInstructions || ""
        }
      };
    default:
      return null;
  }
}

function getEnabledPaymentMethods(settings) {
  return Object.keys(PAYMENT_METHODS)
    .map((key) => getPaymentMethodConfig(settings, key))
    .filter(Boolean);
}

function normalizeWhatsAppNumber(raw) {
  const digits = String(raw || "").replace(/\D+/g, "");
  if (!digits) return "";
  if (digits.startsWith("0") && digits.length === 10) {
    return `94${digits.slice(1)}`;
  }
  return digits;
}

function formatDateForWhatsApp(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString();
}

function deliverySlotLabel(value = "") {
  const key = String(value || "").trim();
  return {
    morning_8_11: "Morning (8:00 AM - 11:00 AM)",
    midday_11_2: "Midday (11:00 AM - 2:00 PM)",
    afternoon_2_5: "Afternoon (2:00 PM - 5:00 PM)",
    full_day_8_5: "Full day route (8:00 AM - 5:00 PM)",
    call_to_confirm: "Call to confirm"
  }[key] || key;
}

function balanceModeLabel(value = "") {
  const key = String(value || "").trim();
  return {
    before_dispatch: "Full payment before dispatch",
    cash_on_delivery: "Cash on delivery",
    bank_transfer_before_delivery: "Bank transfer before delivery",
    card_or_transfer_on_arrival: "Card / transfer on arrival",
    already_paid: "Already paid",
    to_be_confirmed: "To be confirmed"
  }[key] || key;
}

function buildOrderWhatsAppUrl(settings, order) {
  const number = normalizeWhatsAppNumber(settings?.whatsapp || settings?.phone || "");
  if (!number || !order) return "";

  const paymentMethod = getPaymentMethodConfig(settings, order.paymentMethod);
  const proofLinks = Array.isArray(order.paymentProofImages)
    ? order.paymentProofImages.filter(Boolean).slice(0, 5)
    : [];
  const delivery = order.delivery || {};
  const requiresFullPayment = isFullPaymentBalanceMode(delivery.balanceCollectionMode) && roundLKR(order.balanceDueLKR) === 0;

  const lines = [
    requiresFullPayment ? "New full-payment hardware order" : "New advance-payment hardware order",
    `Order No: ${order.orderNumber || order._id}`,
    `Customer: ${order.customerName || "-"}`,
    `Phone: ${order.phone || "-"}`,
    `Order Total: LKR ${roundLKR(order.totalLKR).toLocaleString()}`,
    requiresFullPayment
      ? `Full Payment Required: LKR ${roundLKR(order.advanceDueLKR).toLocaleString()}`
      : `Advance Required (${Number(order.advancePercent || 0)}%): LKR ${roundLKR(order.advanceDueLKR).toLocaleString()}`,
    `Balance Due Later: LKR ${roundLKR(order.balanceDueLKR).toLocaleString()}`,
    `Payment Method: ${paymentMethod?.label || order.paymentMethod || "Manual payment"}`,
    order.paymentReference ? `Payment Reference: ${order.paymentReference}` : null,
    order.cryptoTxHash ? `Crypto TX Hash: ${order.cryptoTxHash}` : null,
    order.address ? `Delivery Address: ${order.address}` : null,
    delivery.siteContactName ? `Site Contact: ${delivery.siteContactName}` : null,
    delivery.siteContactPhone ? `Site Contact Phone: ${delivery.siteContactPhone}` : null,
    delivery.preferredDate ? `Preferred Date: ${formatDateForWhatsApp(delivery.preferredDate)}` : null,
    delivery.preferredTimeSlot && DELIVERY_TIME_SLOT_OPTIONS.includes(String(delivery.preferredTimeSlot || ""))
      ? `Preferred Time Slot: ${deliverySlotLabel(delivery.preferredTimeSlot)}`
      : null,
    delivery.balanceCollectionMode && BALANCE_COLLECTION_MODES.includes(String(delivery.balanceCollectionMode || ""))
      ? `Balance Preference: ${balanceModeLabel(delivery.balanceCollectionMode)}`
      : null,
    delivery.accessNotes ? `Access Notes: ${delivery.accessNotes}` : null,
    `Call Before Delivery: ${delivery.requiresCallBeforeDelivery === false ? "No" : "Yes"}`,
    `Split Delivery Allowed: ${delivery.allowSplitDelivery === false ? "No" : "Yes"}`,
    delivery.verificationCode ? `Delivery Verification Code: ${delivery.verificationCode}` : null,
    "Items:",
    ...(order.items || []).map((item) => `- ${item.name} x${Number(item.qty || 0)} = LKR ${roundLKR(Number(item.qty || 0) * Number(item.priceLKR || 0)).toLocaleString()}`),
    proofLinks.length ? "Payment Proof:" : null,
    ...proofLinks,
    settings?.whatsappCheckoutNote ? `Note: ${settings.whatsappCheckoutNote}` : null
  ].filter(Boolean);

  return `https://wa.me/${number}?text=${encodeURIComponent(lines.join("\n"))}`;
}

module.exports = {
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  roundLKR,
  clampAdvancePercent,
  getAdvancePercent,
  computeAdvanceBreakdown,
  computeCheckoutPaymentBreakdown,
  isFullPaymentBalanceMode,
  getPaymentMethodConfig,
  getEnabledPaymentMethods,
  buildOrderWhatsAppUrl,
  normalizeWhatsAppNumber
};
