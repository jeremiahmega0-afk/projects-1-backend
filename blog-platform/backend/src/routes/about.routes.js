 const express = require("express");

const { getAboutInfo } = require("../controllers/about.controller");

const router = express.Router();

router.get("/", getAboutInfo);

module.exports = router;