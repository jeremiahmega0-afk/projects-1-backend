
const express = require("express");

const router = express.Router();

const  protect  = require("../middleware/auth.middleware");
const authorize = require("../middleware/role.middleware");
const validate = require("../middleware/validate.middleware");

const {
  createCommentReport,
  getAllCommentReports,
  updateCommentReportStatus,
} = require("../controllers/commentReport.controller");

const {
  createCommentReportSchema,
} = require("../validations/commentReport.validation");

// Ordinary authenticated users can report comments
router.post(
  "/:commentId",
  protect,
  validate(createCommentReportSchema),
  createCommentReport
);

// Only administrators can view all reports
router.get(
  "/",
  protect,
  authorize("admin"),
  getAllCommentReports
);

// Only administrators can update report status
router.patch(
  "/:reportId",
  protect,
  authorize("admin"),
  updateCommentReportStatus
);
module.exports = router;

