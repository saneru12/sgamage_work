const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    category: { type: String, default: "Building Materials", trim: true },
    subCategory: { type: String, default: "", trim: true },
    brand: { type: String, default: "", trim: true },
    tags: [{ type: String, trim: true }],
    priceLKR: { type: Number, required: true },
    stockQty: { type: Number, default: 0 },
    description: { type: String, default: "" },
    imageUrl: { type: String, default: "" },
    isActive: { type: Boolean, default: true },
    isReturnable: { type: Boolean, default: true },
    nonReturnableReason: { type: String, default: "" },
    warrantyDays: { type: Number, default: 0, min: 0 }
  },
  { timestamps: true }
);

productSchema.index({ isActive: 1, category: 1, name: 1 });

module.exports = mongoose.model("Product", productSchema);
