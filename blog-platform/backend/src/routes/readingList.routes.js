
const express = require("express");

const protect = require("../middleware/auth.middleware");

const {
  createReadingList,
  getMyReadingLists,
  getReadingListById,
  updateReadingList,
  deleteReadingList,
  addArticleToReadingList,
  removeArticleFromReadingList,
} = require("../controllers/readingList.controller");

const router = express.Router();

// Create a reading list
router.post("/", protect, createReadingList);

// Get all the user's reading lists
router.get("/", protect, getMyReadingLists);

// Get one reading list
router.get("/:listId", protect, getReadingListById);

// Update or rename a reading list
router.patch("/:listId", protect, updateReadingList);

// Delete a reading list
router.delete("/:listId", protect, deleteReadingList);

// Add an article to a reading list
router.post(
  "/:listId/articles/:articleId",
  protect,
  addArticleToReadingList
);

// Remove an article from a reading list
router.delete(
  "/:listId/articles/:articleId",
  protect,
  removeArticleFromReadingList
);

module.exports = router;
