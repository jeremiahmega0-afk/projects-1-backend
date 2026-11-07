
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
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// A user can view an article only once for counting purposes.
articleViewSchema.index(
  { article: 1, user: 1 },
  { unique: true }
);

const ArticleView = mongoose.model("ArticleView", articleViewSchema);

module.exports = ArticleView;
