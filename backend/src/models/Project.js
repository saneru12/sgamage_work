const mongoose = require("mongoose");

const projectSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    category: { type: String, required: true },
    location: { type: String, default: "" },
    year: { type: Number, default: new Date().getFullYear() },
    status: { type: String, default: "Completed" },
    description: { type: String, default: "" },
    imageUrl: { type: String, default: "" },
    isPublished: { type: Boolean, default: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Project", projectSchema);
