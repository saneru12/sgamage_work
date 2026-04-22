const express = require("express");
const Setting = require("../models/Setting");
const { requireAdmin } = require("../middleware/auth");

const router = express.Router();
router.use(requireAdmin);

router.get("/", async (req, res) => {
  let s = await Setting.findOne({ singleton: true });
  if (!s) s = await Setting.create({ singleton: true });
  res.json(s);
});

router.put("/", async (req, res) => {
  const updated = await Setting.findOneAndUpdate({ singleton: true }, req.body, {
    new: true,
    upsert: true,
    runValidators: true,
    setDefaultsOnInsert: true
  });
  res.json(updated);
});

module.exports = router;
