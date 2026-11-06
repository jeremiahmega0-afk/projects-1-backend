
const mongoose = require("mongoose");

const commentSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["text", "sticker", "audio"],
      required: true,
      default: "text",
    },

    content: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
    },

    stickerUrl: {
      type: String,
      trim: true,
      default: "",
    },

    audioUrl: {
      type: String,
      trim: true,
      default: "",
    },

    audioPublicId: {
      type: String,
      trim: true,
      default: "",
    },

    audioDuration: {
      type: Number,
      min: 1,
      max: 300,
      default: null,
    },

    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    article: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Article",
      required: true,
    },

    parentComment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Comment",
      default: null,
    },

    likes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    status: {
      type: String,
      enum: ["approved", "rejected", "hidden"],
      default: "approved",
    },

    moderatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    moderatedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Make sure each comment has the correct content for its type.
commentSchema.pre("validate", function () {
  if (this.type === "text") {
    if (!this.content || this.content.trim().length < 2) {
      this.invalidate("content", "Text comments must contain at least 2 characters");
    }
  }

  if (this.type === "sticker") {
    if (!this.stickerUrl) {
      this.invalidate("stickerUrl", "A sticker URL is required");
    }
  }

  if (this.type === "audio") {
    if (!this.audioUrl) {
      this.invalidate("audioUrl", "An audio URL is required");
    }

    if (!this.audioDuration || this.audioDuration < 1) {
      this.invalidate("audioDuration", "Audio duration must be at least 1 second");
    }
  }
});

const Comment = mongoose.model("Comment", commentSchema);

module.exports = Comment;


