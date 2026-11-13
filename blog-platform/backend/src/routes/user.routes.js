const express = require("express");

const protect = require("../middleware/auth.middleware");
const authorize = require("../middleware/role.middleware");
const profileImageUpload = require("../uploads/profileImageUpload");
const validateProfileImage = require("../middleware/profileImageValidation.middleware");

const {
  getProfile,
  updateProfile,
  getAdminDashboard,
  getPublicProfile,
  getPublicProfileByUsername,
  uploadProfilePicture,
} = require("../controllers/user.controller");

const router = express.Router();

router.get("/profile", protect, getProfile);

router.patch(
  "/profile/avatar",
  protect,
  profileImageUpload.single("avatar"),
  validateProfileImage,
  uploadProfilePicture
);

router.patch("/profile", protect, updateProfile);
router.get("/username/:username", getPublicProfileByUsername);
router.get("/:id", getPublicProfile);
router.get(
  "/admin-dashboard",
  protect,
  authorize("admin"),
  getAdminDashboard
);

module.exports = router;