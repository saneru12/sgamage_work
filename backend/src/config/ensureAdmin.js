const bcrypt = require("bcryptjs");
const AdminUser = require("../models/AdminUser");

async function ensureAdminUser() {
  const username = (process.env.ADMIN_USERNAME || "admin").toLowerCase().trim();
  const password = process.env.ADMIN_PASSWORD || "admin123";
  const displayName = process.env.ADMIN_DISPLAY_NAME || "Admin";

  const existing = await AdminUser.findOne({ username });
  if (existing) return;

  const passwordHash = await bcrypt.hash(String(password), 10);
  await AdminUser.create({ username, passwordHash, displayName, isActive: true });
  console.log(`✅ Admin user ready: ${username}`);
}

module.exports = { ensureAdminUser };
