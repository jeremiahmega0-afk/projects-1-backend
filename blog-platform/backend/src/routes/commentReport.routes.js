
const express = require("express");

const router = express.Router();

const protect = require("../middleware/auth.middleware");

const validate = require("../middleware/validate.middleware");

const {
  createCommentReport,
} = require("../controllers/commentReport.controller");

const {
  createCommentReportSchema,
} = require("../validations/commentReport.validation");

// Report a comment
router.post(
  "/:commentId",
  protect,
  validate(createCommentReportSchema),
  createCommentReport
);

module.exports = router;
