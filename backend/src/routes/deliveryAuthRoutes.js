const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const DeliveryBoy = require("../models/DeliveryBoy");
const { normalizeDeliveryUsername } = require("../utils/deliveryUtils");

const router = express.Router();

router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ message: "username and password are required" });
    }

    const user = await DeliveryBoy.findOne({ username: normalizeDeliveryUsername(username), isActive: true });
    if (!user) return res.status(401).json({ message: "Invalid credentials" });

    const ok = await bcrypt.compare(String(password), user.passwordHash);
    if (!ok) return res.status(401).json({ message: "Invalid credentials" });

    user.lastLoginAt = new Date();
    user.lastSeenAt = new Date();
    await user.save();

    const token = jwt.sign(
      {
        role: "delivery_boy",
        sub: user._id.toString(),
        username: user.username,
        fullName: user.fullName
      },
      process.env.JWT_SECRET || "dev_secret_change_me",
      { expiresIn: "7d" }
    );

    res.json({
      token,
      deliveryBoy: {
        id: user._id.toString(),
        fullName: user.fullName,
        username: user.username,
        phone: user.phone,
        vehicleNumber: user.vehicleNumber,
        vehicleType: user.vehicleType,
        availabilityStatus: user.availabilityStatus,
        serviceAreas: user.serviceAreas || []
      }
    });
  } catch (err) {
    res.status(500).json({ message: err.message || "Login failed" });
  }
});

module.exports = router;
