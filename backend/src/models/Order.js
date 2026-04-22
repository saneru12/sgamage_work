const mongoose = require("mongoose");
const { RETURN_REQUEST_STATUSES, RETURN_RESOLUTIONS, generateOrderNumber } = require("../utils/returnPolicy");
const { PAYMENT_STATUSES } = require("../utils/paymentUtils");
const {
  DELIVERY_STATUSES,
  DELIVERY_TIME_SLOT_OPTIONS,
  UNLOADING_SUPPORT_OPTIONS,
  BALANCE_COLLECTION_MODES,
  DELIVERY_ASSIGNMENT_STATUSES,
  DELIVERY_ROUTE_PRIORITIES,
  DELIVERY_ACTIVITY_TYPES,
  generateDeliveryVerificationCode
} = require("../utils/deliveryUtils");

const orderItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    name: { type: String, required: true },
    brand: { type: String, default: "" },
    qty: { type: Number, required: true, min: 1 },
    priceLKR: { type: Number, required: true, min: 0 },
    imageUrl: { type: String, default: "" },
    isReturnable: { type: Boolean, default: true },
    nonReturnableReason: { type: String, default: "" },
    warrantyDays: { type: Number, default: 0, min: 0 }
  },
  { _id: false }
);

const returnRequestItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    name: { type: String, required: true },
    qty: { type: Number, required: true, min: 1 },
    priceLKR: { type: Number, required: true, min: 0 },
    reasonCode: {
      type: String,
      enum: [
        "damaged_on_arrival",
        "wrong_item_or_missing_parts",
        "defective_or_quality_issue",
        "unused_unopened"
      ],
      required: true
    },
    condition: {
      type: String,
      enum: ["sealed", "unused", "opened", "installed"],
      default: "opened"
    }
  },
  { _id: false }
);

const returnRequestSchema = new mongoose.Schema(
  {
    requestNumber: { type: String, required: true },
    status: { type: String, enum: RETURN_REQUEST_STATUSES, default: "requested" },
    requestedResolution: { type: String, enum: RETURN_RESOLUTIONS, default: "replacement" },
    resolutionType: { type: String, enum: RETURN_RESOLUTIONS, default: "replacement" },
    items: { type: [returnRequestItemSchema], default: [] },
    description: { type: String, default: "" },
    evidenceImages: [{ type: String }],
    pickupPreference: { type: String, enum: ["drop_off", "pickup"], default: "drop_off" },
    contactPhone: { type: String, default: "" },
    bankName: { type: String, default: "" },
    bankAccountName: { type: String, default: "" },
    bankAccountNumber: { type: String, default: "" },
    bankBranch: { type: String, default: "" },
    eligibleUntil: { type: Date },
    policyWindowLabel: { type: String, default: "" },
    customerVisibleNote: { type: String, default: "" },
    adminNotes: { type: String, default: "" },
    refundAmountLKR: { type: Number, default: 0, min: 0 },
    restockingFeeLKR: { type: Number, default: 0, min: 0 },
    restockToInventory: { type: Boolean, default: false },
    stockRestoredAt: { type: Date },
    approvedAt: { type: Date },
    receivedAt: { type: Date },
    completedAt: { type: Date }
  },
  { timestamps: true }
);

