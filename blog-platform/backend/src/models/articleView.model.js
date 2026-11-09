const mongoose = require("mongoose");

const articleViewSchema = new mongoose.Schema(
  {
    article: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Article",
      required: true,
    },

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Prevent duplicate views from the same logged-in user.
articleViewSchema.index(
  { article: 1, user: 1 },
  {
    unique: true,
    partialFilterExpression: {
      user: { $type: "objectId" },
    },
    name: "article_1_user_1",
  }
);

const ArticleView = mongoose.model("ArticleView", articleViewSchema);

module.exports = ArticleView;