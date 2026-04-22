const express = require("express");
const Job = require("../models/Job");
const JobApplication = require("../models/JobApplication");
const { requireCustomer } = require("../middleware/auth");

const router = express.Router();

// GET /api/jobs  (public)
router.get("/", async (req, res) => {
  const now = new Date();
  const jobs = await Job.find({
    isPublished: true,
    $or: [{ closingDate: null }, { closingDate: { $gte: now } }]
  }).sort({ createdAt: -1 });
  res.json(jobs);
});

// GET /api/jobs/:id  (public)
router.get("/:id", async (req, res) => {
  const job = await Job.findById(req.params.id);
  if (!job || !job.isPublished) return res.status(404).json({ message: "Job not found" });
  res.json(job);
});

// POST /api/jobs/:id/apply  (customer login required)
router.post("/:id/apply", requireCustomer, async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job || !job.isPublished) return res.status(404).json({ message: "Job not found" });

    // Basic validation
    const {
      fullName,
      phone,
      email,
      address = "",
      experienceYears = 0,
      currentRole = "",
      expectedSalary = "",
      cvLink = "",
      message = ""
    } = req.body;

    const finalFullName = String(fullName || req.customer.fullName).trim();
    const finalPhone = String(phone || req.customer.phone).trim();
    const finalEmail = String(email || req.customer.email).toLowerCase().trim();

    if (!finalFullName || !finalPhone || !finalEmail) {
      return res.status(400).json({ message: "fullName, phone and email are required" });
    }

    // Simple duplicate prevention (same email+job within 7 days)
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const exists = await JobApplication.findOne({ jobId: job._id, email: finalEmail, createdAt: { $gte: weekAgo } });
    if (exists) {
      return res.status(409).json({ message: "You have already applied to this job recently. We will contact you soon." });
    }

    const created = await JobApplication.create({
      jobId: job._id,
      customerId: req.customer.id,
      fullName: finalFullName,
      phone: finalPhone,
      email: finalEmail,
      address,
      experienceYears: Number(experienceYears || 0),
      currentRole,
      expectedSalary,
      cvLink,
      message
    });

    res.status(201).json({ ok: true, id: created._id });
  } catch (err) {
    res.status(500).json({ message: err.message || "Application failed" });
  }
});

module.exports = router;
