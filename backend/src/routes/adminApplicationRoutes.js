const express = require("express");
const JobApplication = require("../models/JobApplication");
const Setting = require("../models/Setting");
const { requireAdmin } = require("../middleware/auth");
const { buildJobApplicationEmail } = require("../utils/jobApplicationMailer");
const { isMailerConfigured, sendMail } = require("../utils/mailer");

const router = express.Router();
router.use(requireAdmin);

const ALLOWED_STATUSES = new Set([
  "new",
  "reviewed",
  "shortlisted",
  "interview_scheduled",
  "approved",
  "hired",
  "on_hold",
  "rejected"
]);

const ALLOWED_RESPONSE_TYPES = new Set([
  "custom_update",
  "shortlist_update",
  "interview_invitation",
  "request_more_info",
  "approval",
  "rejection",
  "internal_note"
]);

function asText(value) {
  return String(value ?? "").trim();
}

function asDateOrNull(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeStatus(value, fallback = "") {
  const status = asText(value);
  if (!status) return fallback;
  if (!ALLOWED_STATUSES.has(status)) {
    throw new Error("Invalid status value");
  }
  return status;
}

function normalizeResponseType(value) {
  const responseType = asText(value) || "custom_update";
  if (!ALLOWED_RESPONSE_TYPES.has(responseType)) {
    throw new Error("Invalid response type");
  }
  return responseType;
}

function getAdminName(req) {
  return asText(req?.admin?.displayName) || asText(req?.admin?.username) || "Admin";
}

// GET /api/admin/applications?jobId=...&status=...&search=...
router.get("/", async (req, res) => {
  try {
    const filter = {};
    if (req.query.jobId) filter.jobId = req.query.jobId;
    if (req.query.status) filter.status = normalizeStatus(req.query.status);

    const search = asText(req.query.search);
    if (search) {
      const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [
        { fullName: regex },
        { email: regex },
        { phone: regex },
        { currentRole: regex },
        { expectedSalary: regex }
      ];
    }

    const items = await JobApplication.find(filter)
      .populate("jobId", "title department location employmentType experienceLevel salaryRange")
      .sort({ updatedAt: -1, createdAt: -1 });

    res.json(items);
  } catch (err) {
    res.status(400).json({ message: err.message || "Failed to load applications" });
  }
});

// GET /api/admin/applications/:id
router.get("/:id", async (req, res) => {
  const item = await JobApplication.findById(req.params.id)
    .populate("jobId")
    .populate("customerId", "fullName email phone address");

  if (!item) return res.status(404).json({ message: "Application not found" });
  res.json(item);
});

// PUT /api/admin/applications/:id  (status / notes)
router.put("/:id", async (req, res) => {
  try {
    const update = {};

    if (req.body.status !== undefined) {
      update.status = normalizeStatus(req.body.status);
    }

    if (req.body.adminNotes !== undefined) {
      update.adminNotes = String(req.body.adminNotes || "");
    }

    const updated = await JobApplication.findByIdAndUpdate(req.params.id, update, {
      new: true,
      runValidators: true
    }).populate("jobId", "title department location employmentType experienceLevel salaryRange");

    if (!updated) return res.status(404).json({ message: "Application not found" });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: err.message || "Failed to update application" });
  }
});

// POST /api/admin/applications/:id/respond
router.post("/:id/respond", async (req, res) => {
  try {
    const application = await JobApplication.findById(req.params.id)
      .populate("jobId")
      .populate("customerId", "fullName email phone address");

    if (!application) {
      return res.status(404).json({ message: "Application not found" });
    }

    const responseType = normalizeResponseType(req.body.responseType);
    const sendEmailNow = req.body.sendEmail !== false;
    const subject = asText(req.body.subject);
    const message = asText(req.body.message);
    const note = asText(req.body.note);
    const adminNotes = req.body.adminNotes !== undefined ? String(req.body.adminNotes || "") : undefined;
    const interviewDateTime = asDateOrNull(req.body.interviewDateTime);
    const interviewEndTime = asDateOrNull(req.body.interviewEndTime);
    const interviewMode = asText(req.body.interviewMode);
    const interviewLocation = asText(req.body.interviewLocation);
    const meetingLink = asText(req.body.meetingLink);

    if (responseType === "interview_invitation" && !interviewDateTime) {
      return res.status(400).json({ message: "Interview date and time are required for an interview invitation" });
    }

    if (!message && !note && responseType === "internal_note") {
      return res.status(400).json({ message: "Please enter a note for the application history" });
    }

    const nextStatus = req.body.status !== undefined
      ? normalizeStatus(req.body.status, application.status)
      : application.status;

    const settings = await Setting.findOne({ singleton: true }).lean();
    const emailContent = buildJobApplicationEmail({
      application,
      job: application.jobId || {},
      settings,
      payload: {
        responseType,
        subject,
        message,
        note,
        interviewDateTime,
        interviewEndTime,
        interviewMode,
        interviewLocation,
        meetingLink
      }
    });

    if (sendEmailNow && !isMailerConfigured()) {
      return res.status(400).json({
        message: "SMTP email is not configured yet. Update backend/.env with MAIL_HOST, MAIL_PORT, MAIL_FROM_EMAIL and your SMTP login before sending customer updates.",
        mailerConfigured: false
      });
    }

    let mailInfo = null;
    if (sendEmailNow) {
      mailInfo = await sendMail({
        to: application.email,
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
        replyTo: String(process.env.MAIL_REPLY_TO || settings?.email || "").trim() || undefined
      });
    }

    const sentAt = new Date();
    application.status = nextStatus;

    if (adminNotes !== undefined) {
      application.adminNotes = adminNotes;
    }

    if (interviewDateTime || interviewEndTime || interviewMode || interviewLocation || meetingLink || note) {
      application.interviewSchedule = {
        dateTime: interviewDateTime,
        endDateTime: interviewEndTime,
        mode: interviewMode,
        location: interviewLocation,
        meetingLink,
        note,
        sentAt
      };
    }

    const channel = sendEmailNow ? "email" : "internal";
    const sentBy = getAdminName(req);
    const communication = {
      responseType,
      channel,
      subject: emailContent.subject,
      message: responseType === "internal_note" && !message ? note : emailContent.messageBody,
      note,
      statusAtSend: nextStatus,
      interviewDateTime,
      interviewEndTime,
      interviewMode,
      interviewLocation,
      meetingLink,
      sentBy,
      sentToEmail: application.email,
      emailSent: sendEmailNow,
      createdAt: sentAt
    };

    application.communications.push(communication);
    application.lastContactedAt = sentAt;
    application.latestResponse = {
      responseType,
      channel,
      subject: emailContent.subject,
      message: communication.message,
      note,
      sentAt,
      sentToEmail: application.email,
      sentBy,
      emailSent: sendEmailNow
    };

    await application.save();

    const fresh = await JobApplication.findById(application._id)
      .populate("jobId", "title department location employmentType experienceLevel salaryRange")
      .populate("customerId", "fullName email phone address");

    res.json({
      ok: true,
      emailSent: sendEmailNow,
      mailerConfigured: isMailerConfigured(),
      mailMessageId: mailInfo?.messageId || "",
      application: fresh
    });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to send application update" });
  }
});

// DELETE /api/admin/applications/:id
router.delete("/:id", async (req, res) => {
  const deleted = await JobApplication.findByIdAndDelete(req.params.id);
  if (!deleted) return res.status(404).json({ message: "Application not found" });
  res.json({ ok: true });
});

module.exports = router;
