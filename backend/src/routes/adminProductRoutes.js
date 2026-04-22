const express = require("express");
const Product = require("../models/Product");
const { requireAdmin } = require("../middleware/auth");
const { serializeProductForShop, normalizeProductPayload } = require("../utils/productTaxonomy");

const router = express.Router();
router.use(requireAdmin);

router.get("/", async (req, res) => {
  const items = await Product.find().sort({ createdAt: -1, name: 1 }).lean();
  res.json(items.map(serializeProductForShop));
});

router.post("/", async (req, res) => {
  const payload = normalizeProductPayload(req.body);
  if (!payload.name || req.body.priceLKR === undefined) {
    return res.status(400).json({ message: "name and priceLKR are required" });
  }

  const created = await Product.create(payload);
  res.status(201).json(serializeProductForShop(created));
});

router.put("/:id", async (req, res) => {
  const payload = normalizeProductPayload(req.body, { partial: true });
  const updated = await Product.findByIdAndUpdate(req.params.id, payload, { new: true, runValidators: true });
  if (!updated) return res.status(404).json({ message: "Product not found" });
  res.json(serializeProductForShop(updated));
});

router.delete("/:id", async (req, res) => {
  const deleted = await Product.findByIdAndDelete(req.params.id);
  if (!deleted) return res.status(404).json({ message: "Product not found" });
  res.json({ ok: true });
});

module.exports = router;
