
const express = require("express");

const protect = require("../middleware/auth.middleware");
const validate = require("../middleware/validate.middleware");

const {
  createCommentSchema,
} = require("../validations/comment.validation");
const {
  createComment,
  getArticleComments,
} = require("../controllers/comment.controller");

const router = express.Router();

// Create a comment on an article
router.post(
  "/:articleId",
  protect,
  validate(createCommentSchema),
  createComment
);
// Get approved comments for an article
router.get(
  "/:articleId",
  getArticleComments
);
module.exports = router;

