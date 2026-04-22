const express = require("express");
const Project = require("../models/Project");
const Review = require("../models/Review");
const { requireAdmin } = require("../middleware/auth");
const router = express.Router();

router.get("/", async (req, res) => {
  const projects = await Project.find({ isPublished: true }).sort({ createdAt: -1 });
  res.json(projects);
});

router.get("/:id", async (req, res) => {
  const project = await Project.findById(req.params.id);
  if (!project) return res.status(404).json({ message: "Project not found" });

  const reviews = await Review.find({ projectId: project._id }).sort({ createdAt: -1 });
  const avg = reviews.length ? (reviews.reduce((a, r) => a + r.rating, 0) / reviews.length) : 0;

  res.json({ project, avgRating: Number(avg.toFixed(2)), reviewCount: reviews.length });
});

// Creating projects should be admin-only. Use /api/admin/projects for full control.
router.post("/", requireAdmin, async (req, res) => {
  const { title, category, location = "", year, status = "Completed", description = "", imageUrl = "" } = req.body;
  if (!title || !category) return res.status(400).json({ message: "title and category are required" });

  const created = await Project.create({ title, category, location, year, status, description, imageUrl });
  res.status(201).json(created);
});

module.exports = router;
