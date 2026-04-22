const mongoose = require("mongoose");
const { DELIVERY_BOY_AVAILABILITY, normalizeDeliveryUsername } = require("../utils/deliveryUtils");

const deliveryBoySchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    username: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
      set: normalizeDeliveryUsername
    },
    phone: { type: String, required: true, trim: true },
    passwordHash: { type: String, required: true },
    vehicleNumber: { type: String, default: "", trim: true },
    vehicleType: { type: String, default: "Owner vehicle", trim: true },
    serviceAreas: { type: [String], default: [] },
    maxDailyStops: { type: Number, default: 8, min: 1, max: 40 },
    maxConcurrentAssignments: { type: Number, default: 4, min: 1, max: 20 },
    availabilityStatus: {
      type: String,
      enum: DELIVERY_BOY_AVAILABILITY,
      default: "available"
    },
    notes: { type: String, default: "" },
    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date },
    lastSeenAt: { type: Date }
  },
  { timestamps: true }
);

deliveryBoySchema.pre("save", function normalizeBeforeSave(next) {
  if (Array.isArray(this.serviceAreas)) {
    this.serviceAreas = [...new Set(this.serviceAreas.map((item) => String(item || "").trim()).filter(Boolean))];
  }
  next();
});

module.exports = mongoose.model("DeliveryBoy", deliveryBoySchema);
