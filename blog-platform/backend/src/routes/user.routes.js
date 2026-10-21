const express = require("express");

const protect = require("../middleware/auth.middleware");
const authorize = require("../middleware/role.middleware");

const {
  getProfile,
  getAdminDashboard,
} = require("../controllers/user.controller");

const router = express.Router();

router.get("/profile", protect, getProfile);

router.get(
  "/admin-dashboard",
  protect,
  authorize("admin"),
  getAdminDashboard
);

module.exports = router;