
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

    // Prevent reporting hidden or rejected comments
    if (comment.status !== "approved") {
      return res.status(403).json({
        success: false,
        message: "You cannot report a hidden or rejected comment",
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


const getAllCommentReports = async (req, res) => {
  try {
    const reports = await CommentReport.find()
      .populate("comment")
      .populate("reportedBy", "name email")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      totalReports: reports.length,
      reports,
    });
  } catch (error) {
    console.error("Get comment reports error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve comment reports",
    });
  }
};


const updateCommentReportStatus = async (req, res) => {
  try {
    const { reportId } = req.params;
    const { status } = req.body;

    // Check report ID
    if (!mongoose.Types.ObjectId.isValid(reportId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid report ID",
      });
    }

    // Check allowed statuses
    const allowedStatuses = [
      "reviewed",
      "dismissed",
      "action_taken",
    ];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid report status",
      });
    }

    // Find and update report
    const report = await CommentReport.findByIdAndUpdate(
      reportId,
      { status },
      { new: true, runValidators: true }
    );

    if (!report) {
      return res.status(404).json({
        success: false,
        message: "Comment report not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Report status updated successfully",
      report,
    });

  } catch (error) {
    console.error("Update report status error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update report status",
    });
  }
};

module.exports = {
  createCommentReport,
  getAllCommentReports,
  updateCommentReportStatus,
};
