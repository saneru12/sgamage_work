const mongoose = require("mongoose");

const serviceSchema = new mongoose.Schema(
  {
    category: { type: String, required: true },
    name: { type: String, required: true },
    description: { type: String, default: "" },
    priceFromLKR: { type: Number, default: 0 },
    imageUrl: { type: String, default: "" },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Service", serviceSchema);
