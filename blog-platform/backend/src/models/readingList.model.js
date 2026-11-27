
const mongoose = require("mongoose");

const readingListSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    description: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
    },

    articles: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Article",
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Prevent a user from creating multiple lists with the same name.
readingListSchema.index(
  {
    user: 1,
    name: 1,
  },
  {
    unique: true,
    name: "unique_user_reading_list_name",
    collation: {
      locale: "en",
      strength: 2,
    },
  }
);

// Retrieve a user's reading lists efficiently.
readingListSchema.index(
  {
    user: 1,
    createdAt: -1,
  },
  {
    name: "user_reading_lists_createdAt",
  }
);

const ReadingList = mongoose.model(
  "ReadingList",
  readingListSchema
);

module.exports = ReadingList;
