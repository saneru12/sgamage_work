const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");
const fs = require("fs");
const connectDB = require("./config/db");
const { ensureAdminUser } = require("./config/ensureAdmin");

dotenv.config();

const app = express();
const uploadsRoot = path.join(__dirname, "..", "uploads");
fs.mkdirSync(uploadsRoot, { recursive: true });

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(uploadsRoot));

app.get("/api/health", (req, res) => res.json({ ok: true, name: "S.Gamage Constructions API" }));

// Auth + settings
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/delivery/auth", require("./routes/deliveryAuthRoutes"));
app.use("/api/customers", require("./routes/customerRoutes"));
app.use("/api/settings", require("./routes/settingsRoutes"));

app.use("/api/services", require("./routes/serviceRoutes"));
app.use("/api/projects", require("./routes/projectRoutes"));
app.use("/api/reviews", require("./routes/reviewRoutes"));
app.use("/api/inquiries", require("./routes/inquiryRoutes"));
app.use("/api/products", require("./routes/productRoutes"));
app.use("/api/orders", require("./routes/orderRoutes"));
app.use("/api/uploads", require("./routes/uploadRoutes"));
app.use("/api/delivery", require("./routes/deliveryBoyRoutes"));

app.use("/api/jobs", require("./routes/jobRoutes"));

// Admin (protected by JWT)
app.use("/api/admin/services", require("./routes/adminServiceRoutes"));
app.use("/api/admin/projects", require("./routes/adminProjectRoutes"));
app.use("/api/admin/products", require("./routes/adminProductRoutes"));
app.use("/api/admin/reviews", require("./routes/adminReviewRoutes"));
app.use("/api/admin/inquiries", require("./routes/adminInquiryRoutes"));
app.use("/api/admin/orders", require("./routes/adminOrderRoutes"));
app.use("/api/admin/delivery-boys", require("./routes/adminDeliveryBoyRoutes"));
app.use("/api/admin/jobs", require("./routes/adminJobRoutes"));
app.use("/api/admin/applications", require("./routes/adminApplicationRoutes"));
app.use("/api/admin/settings", require("./routes/adminSettingRoutes"));

const PORT = process.env.PORT || 5000;

connectDB()
  .then(async () => {
    await ensureAdminUser();
    app.listen(PORT, () => console.log(`✅ Server running on http://localhost:${PORT}`));
  })
  .catch((err) => {
    console.error("❌ DB connection failed:", err.message);
    process.exit(1);
  });
