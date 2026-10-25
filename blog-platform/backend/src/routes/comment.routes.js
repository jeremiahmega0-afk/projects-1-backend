
const express = require("express");

const protect = require("../middleware/auth.middleware");
const { 
    createComment,
     getComments,
      updateComment, 
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
module.exports = router;
