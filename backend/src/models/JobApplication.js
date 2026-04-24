const mongoose = require("mongoose");

const jobApplicationCommunicationSchema = new mongoose.Schema(
  {
    responseType: {
      type: String,
      default: "custom_update",
      enum: [
        "custom_update",
        "shortlist_update",
        "interview_invitation",
        "request_more_info",
        "approval",
        "rejection",
        "internal_note"
      ]
    },
    channel: {
      type: String,
      default: "email",
      enum: ["email", "internal"]
    },
    subject: { type: String, default: "" },
    message: { type: String, default: "" },
    note: { type: String, default: "" },
    statusAtSend: { type: String, default: "" },
    interviewDateTime: { type: Date, default: null },
    interviewEndTime: { type: Date, default: null },
    interviewMode: { type: String, default: "" },
    interviewLocation: { type: String, default: "" },
    meetingLink: { type: String, default: "" },
    sentBy: { type: String, default: "Admin" },
    sentToEmail: { type: String, default: "" },
    emailSent: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
  },
  { _id: true }
);

const jobApplicationSchema = new mongoose.Schema(
  {
    jobId: { type: mongoose.Schema.Types.ObjectId, ref: "Job", required: true, index: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "CustomerUser", index: true },
    fullName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    address: { type: String, default: "" },
    experienceYears: { type: Number, default: 0, min: 0 },
    currentRole: { type: String, default: "" },
    expectedSalary: { type: String, default: "" },
    cvLink: { type: String, default: "" },
    message: { type: String, default: "" },
    status: {
      type: String,
      default: "new",
      enum: [
        "new",
        "reviewed",
        "shortlisted",
        "interview_scheduled",
        "approved",
        "hired",
        "on_hold",
        "rejected"
      ]
    },
    adminNotes: { type: String, default: "" },
    interviewSchedule: {
      dateTime: { type: Date, default: null },
      endDateTime: { type: Date, default: null },
      mode: { type: String, default: "" },
      location: { type: String, default: "" },
      meetingLink: { type: String, default: "" },
      note: { type: String, default: "" },
      sentAt: { type: Date, default: null }
    },
    latestResponse: {
      responseType: { type: String, default: "" },
      channel: { type: String, default: "" },
      subject: { type: String, default: "" },
      message: { type: String, default: "" },
      note: { type: String, default: "" },
      sentAt: { type: Date, default: null },
      sentToEmail: { type: String, default: "" },
      sentBy: { type: String, default: "" },
      emailSent: { type: Boolean, default: false }
    },
    communications: { type: [jobApplicationCommunicationSchema], default: [] },
    lastContactedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

module.exports = mongoose.model("JobApplication", jobApplicationSchema);
