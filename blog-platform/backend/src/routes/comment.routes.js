
const express = require("express");

const protect = require("../middleware/auth.middleware");
const validate = require("../middleware/validate.middleware");
const {
  createCommentSchema,
  updateCommentSchema,
} = require("../validations/comment.validation");
const {
  createComment,
  getArticleComments,
  toggleCommentLike,
  editComment,
  deleteComment,
} = require("../controllers/comment.controller");
const audioUpload = require("../uploads/audioUpload");
const Comment = require("../models/comment.model");
const Article = require("../models/article.model");
const mongoose = require("mongoose");
const fs = require("fs");

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
// Like or unlike a comment
router.post(
  "/:commentId/like",
  protect,
  toggleCommentLike
);
router.put(
  "/:commentId",
  protect,
  validate(updateCommentSchema),
  editComment
);
router.delete(
  "/:commentId",
  protect,
  deleteComment
);
router.post(
  "/:articleId/audio",
  protect,
  audioUpload.single("audio"),
  async (req, res) => {
    try {
      const { articleId } = req.params;

      // Check article ID
      if (!mongoose.Types.ObjectId.isValid(articleId)) {
        if (req.file) {
          await fs.promises.unlink(req.file.path);
        }

        return res.status(400).json({
          success: false,
          message: "Invalid article ID",
        });
      }

      // Check uploaded file
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "Please upload an audio file",
        });
      }

      // Check audio duration
      const duration = Number(req.body.audioDuration);

      if (
        !Number.isInteger(duration) ||
        duration < 1 ||
        duration > 300
      ) {
        await fs.promises.unlink(req.file.path);

        return res.status(400).json({
          success: false,
          message: "Audio duration must be between 1 and 300 seconds",
        });
      }

      // Check whether article exists and is published
      const article = await Article.findOne({
        _id: articleId,
        status: "published",
      });

      if (!article) {
        await fs.promises.unlink(req.file.path);

        return res.status(404).json({
          success: false,
          message: "Published article not found",
        });
      }

      // Generate audio URL
      const audioUrl = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;

      // Save audio comment in MongoDB
      const comment = await Comment.create({
        type: "audio",
        audioUrl,
        audioDuration: duration,
        author: req.user.id,
        article: articleId,
      });

      return res.status(201).json({
        success: true,
        message: "Audio comment created successfully",
        comment,
      });

    } catch (error) {
      console.error("Audio comment error:", error);

      if (req.file) {
        await fs.promises.unlink(req.file.path).catch(() => {});
      }

      return res.status(500).json({
        success: false,
        message: "Failed to create audio comment",
      });
    }
  }
);
module.exports = router;
