const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const CustomerUser = require("../models/CustomerUser");
const Order = require("../models/Order");
const Inquiry = require("../models/Inquiry");
const Review = require("../models/Review");
const JobApplication = require("../models/JobApplication");
const { requireCustomer } = require("../middleware/auth");

const router = express.Router();

function normalizeEmail(email) {
  return String(email || "").toLowerCase().trim();
}

function normalizePhone(phone) {
  return String(phone || "").trim();
}

function sanitizeApplicationForCustomer(doc) {
  const item = doc?.toObject ? doc.toObject() : doc || {};
  const communications = Array.isArray(item.communications)
    ? item.communications
        .filter((entry) => String(entry?.channel || "") === "email")
        .map((entry) => ({
          _id: entry._id,
          responseType: entry.responseType,
          channel: entry.channel,
          subject: entry.subject,
          message: entry.message,
          note: entry.note,
          statusAtSend: entry.statusAtSend,
          interviewDateTime: entry.interviewDateTime,
          interviewEndTime: entry.interviewEndTime,
          interviewMode: entry.interviewMode,
          interviewLocation: entry.interviewLocation,
          meetingLink: entry.meetingLink,
          sentBy: entry.sentBy,
          sentToEmail: entry.sentToEmail,
          emailSent: entry.emailSent,
          createdAt: entry.createdAt
        }))
    : [];

  const latestResponse = item.latestResponse && item.latestResponse.channel === "email"
    ? {
        responseType: item.latestResponse.responseType,
        channel: item.latestResponse.channel,
        subject: item.latestResponse.subject,
        message: item.latestResponse.message,
        note: item.latestResponse.note,
        sentAt: item.latestResponse.sentAt,
        sentToEmail: item.latestResponse.sentToEmail,
        sentBy: item.latestResponse.sentBy,
        emailSent: item.latestResponse.emailSent
      }
    : null;

  return {
    _id: item._id,
    jobId: item.jobId,
    customerId: item.customerId,
    fullName: item.fullName,
    phone: item.phone,
    email: item.email,
    address: item.address,
    experienceYears: item.experienceYears,
    currentRole: item.currentRole,
    expectedSalary: item.expectedSalary,
    cvLink: item.cvLink,
    message: item.message,
    status: item.status,
    interviewSchedule: item.interviewSchedule || null,
    latestResponse,
    communications,
    lastContactedAt: item.lastContactedAt,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt
  };
}

// POST /api/customers/register
// Note: As requested, registration does NOT auto-login. Customer must login via login panel.
router.post("/register", async (req, res) => {
  try {
    const { fullName, email, phone, password, address = "" } = req.body;

    if (!fullName || !email || !phone || !password) {
      return res.status(400).json({ message: "fullName, email, phone and password are required" });
    }

    const e = normalizeEmail(email);
    const p = normalizePhone(phone);

    if (!e.includes("@")) {
      return res.status(400).json({ message: "Please enter a valid email" });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    const existing = await CustomerUser.findOne({ $or: [{ email: e }, { phone: p }] });
    if (existing) {
      return res.status(409).json({ message: "Email or phone is already registered" });
    }

    const passwordHash = await bcrypt.hash(String(password), 10);
    await CustomerUser.create({
      fullName: String(fullName).trim(),
      email: e,
      phone: p,
      address: String(address || ""),
      passwordHash,
      isActive: true
    });

    res.status(201).json({ ok: true, message: "Registered successfully. Please login." });
  } catch (err) {
    res.status(500).json({ message: err.message || "Registration failed" });
  }
});

// POST /api/customers/login
router.post("/login", async (req, res) => {
  try {
    const { emailOrPhone, password } = req.body;
    if (!emailOrPhone || !password) {
      return res.status(400).json({ message: "emailOrPhone and password are required" });
    }

    const qp = String(emailOrPhone).trim();
    const isEmail = qp.includes("@");

    const user = await CustomerUser.findOne(
      isEmail ? { email: normalizeEmail(qp), isActive: true } : { phone: normalizePhone(qp), isActive: true }
    );
    if (!user) return res.status(401).json({ message: "Invalid credentials" });

    const ok = await bcrypt.compare(String(password), user.passwordHash);
    if (!ok) return res.status(401).json({ message: "Invalid credentials" });

    const token = jwt.sign(
      { role: "customer", sub: user._id.toString() },
      process.env.JWT_SECRET || "dev_secret_change_me",
      { expiresIn: "30d" }
    );

    res.json({
      token,
      customer: {
        id: user._id.toString(),
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        address: user.address
      }
    });
  } catch (err) {
    res.status(500).json({ message: err.message || "Login failed" });
  }
});

// GET /api/customers/me
router.get("/me", requireCustomer, async (req, res) => {
  res.json({ customer: req.customer });
});

// PATCH /api/customers/me
router.patch("/me", requireCustomer, async (req, res) => {
  try {
    const updates = {};
    if (req.body.fullName !== undefined) updates.fullName = String(req.body.fullName).trim();
    if (req.body.phone !== undefined) updates.phone = normalizePhone(req.body.phone);
    if (req.body.address !== undefined) updates.address = String(req.body.address || "");

    if (req.body.email !== undefined) {
      return res.status(400).json({ message: "Email change is not supported" });
    }

    if (req.body.newPassword) {
      const newPassword = String(req.body.newPassword);
      if (newPassword.length < 6) return res.status(400).json({ message: "Password must be at least 6 characters" });
      updates.passwordHash = await bcrypt.hash(newPassword, 10);
    }

    if (updates.phone) {
      const exists = await CustomerUser.findOne({ phone: updates.phone, _id: { $ne: req.customer.id } });
      if (exists) return res.status(409).json({ message: "Phone is already in use" });
    }

    const updated = await CustomerUser.findByIdAndUpdate(req.customer.id, updates, { new: true, runValidators: true });
    if (!updated) return res.status(404).json({ message: "Customer not found" });

    res.json({
      customer: {
        id: updated._id.toString(),
        fullName: updated.fullName,
        email: updated.email,
        phone: updated.phone,
        address: updated.address
      }
    });
  } catch (err) {
    res.status(500).json({ message: err.message || "Update failed" });
  }
});

// ------------------ Customer self-service data ------------------
router.get("/me/orders", requireCustomer, async (req, res) => {
  const items = await Order.find({ customerId: req.customer.id }).sort({ createdAt: -1 });
  res.json(items);
});

router.get("/me/inquiries", requireCustomer, async (req, res) => {
  const items = await Inquiry.find({ customerId: req.customer.id }).sort({ updatedAt: -1 });
  res.json(items);
});

router.get("/me/reviews", requireCustomer, async (req, res) => {
  const items = await Review.find({ customerId: req.customer.id }).sort({ createdAt: -1 }).populate("projectId", "title");
  res.json(items);
});

router.get("/me/applications", requireCustomer, async (req, res) => {
  const items = await JobApplication.find({ customerId: req.customer.id })
    .sort({ createdAt: -1 })
    .populate("jobId", "title department location employmentType experienceLevel salaryRange");

  res.json(items.map((item) => sanitizeApplicationForCustomer(item)));
});

module.exports = router;
