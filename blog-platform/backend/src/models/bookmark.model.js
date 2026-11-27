
const mongoose = require("mongoose");

const bookmarkSchema = new mongoose.Schema(
  {
    user: {
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

// A user can bookmark an article only once.
bookmarkSchema.index(
  {
    user: 1,
    article: 1,
  },
  {
    unique: true,
    name: "unique_user_article_bookmark",
  }
);

// Efficiently retrieve a user's bookmarks, newest first.
bookmarkSchema.index(
  {
    user: 1,
    createdAt: -1,
  },
  {
    name: "user_bookmarks_createdAt",
  }
);

const Bookmark = mongoose.model("Bookmark", bookmarkSchema);

module.exports = Bookmark;
