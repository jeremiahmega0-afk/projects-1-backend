const express = require("express");
const router = express.Router();

const protect = require("../middleware/auth.middleware");
const authorize = require("../middleware/role.middleware");

const {
  moderateComment,
} = require("../controllers/commentModeration.controller");

// Admin can hide or restore comments
router.patch(
  "/:commentId",
  protect,
  authorize("admin"),
  moderateComment
);

module.exports = router;