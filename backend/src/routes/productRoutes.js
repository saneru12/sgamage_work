const express = require("express");
const Product = require("../models/Product");
const { requireAdmin } = require("../middleware/auth");
const {
  serializeProductForShop,
  productMatchesSearch,
  sortShopProducts,
  getCategorySummaries,
  normalizeProductPayload
} = require("../utils/productTaxonomy");

const router = express.Router();

router.get("/categories", async (req, res) => {
  const products = await Product.find({ isActive: true }).lean();
  res.json(getCategorySummaries(products));
});

router.get("/", async (req, res) => {
  const { q = "", category = "", inStock = "", sort = "featured" } = req.query;
  const products = await Product.find({ isActive: true }).lean();

  let items = products.map(serializeProductForShop);

  if (category && category !== "all") {
    items = items.filter((item) => item.shopCategoryKey === String(category).trim());
  }

  if (["1", "true", "yes"].includes(String(inStock).toLowerCase())) {
    items = items.filter((item) => Number(item.stockQty || 0) > 0);
  }

  if (String(q).trim()) {
    items = items.filter((item) => productMatchesSearch(item, q));
  }

  res.json(sortShopProducts(items, sort));
});

// Creating products should be admin-only. Use /api/admin/products for full control.
router.post("/", requireAdmin, async (req, res) => {
  const payload = normalizeProductPayload(req.body);
  if (!payload.name || req.body.priceLKR === undefined) {
    return res.status(400).json({ message: "name and priceLKR are required" });
  }

  const created = await Product.create(payload);
  res.status(201).json(serializeProductForShop(created));
});

module.exports = router;
