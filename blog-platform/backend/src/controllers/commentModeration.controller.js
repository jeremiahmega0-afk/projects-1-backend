const mongoose = require("mongoose");
const Comment = require("../models/comment.model");

// Hide or restore a comment
const moderateComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    const { status } = req.body;

    // Check comment ID
    if (!mongoose.Types.ObjectId.isValid(commentId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid comment ID",
      });
    }

    // Only allow these moderation statuses
    const allowedStatuses = ["hidden", "approved"];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status must be hidden or approved",
      });
    }

    // Find the comment
    const comment = await Comment.findById(commentId);

    if (!comment) {
      return res.status(404).json({
        success: false,
        message: "Comment not found",
      });
    }

    // Update comment
    comment.status = status;
    comment.moderatedBy = req.user.id;
    comment.moderatedAt = new Date();

    await comment.save();

    return res.status(200).json({
      success: true,
      message:
        status === "hidden"
          ? "Comment hidden successfully"
          : "Comment restored successfully",
      comment,
    });
  } catch (error) {
    console.error("Comment moderation error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while moderating comment",
    });
  }
};

module.exports = {
  moderateComment,
};