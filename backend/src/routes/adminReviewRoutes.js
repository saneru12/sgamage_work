const express = require("express");
const Review = require("../models/Review");
const { requireAdmin } = require("../middleware/auth");

const router = express.Router();
router.use(requireAdmin);

router.get("/", async (req, res) => {
  const items = await Review.find().sort({ createdAt: -1 });
  res.json(items);
});

router.delete("/:id", async (req, res) => {
  const deleted = await Review.findByIdAndDelete(req.params.id);
  if (!deleted) return res.status(404).json({ message: "Review not found" });
  res.json({ ok: true });
});

module.exports = router;