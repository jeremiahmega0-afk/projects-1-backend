
const mongoose = require("mongoose");

const commentReportSchema = new mongoose.Schema(
  {
    comment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Comment",
      required: true,
    },

    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    reason: {
      type: String,
      enum: [
        "spam",
        "harassment",
        "hate_speech",
        "inappropriate_content",
        "misinformation",
        "other",
      ],
      required: true,
    },

    description: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },

    status: {
      type: String,
      enum: ["pending", "reviewed", "dismissed", "action_taken"],
      default: "pending",
    },
  },
  {
    timestamps: true,
  }
);

// A user can report a particular comment only once.
commentReportSchema.index(
  { comment: 1, reportedBy: 1 },
  { unique: true }
);

module.exports = mongoose.model(
  "CommentReport",
  commentReportSchema
);
