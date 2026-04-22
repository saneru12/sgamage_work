const express = require("express");
const Job = require("../models/Job");
const { requireAdmin } = require("../middleware/auth");

const router = express.Router();
router.use(requireAdmin);

// GET /api/admin/jobs
router.get("/", async (req, res) => {
  const jobs = await Job.find().sort({ createdAt: -1 });
  res.json(jobs);
});

// POST /api/admin/jobs
router.post("/", async (req, res) => {
  const payload = req.body || {};
  if (!payload.title) return res.status(400).json({ message: "title is required" });

  const created = await Job.create({
    title: payload.title,
    imageUrl: payload.imageUrl || "",
    department: payload.department || "",
    location: payload.location || "Sri Lanka",
    employmentType: payload.employmentType || "Full-time",
    experienceLevel: payload.experienceLevel || "",
    salaryRange: payload.salaryRange || "",
    description: payload.description || "",
    responsibilities: Array.isArray(payload.responsibilities) ? payload.responsibilities : [],
    requirements: Array.isArray(payload.requirements) ? payload.requirements : [],
    benefits: Array.isArray(payload.benefits) ? payload.benefits : [],
    closingDate: payload.closingDate ? new Date(payload.closingDate) : null,
    isPublished: payload.isPublished !== undefined ? !!payload.isPublished : true
  });

  res.status(201).json(created);
});

// PUT /api/admin/jobs/:id
router.put("/:id", async (req, res) => {
  const updated = await Job.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!updated) return res.status(404).json({ message: "Job not found" });
  res.json(updated);
});

// DELETE /api/admin/jobs/:id
router.delete("/:id", async (req, res) => {
  const deleted = await Job.findByIdAndDelete(req.params.id);
  if (!deleted) return res.status(404).json({ message: "Job not found" });
  res.json({ ok: true });
});

module.exports = router;
