
const mongoose = require("mongoose");
const Bookmark = require("../models/bookmark.model");
const Article = require("../models/article.model");

// @desc    Bookmark an article
// @route   POST /api/v1/bookmarks/:articleId
// @access  Private
const addBookmark = async (req, res) => {
  try {
    const { articleId } = req.params;
    const userId = req.user.id;

    if (!mongoose.Types.ObjectId.isValid(articleId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid article ID",
      });
    }

    const article = await Article.findOne({
      _id: articleId,
      status: "published",
      isDeleted: { $ne: true },
    });

    if (!article) {
      return res.status(404).json({
        success: false,
        message: "Published article not found",
      });
    }

    const existingBookmark = await Bookmark.findOne({
      user: userId,
      article: articleId,
    });

    if (existingBookmark) {
      return res.status(409).json({
        success: false,
        message: "Article is already bookmarked",
      });
    }

    const bookmark = await Bookmark.create({
      user: userId,
      article: articleId,
    });

    return res.status(201).json({
      success: true,
      message: "Article bookmarked successfully",
      bookmark,
    });
  } catch (error) {
    // Handle duplicate bookmark attempts safely.
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Article is already bookmarked",
      });
    }

    console.error("Add bookmark error:", error);

    return res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};

// @desc    Remove a bookmark
// @route   DELETE /api/v1/bookmarks/:articleId
// @access  Private
const removeBookmark = async (req, res) => {
  try {
    const { articleId } = req.params;
    const userId = req.user.id;

    if (!mongoose.Types.ObjectId.isValid(articleId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid article ID",
      });
    }

    const bookmark = await Bookmark.findOneAndDelete({
      user: userId,
      article: articleId,
    });

    if (!bookmark) {
      return res.status(404).json({
        success: false,
        message: "Bookmark not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Bookmark removed successfully",
    });
  } catch (error) {
    console.error("Remove bookmark error:", error);

    return res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};

// @desc    Get all bookmarks belonging to the logged-in user
// @route   GET /api/v1/bookmarks
// @access  Private
const getMyBookmarks = async (req, res) => {
  try {
    const bookmarks = await Bookmark.find({
      user: req.user.id,
    })
      .populate({
        path: "article",
        match: {
          status: "published",
          isDeleted: { $ne: true },
        },
        populate: [
          {
            path: "author",
            select: "name username avatar",
          },
          {
            path: "category",
            select: "name slug",
          },
        ],
      })
      .sort({ createdAt: -1 });

    // Exclude bookmarks whose articles are no longer available.
    const availableBookmarks = bookmarks.filter(
      (bookmark) => bookmark.article !== null
    );

    return res.status(200).json({
      success: true,
      total: availableBookmarks.length,
      bookmarks: availableBookmarks,
    });
  } catch (error) {
    console.error("Get bookmarks error:", error);

    return res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};

module.exports = {
  addBookmark,
  removeBookmark,
  getMyBookmarks,
};
