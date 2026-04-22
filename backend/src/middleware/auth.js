const jwt = require("jsonwebtoken");
const CustomerUser = require("../models/CustomerUser");
const DeliveryBoy = require("../models/DeliveryBoy");

function getBearerToken(req) {
  const header = req.headers.authorization || "";
  return header.startsWith("Bearer ") ? header.slice(7) : "";
}

function verifyToken(req) {
  const token = getBearerToken(req);
  if (!token) throw new Error("Missing token");
  return jwt.verify(token, process.env.JWT_SECRET || "dev_secret_change_me");
}

function requireAdmin(req, res, next) {
  try {
    const payload = verifyToken(req);
    if (payload?.role !== "admin") {
      return res.status(403).json({ message: "Forbidden" });
    }
    req.admin = payload;
    return next();
  } catch (err) {
    return res.status(401).json({ message: err.message === "Missing token" ? "Missing token" : "Invalid/expired token" });
  }
}

async function requireCustomer(req, res, next) {
  try {
    const payload = verifyToken(req);
    if (payload?.role !== "customer") {
      return res.status(403).json({ message: "Forbidden" });
    }

    const user = await CustomerUser.findOne({ _id: payload.sub, isActive: true });
    if (!user) return res.status(401).json({ message: "Invalid/expired token" });

    req.customer = {
      id: user._id.toString(),
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      address: user.address
    };

    return next();
  } catch (err) {
    return res.status(401).json({ message: err.message === "Missing token" ? "Missing token" : "Invalid/expired token" });
  }
}

async function requireDeliveryBoy(req, res, next) {
  try {
    const payload = verifyToken(req);
    if (payload?.role !== "delivery_boy") {
      return res.status(403).json({ message: "Forbidden" });
    }

    const user = await DeliveryBoy.findOne({ _id: payload.sub, isActive: true });
    if (!user) return res.status(401).json({ message: "Invalid/expired token" });

    req.deliveryBoy = {
      id: user._id.toString(),
      fullName: user.fullName,
      username: user.username,
      phone: user.phone,
      vehicleNumber: user.vehicleNumber,
      vehicleType: user.vehicleType,
      availabilityStatus: user.availabilityStatus,
      serviceAreas: user.serviceAreas || []
    };

    return next();
  } catch (err) {
    return res.status(401).json({ message: err.message === "Missing token" ? "Missing token" : "Invalid/expired token" });
  }
}

module.exports = { getBearerToken, requireAdmin, requireCustomer, requireDeliveryBoy };
