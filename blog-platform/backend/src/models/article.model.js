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

    coverImagePublicId: {
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

    tags: {
      type: [String],
      default: [],
      lowercase: true,
      trim: true,
    },
    metaTitle: {
      type: String,
      default: "",
      trim: true,
      maxlength: 60,
    },

    metaDescription: {
      type: String,
      default: "",
      trim: true,
      maxlength: 160,
    },

    canonicalUrl: {
      type: String,
      default: "",
      trim: true,
      maxlength: 2048,
    },

    ogTitle: {
      type: String,
      default: "",
      trim: true,
      maxlength: 95,
    },

    ogDescription: {
      type: String,
      default: "",
      trim: true,
      maxlength: 200,
    },

    ogImage: {
      type: String,
      default: "",
      trim: true,
      maxlength: 2048,
    },

    status: {
      type: String,
      enum: ["draft", "pending", "published", "rejected", "scheduled"],
      default: "draft",
    },

    publishedAt: {
      type: Date,
      default: null,
    },

    scheduledAt: {
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

articleSchema.index(
  {
    status: 1,
    createdAt: -1,
  },
  {
    name: "article_status_createdAt",
  }
);

articleSchema.index(
  {
    title: "text",
    content: "text",
    tags: "text",
  },
  {
    weights: {
      title: 10,
      tags: 5,
      content: 1,
    },
    name: "article_text_search",
  }
);

const Article = mongoose.model("Article", articleSchema);

module.exports = Article;