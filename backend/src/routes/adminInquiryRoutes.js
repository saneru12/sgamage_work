const express = require("express");
const Inquiry = require("../models/Inquiry");
const { requireAdmin } = require("../middleware/auth");

const router = express.Router();
router.use(requireAdmin);

function asText(v) {
  return String(v ?? "").trim();
}

router.get("/", async (req, res) => {
  // Sort by updatedAt so replied/active conversations float to the top
  const items = await Inquiry.find().sort({ updatedAt: -1 });
  res.json(items);
});

// View a single inquiry (with messages)
router.get("/:id", async (req, res) => {
  const inquiry = await Inquiry.findById(req.params.id);
  if (!inquiry) return res.status(404).json({ message: "Inquiry not found" });
  res.json(inquiry);
});

// Send a reply to an inquiry (adds a message to the thread)
router.post("/:id/reply", async (req, res) => {
  const text = asText(req.body?.text);
  if (!text) return res.status(400).json({ message: "text is required" });

  const inquiry = await Inquiry.findById(req.params.id);
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

  inquiry.messages.push({ sender: "admin", text, createdAt: new Date() });
  // Auto-mark as contacted if it was new
  if (inquiry.status === "new") inquiry.status = "contacted";
  await inquiry.save();

  res.status(201).json(inquiry);
});

// Update status / fields
router.patch("/:id", async (req, res) => {
  const updated = await Inquiry.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!updated) return res.status(404).json({ message: "Inquiry not found" });
  res.json(updated);
});

// Delete
router.delete("/:id", async (req, res) => {
  const deleted = await Inquiry.findByIdAndDelete(req.params.id);
  if (!deleted) return res.status(404).json({ message: "Inquiry not found" });
  res.json({ ok: true });
});

module.exports = router;
