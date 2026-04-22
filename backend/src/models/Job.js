const mongoose = require("mongoose");

const jobSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    imageUrl: { type: String, default: "", trim: true }, // optional image link for job card
    department: { type: String, default: "", trim: true },
    location: { type: String, default: "Sri Lanka", trim: true },
    employmentType: { type: String, default: "Full-time", trim: true }, // Full-time / Part-time / Contract
    experienceLevel: { type: String, default: "", trim: true }, // e.g., Junior / Senior
    salaryRange: { type: String, default: "", trim: true },
    description: { type: String, default: "" },
    responsibilities: { type: [String], default: [] },
    requirements: { type: [String], default: [] },
    benefits: { type: [String], default: [] },
    closingDate: { type: Date, default: null },
    isPublished: { type: Boolean, default: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Job", jobSchema);
