const express = require("express");
const Inquiry = require("../models/Inquiry");
const { requireAdmin, requireCustomer } = require("../middleware/auth");
const router = express.Router();

function asText(v) {
  return String(v ?? "").trim();
}

router.post("/", requireCustomer, async (req, res) => {
  const { service = "", location = "", message = "" } = req.body;
  const msg = asText(message);

  if (!msg) {
    return res.status(400).json({ message: "message is required" });
  }

  const created = await Inquiry.create({
    customerId: req.customer.id,
    name: req.customer.fullName,
    phone: req.customer.phone,
    email: req.customer.email,
    service,
    location,
    message: msg,
    messages: [
      {
        sender: "customer",
        text: msg,
        createdAt: new Date()
      }
    ]
  });
  res.status(201).json({ message: "Inquiry submitted", inquiry: created });
});

// Customer can view a single inquiry (their own)
router.get("/:id", requireCustomer, async (req, res) => {
  const inquiry = await Inquiry.findOne({ _id: req.params.id, customerId: req.customer.id });
  if (!inquiry) return res.status(404).json({ message: "Inquiry not found" });
  res.json(inquiry);
});

// Customer can send a follow-up message to an existing inquiry
router.post("/:id/messages", requireCustomer, async (req, res) => {
  const text = asText(req.body?.text);
  if (!text) return res.status(400).json({ message: "text is required" });

  const inquiry = await Inquiry.findOne({ _id: req.params.id, customerId: req.customer.id });
  if (!inquiry) return res.status(404).json({ message: "Inquiry not found" });

  // Backfill old inquiries that were created before threaded messaging existed
  if ((!inquiry.messages || inquiry.messages.length === 0) && asText(inquiry.message)) {
    inquiry.messages = [
      {
        sender: "customer",
        text: asText(inquiry.message),
        createdAt: inquiry.createdAt || new Date()
      }
    ];
  }

  inquiry.messages.push({ sender: "customer", text, createdAt: new Date() });
  await inquiry.save();
  res.status(201).json(inquiry);
});

// Listing all inquiries should be admin-only. Customers can view their own from /api/customers/me/inquiries
router.get("/", requireAdmin, async (req, res) => {
  const items = await Inquiry.find().sort({ updatedAt: -1 });
  res.json(items);
});

module.exports = router;
