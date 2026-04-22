const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const AdminUser = require("../models/AdminUser");

const router = express.Router();

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ message: "username and password are required" });
    }

    const user = await AdminUser.findOne({ username: String(username).toLowerCase().trim(), isActive: true });
    if (!user) return res.status(401).json({ message: "Invalid credentials" });

    const ok = await bcrypt.compare(String(password), user.passwordHash);
    if (!ok) return res.status(401).json({ message: "Invalid credentials" });

    const token = jwt.sign(
      { role: "admin", sub: user._id.toString(), username: user.username, displayName: user.displayName },
      process.env.JWT_SECRET || "dev_secret_change_me",
      { expiresIn: "12h" }
    );

    res.json({ token, admin: { username: user.username, displayName: user.displayName } });
  } catch (err) {
    res.status(500).json({ message: err.message || "Login failed" });
  }
});

module.exports = router;
