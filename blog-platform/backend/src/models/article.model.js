const mongoose = require("mongoose");

const articleSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },

    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },

    content: {
      type: String,
      required: true,
    },

    coverImage: {
      type: String,
      default: "",
    },

    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      default: null,
    },


    status: {
      type: String,
      enum: ["draft", "pending", "published", "rejected"],
      default: "draft",
    },


    publishedAt: {
      type: Date,
      default: null,
    },

    views: {
      type: Number,
      default: 0,
      min: 0,
    },

    likes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    reactions: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },

        type: {
          type: String,
          enum: ["love", "laugh", "wow", "sad"],
          required: true,
        },
      },
    ],

  },
  {
    timestamps: true,
  }
);

const Article = mongoose.model("Article", articleSchema);

module.exports = Article;