const deliveryEventSchema = new mongoose.Schema(
  {
    status: { type: String, enum: DELIVERY_STATUSES, required: true },
    title: { type: String, required: true },
    note: { type: String, default: "" },
    actor: { type: String, default: "system" },
    createdAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const deliveryActivityLogSchema = new mongoose.Schema(
  {
    activityType: { type: String, enum: DELIVERY_ACTIVITY_TYPES, default: "note" },
    deliveryStatus: { type: String, default: "" },
    note: { type: String, default: "" },
    publicNote: { type: String, default: "" },
    proofImageUrl: { type: String, default: "" },
    recipientName: { type: String, default: "" },
    verificationCodeChecked: { type: Boolean, default: false },
    actorRole: { type: String, enum: ["system", "admin", "delivery_boy"], default: "system" },
    actorName: { type: String, default: "system" },
    actorId: { type: String, default: "" },
    createdAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const deliverySchema = new mongoose.Schema(
  {
    method: { type: String, default: "own_vehicle" },
    serviceLabel: { type: String, default: "Owner vehicle delivery" },
    status: { type: String, enum: DELIVERY_STATUSES, default: "awaiting_advance_verification" },
    verificationCode: { type: String, default: generateDeliveryVerificationCode },
    verificationCodeVerifiedAt: { type: Date },
    siteContactName: { type: String, default: "" },
    siteContactPhone: { type: String, default: "" },
    preferredDate: { type: Date },
    preferredTimeSlot: { type: String, enum: DELIVERY_TIME_SLOT_OPTIONS, default: "call_to_confirm" },
    scheduledDate: { type: Date },
    scheduledWindow: { type: String, default: "" },
    routeZone: { type: String, default: "" },
    routePriority: { type: String, enum: DELIVERY_ROUTE_PRIORITIES, default: "normal" },
    routeSequence: { type: Number, default: 0, min: 0 },
    assignedDeliveryBoyId: { type: mongoose.Schema.Types.ObjectId, ref: "DeliveryBoy" },
    assignedDeliveryBoyName: { type: String, default: "" },
    assignedDeliveryBoyPhone: { type: String, default: "" },
    assignedDeliveryBoyUsername: { type: String, default: "" },
    assignmentStatus: { type: String, enum: DELIVERY_ASSIGNMENT_STATUSES, default: "unassigned" },
    assignmentNote: { type: String, default: "" },
    assignedAt: { type: Date },
    acceptedAt: { type: Date },
    deliveryBoyCompletedAt: { type: Date },
    driverName: { type: String, default: "" },
    driverPhone: { type: String, default: "" },
    vehicleNumber: { type: String, default: "" },
    accessNotes: { type: String, default: "" },
    requiresCallBeforeDelivery: { type: Boolean, default: true },
    unloadingSupport: { type: String, enum: UNLOADING_SUPPORT_OPTIONS, default: "unsure" },
    balanceCollectionMode: { type: String, enum: BALANCE_COLLECTION_MODES, default: "to_be_confirmed" },
    allowSplitDelivery: { type: Boolean, default: true },
    publicNote: { type: String, default: "" },
    adminNote: { type: String, default: "" },
    issueReason: { type: String, default: "" },
    proofImageUrl: { type: String, default: "" },
    proofRecipientName: { type: String, default: "" },
    confirmedAt: { type: Date },
    scheduledAt: { type: Date },
    packedAt: { type: Date },
    outForDeliveryAt: { type: Date },
    arrivedNearbyAt: { type: Date },
    completedAt: { type: Date },
    cancelledAt: { type: Date },
    lastIssueAt: { type: Date },
    lastRescheduledAt: { type: Date },
    lastUpdatedAt: { type: Date },
    dispatchCount: { type: Number, default: 0, min: 0 },
    failedAttempts: { type: Number, default: 0, min: 0 },
    events: { type: [deliveryEventSchema], default: [] },
    activityLogs: { type: [deliveryActivityLogSchema], default: [] }
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, required: true, index: true, default: generateOrderNumber },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "CustomerUser", index: true },
    customerName: { type: String, required: true },
    phone: { type: String, required: true },
    address: { type: String, default: "" },
    items: { type: [orderItemSchema], default: [] },
    totalLKR: { type: Number, required: true },
    advancePercent: { type: Number, default: 25, min: 0, max: 100 },
    advanceDueLKR: { type: Number, default: 0, min: 0 },
    balanceDueLKR: { type: Number, default: 0, min: 0 },
    paymentMethod: { type: String, default: "bank_transfer" },
    paymentMethodLabel: { type: String, default: "Bank Transfer" },
    paymentReference: { type: String, default: "" },
    paymentNote: { type: String, default: "" },
    cryptoTxHash: { type: String, default: "" },
    paymentProofImages: [{ type: String }],
    paymentSubmittedAt: { type: Date },
    paymentStatus: {
      type: String,
      enum: PAYMENT_STATUSES,
      default: "advance_submitted"
    },
    status: {
      type: String,
      enum: ["pending", "confirmed", "delivered", "partially_returned", "returned", "cancelled"],
      default: "pending"
    },
    confirmedAt: { type: Date },
    deliveredAt: { type: Date },
    cancelledAt: { type: Date },
    delivery: { type: deliverySchema, default: () => ({}) },
    returnRequests: { type: [returnRequestSchema], default: [] }
  },
  { timestamps: true }
);

orderSchema.index({ "delivery.assignedDeliveryBoyId": 1, "delivery.scheduledDate": 1 });

orderSchema.pre("validate", function setOrderNumber(next) {
  if (!this.orderNumber) {
    this.orderNumber = generateOrderNumber();
  }
  next();
});

module.exports = mongoose.model("Order", orderSchema);
