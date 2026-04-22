const express = require("express");
const Service = require("../models/Service");
const { requireAdmin } = require("../middleware/auth");
const router = express.Router();

router.get("/", async (req, res) => {
  const services = await Service.find({ isActive: true }).sort({ category: 1, name: 1 });
  res.json(services);
});

// Creating services should be admin-only. Use /api/admin/services for full control.
router.post("/", requireAdmin, async (req, res) => {
  const { category, name, description = "", priceFromLKR = 0, imageUrl = "" } = req.body;
  if (!category || !name) return res.status(400).json({ message: "category and name are required" });
  const created = await Service.create({ category, name, description, priceFromLKR, imageUrl });
  res.status(201).json(created);
});

module.exports = router;
