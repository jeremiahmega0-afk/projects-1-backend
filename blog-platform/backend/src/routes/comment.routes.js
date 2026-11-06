
const express = require("express");
const multer = require("multer");

const protect = require("../middleware/auth.middleware");
const authorize = require("../middleware/role.middleware");
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
  getAllComments,
} = require("../controllers/comment.controller");
const audioUpload = require("../uploads/audioUpload");
const validateAudioFile = audioUpload.validateAudioFile;
const Comment = require("../models/comment.model");
const Article = require("../models/article.model");
const mongoose = require("mongoose");
const uploadMedia = require("../utils/uploadMedia");
const cloudinary = require("../config/cloudinary");

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
const handleAudioUpload = (req, res, next) => {
  audioUpload.single("audio")(req, res, (error) => {
    if (error) {
      if (error instanceof multer.MulterError) {
        const message =
          error.code === "LIMIT_FILE_SIZE"
            ? "Audio file must not exceed 10MB"
            : "Audio upload failed";

        return res.status(400).json({
          success: false,
          message,
        });
      }

      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    next();
  });
};
router.post(
  "/:articleId/audio",
  protect,
  handleAudioUpload,
  validateAudioFile,
  async (req, res) => {
    let uploadedAudio;

    try {
      const { articleId } = req.params;

      // Check article ID
      if (!mongoose.Types.ObjectId.isValid(articleId)) {
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
        return res.status(404).json({
          success: false,
          message: "Published article not found",
        });
      }

      uploadedAudio = await uploadMedia(
        req.file.buffer,
        "video",
        "blog-platform/audio-comments"
      );

      const comment = await Comment.create({
        type: "audio",
        audioUrl: uploadedAudio.url,
        audioPublicId: uploadedAudio.publicId,
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

      if (uploadedAudio) {
        try {
          await cloudinary.uploader.destroy(
            uploadedAudio.publicId,
            { resource_type: "video" }
          );
        } catch (cleanupError) {
          console.error("Failed to remove orphaned audio upload:", cleanupError);
        }
      }

      return res.status(500).json({
        success: false,
        message: "Failed to create audio comment",
      });
    }
  }
);
// Admin: Retrieve all comments
router.get(
  "/admin/all",
  protect,
  authorize("admin"),
  getAllComments
);

module.exports = router;
