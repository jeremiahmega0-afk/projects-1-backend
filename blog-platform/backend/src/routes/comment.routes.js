
const express = require("express");
const upload = require("../middleware/upload.middleware");
const protect = require("../middleware/auth.middleware");

const {
  createComment,
  getComments,
  updateComment,
  uploadCommentMedia,
} = require("../controllers/comment.controller");


const router = express.Router();

// Only logged-in users can comment
router.post(
  "/:articleId",
  protect,
  createComment
);
router.get("/:articleId", getComments);

router.patch("/:commentId", protect, updateComment);

router.post(
  "/:articleId/media",
  protect,
  upload.single("file"),
  uploadCommentMedia
);
module.exports = router;
