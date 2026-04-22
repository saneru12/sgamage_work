const mongoose = require("mongoose");

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
    cvLink: { type: String, default: "" }, // Google Drive link / Dropbox / etc.
    message: { type: String, default: "" },
    status: { type: String, default: "new", enum: ["new", "reviewed", "shortlisted", "rejected"] },
    adminNotes: { type: String, default: "" }
  },
  { timestamps: true }
);

module.exports = mongoose.model("JobApplication", jobApplicationSchema);
