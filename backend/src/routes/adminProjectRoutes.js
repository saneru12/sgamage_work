const express = require("express");
const Project = require("../models/Project");
const Review = require("../models/Review");
const { requireAdmin } = require("../middleware/auth");

const router = express.Router();
router.use(requireAdmin);

router.get("/", async (req, res) => {
  const items = await Project.find().sort({ createdAt: -1 });
  res.json(items);
});

router.post("/", async (req, res) => {
  const { title, category, location = "", year, status = "Completed", description = "", imageUrl = "", isPublished = true } = req.body;
  if (!title || !category) return res.status(400).json({ message: "title and category are required" });
  const created = await Project.create({ title, category, location, year, status, description, imageUrl, isPublished: !!isPublished });
  res.status(201).json(created);
});

router.put("/:id", async (req, res) => {
  const updated = await Project.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!updated) return res.status(404).json({ message: "Project not found" });
  res.json(updated);
});

// Delete project + its reviews
router.delete("/:id", async (req, res) => {
  const deleted = await Project.findByIdAndDelete(req.params.id);
  if (!deleted) return res.status(404).json({ message: "Project not found" });
  await Review.deleteMany({ projectId: deleted._id });
  res.json({ ok: true });
});

module.exports = router;
