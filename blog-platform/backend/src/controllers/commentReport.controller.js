
const mongoose = require("mongoose");
const Comment = require("../models/comment.model");
const CommentReport = require("../models/commentReport.model");

const createCommentReport = async (req, res) => {
  try {
    const { commentId } = req.params;
    const { reason, description } = req.body;

    // 1. Check whether the comment ID is valid
    if (!mongoose.Types.ObjectId.isValid(commentId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid comment ID",
      });
    }

    // 2. Check whether the comment exists
    const comment = await Comment.findById(commentId);

    if (!comment) {
      return res.status(404).json({
        success: false,
        message: "Comment not found",
      });
    }

    // 3. Prevent users from reporting their own comments
    if (comment.author.toString() === req.user.id) {
      return res.status(400).json({
        success: false,
        message: "You cannot report your own comment",
      });
    }

    // 4. Check whether this user has already reported this comment
    const existingReport = await CommentReport.findOne({
      comment: commentId,
      reportedBy: req.user.id,
    });

    if (existingReport) {
      return res.status(409).json({
        success: false,
        message: "You have already reported this comment",
      });
    }

    // 5. Save the report in MongoDB
    const report = await CommentReport.create({
      comment: commentId,
      reportedBy: req.user.id,
      reason,
      description,
    });

    return res.status(201).json({
      success: true,
      message: "Comment reported successfully",
      report,
    });

  } catch (error) {
    // Handle duplicate reports caused by simultaneous requests
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "You have already reported this comment",
      });
    }

    console.error("Comment report error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to report comment",
    });
  }
};

module.exports = {
  createCommentReport,
};
