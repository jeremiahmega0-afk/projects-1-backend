
const mongoose = require("mongoose");

const commentSchema = new mongoose.Schema(
  {
    content: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: "",
    },

    type: {
      type: String,
      enum: ["text", "image", "audio", "sticker", "mixed"],
      default: "text",
    },

    imageUrl: {
      type: String,
      default: "",
    },

    audioUrl: {
      type: String,
      default: "",
    },

    sticker: {
      type: String,
      default: "",
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
  },
  {
    timestamps: true,
  }
);

commentSchema.pre("validate", function () {
  const hasContent = Boolean(this.content?.trim());
  const hasImage = Boolean(this.imageUrl);
  const hasAudio = Boolean(this.audioUrl);
  const hasSticker = Boolean(this.sticker);

  if (!hasContent && !hasImage && !hasAudio && !hasSticker) {
    this.invalidate(
      "content",
      "A comment must contain text, an image, audio, or a sticker"
    );
  }

  const attachmentCount = [hasImage, hasAudio, hasSticker].filter(Boolean).length;

  if (attachmentCount > 1) {
    this.invalidate(
      "type",
      "Only one attachment type is allowed per comment"
    );
  }

  if (attachmentCount === 1 && hasContent) {
    this.type = "mixed";
  } else if (hasImage) {
    this.type = "image";
  } else if (hasAudio) {
    this.type = "audio";
  } else if (hasSticker) {
    this.type = "sticker";
  } else {
    this.type = "text";
  }
});

const Comment = mongoose.model("Comment", commentSchema);

module.exports = Comment;

