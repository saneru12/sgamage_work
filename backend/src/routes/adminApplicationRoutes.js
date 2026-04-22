const express = require("express");
const JobApplication = require("../models/JobApplication");
const Job = require("../models/Job");
const { requireAdmin } = require("../middleware/auth");

const router = express.Router();
router.use(requireAdmin);

// GET /api/admin/applications?jobId=...
router.get("/", async (req, res) => {
  const filter = {};
  if (req.query.jobId) filter.jobId = req.query.jobId;
  const items = await JobApplication.find(filter).populate("jobId", "title department location").sort({ createdAt: -1 });
  res.json(items);
});

// GET /api/admin/applications/:id
router.get("/:id", async (req, res) => {
  const item = await JobApplication.findById(req.params.id).populate("jobId");
  if (!item) return res.status(404).json({ message: "Application not found" });
  res.json(item);
});

// PUT /api/admin/applications/:id  (status/notes)
router.put("/:id", async (req, res) => {
  const allowed = {};
  if (req.body.status) allowed.status = req.body.status;
  if (req.body.adminNotes !== undefined) allowed.adminNotes = req.body.adminNotes;
  const updated = await JobApplication.findByIdAndUpdate(req.params.id, allowed, { new: true, runValidators: true }).populate("jobId", "title");
  if (!updated) return res.status(404).json({ message: "Application not found" });
  res.json(updated);
});

// DELETE /api/admin/applications/:id
router.delete("/:id", async (req, res) => {
  const deleted = await JobApplication.findByIdAndDelete(req.params.id);
  if (!deleted) return res.status(404).json({ message: "Application not found" });
  res.json({ ok: true });
});

module.exports = router;
