const express = require("express");
const Service = require("../models/Service");
const { requireAdmin } = require("../middleware/auth");

const router = express.Router();

router.use(requireAdmin);

// List (including inactive)
router.get("/", async (req, res) => {
  const items = await Service.find().sort({ category: 1, name: 1 });
  res.json(items);
});

// Create
router.post("/", async (req, res) => {
  const { category, name, description = "", priceFromLKR = 0, imageUrl = "", isActive = true } = req.body;
  if (!category || !name) return res.status(400).json({ message: "category and name are required" });
  const created = await Service.create({ category, name, description, priceFromLKR, imageUrl, isActive: !!isActive });
  res.status(201).json(created);
});

// Update
router.put("/:id", async (req, res) => {
  const updated = await Service.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!updated) return res.status(404).json({ message: "Service not found" });
  res.json(updated);
});

// Delete
router.delete("/:id", async (req, res) => {
  const deleted = await Service.findByIdAndDelete(req.params.id);
  if (!deleted) return res.status(404).json({ message: "Service not found" });
  res.json({ ok: true });
});

module.exports = router;
