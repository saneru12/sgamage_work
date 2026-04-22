const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { requireCustomer, requireAdmin, requireDeliveryBoy } = require("../middleware/auth");

const router = express.Router();

function ensureDir(name) {
  const dir = path.join(__dirname, "..", "..", "uploads", name);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

const returnsDir = ensureDir("returns");
const paymentsDir = ensureDir("payments");
const cryptoDir = ensureDir("crypto");
const deliveriesDir = ensureDir("deliveries");

function safeFileName(file, fallback = "upload") {
  const safeBase = path
    .basename(file.originalname, path.extname(file.originalname))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || fallback;
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${safeBase}${path.extname(file.originalname).toLowerCase()}`;
}

function createUploader(destinationDir, { maxFiles = 4, maxSizeMB = 5, allowedMimes = [] } = {}) {
  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, destinationDir),
    filename: (_req, file, cb) => cb(null, safeFileName(file))
  });

  return multer({
    storage,
    limits: {
      files: maxFiles,
      fileSize: maxSizeMB * 1024 * 1024
    },
    fileFilter: (_req, file, cb) => {
      const mime = String(file.mimetype || "").toLowerCase();
      if (allowedMimes.length && !allowedMimes.includes(mime)) {
        return cb(new Error("Unsupported file type"));
      }
      cb(null, true);
    }
  });
}

const imageMimes = ["image/jpeg", "image/png", "image/webp", "image/jpg"];

const returnUpload = createUploader(returnsDir, {
  maxFiles: 4,
  maxSizeMB: 5,
  allowedMimes: imageMimes
});

const paymentUpload = createUploader(paymentsDir, {
  maxFiles: 5,
  maxSizeMB: 6,
  allowedMimes: imageMimes
});

const qrUpload = createUploader(cryptoDir, {
  maxFiles: 1,
  maxSizeMB: 4,
  allowedMimes: imageMimes
});

const deliveryProofUpload = createUploader(deliveriesDir, {
  maxFiles: 1,
  maxSizeMB: 6,
  allowedMimes: imageMimes
});

function hostUrl(req, segment, filename) {
  return `${req.protocol}://${req.get("host")}/uploads/${segment}/${filename}`;
}

router.post("/return-evidence", requireCustomer, (req, res) => {
  returnUpload.array("evidence", 4)(req, res, (err) => {
    if (err) {
      return res.status(400).json({ message: err.message || "Upload failed" });
    }

    const files = (req.files || []).map((file) => ({
      url: hostUrl(req, "returns", file.filename),
      filename: file.originalname,
      size: file.size
    }));

    res.status(201).json({ files });
  });
});

router.post("/payment-proof", requireCustomer, (req, res) => {
  paymentUpload.array("proof", 5)(req, res, (err) => {
    if (err) {
      return res.status(400).json({ message: err.message || "Upload failed" });
    }

    const files = (req.files || []).map((file) => ({
      url: hostUrl(req, "payments", file.filename),
      filename: file.originalname,
      size: file.size
    }));

    res.status(201).json({ files });
  });
});

router.post("/admin-crypto-qr", requireAdmin, (req, res) => {
  qrUpload.single("file")(req, res, (err) => {
    if (err) {
      return res.status(400).json({ message: err.message || "Upload failed" });
    }

    if (!req.file) {
      return res.status(400).json({ message: "Please choose an image file." });
    }

    return res.status(201).json({
      file: {
        url: hostUrl(req, "crypto", req.file.filename),
        filename: req.file.originalname,
        size: req.file.size
      }
    });
  });
});


router.post("/delivery-proof", requireDeliveryBoy, (req, res) => {
  deliveryProofUpload.single("file")(req, res, (err) => {
    if (err) {
      return res.status(400).json({ message: err.message || "Upload failed" });
    }

    if (!req.file) {
      return res.status(400).json({ message: "Please choose a delivery proof image." });
    }

    return res.status(201).json({
      file: {
        url: hostUrl(req, "deliveries", req.file.filename),
        filename: req.file.originalname,
        size: req.file.size
      }
    });
  });
});

router.post("/admin-delivery-proof", requireAdmin, (req, res) => {
  deliveryProofUpload.single("file")(req, res, (err) => {
    if (err) {
      return res.status(400).json({ message: err.message || "Upload failed" });
    }

    if (!req.file) {
      return res.status(400).json({ message: "Please choose a delivery proof image." });
    }

    return res.status(201).json({
      file: {
        url: hostUrl(req, "deliveries", req.file.filename),
        filename: req.file.originalname,
        size: req.file.size
      }
    });
  });
});

module.exports = router;
