
const express = require("express");

const protect = require("../middleware/auth.middleware");

const {
  addBookmark,
  removeBookmark,
  getMyBookmarks,
} = require("../controllers/bookmark.controller");

const router = express.Router();

// Get all bookmarks belonging to the logged-in user
router.get("/", protect, getMyBookmarks);

// Bookmark an article
router.post("/:articleId", protect, addBookmark);

// Remove a bookmark
router.delete("/:articleId", protect, removeBookmark);

module.exports = router;
