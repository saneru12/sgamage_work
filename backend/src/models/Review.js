const mongoose = require("mongoose");

const reviewSchema = new mongoose.Schema(
  {
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: "Project", required: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "CustomerUser", index: true },
    customerName: { type: String, required: true },
    rating: { type: Number, min: 1, max: 5, required: true },
    feedback: { type: String, required: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Review", reviewSchema);
