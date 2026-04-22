const mongoose = require("mongoose");

const inquiryMessageSchema = new mongoose.Schema(
  {
    sender: { type: String, enum: ["customer", "admin"], required: true },
    text: { type: String, required: true },
    // Stored explicitly so older MongoDB versions / tools can work without relying on timestamps in subdocs
    createdAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const inquirySchema = new mongoose.Schema(
  {
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "CustomerUser", index: true },
    name: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String, default: "" },
    service: { type: String, default: "" },
    location: { type: String, default: "" },
    message: { type: String, default: "" },
    // Threaded conversation between customer and admin
    messages: { type: [inquiryMessageSchema], default: [] },
    status: { type: String, default: "new" }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Inquiry", inquirySchema);
