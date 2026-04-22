const express = require("express");
const Review = require("../models/Review");
const Project = require("../models/Project");
const { requireCustomer } = require("../middleware/auth");
const router = express.Router();

router.get("/project/:projectId", async (req, res) => {
  const reviews = await Review.find({ projectId: req.params.projectId }).sort({ createdAt: -1 });
  res.json(reviews);
});

router.post("/", requireCustomer, async (req, res) => {
  const { projectId, rating, feedback } = req.body;

  if (!projectId || !rating || !feedback) {
    return res.status(400).json({ message: "projectId, rating, feedback are required" });
  }

  const project = await Project.findById(projectId);
  if (!project) return res.status(404).json({ message: "Project not found" });

  const r = Number(rating);
  if (Number.isNaN(r) || r < 1 || r > 5) return res.status(400).json({ message: "rating must be 1-5" });

  const created = await Review.create({
    projectId,
    customerId: req.customer.id,
    customerName: req.customer.fullName,
    rating: r,
    feedback
  });
  res.status(201).json(created);
});

module.exports = router;
