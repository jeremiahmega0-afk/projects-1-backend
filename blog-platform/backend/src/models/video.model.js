
const mongoose = require("mongoose");

const videoSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },

    description: {
      type: String,
      default: "",
      maxlength: 2000,
    },

    videoUrl: {
      type: String,
      required: true,
      trim: true,
    },

    videoPublicId: {
      type: String,
      default: "",
    },

    videoType: {
      type: String,
      enum: ["youtube", "upload"],
      required: true,
    },

    thumbnail: {
      type: String,
      default: "",
    },

    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      default: null,
    },

    tags: {
      type: [String],
      default: [],
    },

    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    status: {
      type: String,
      enum: ["draft", "published"],
      default: "draft",
    },

    views: {
      type: Number,
      default: 0,
      min: 0,
    },

    publishedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const Video = mongoose.model("Video", videoSchema);

module.exports = Video;
