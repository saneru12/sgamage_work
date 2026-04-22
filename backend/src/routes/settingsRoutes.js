const express = require("express");
const Setting = require("../models/Setting");

const router = express.Router();

router.get("/", async (req, res) => {
  let s = await Setting.findOne({ singleton: true });
  if (!s) s = await Setting.create({ singleton: true });
  res.json(s);
});

module.exports = router;
