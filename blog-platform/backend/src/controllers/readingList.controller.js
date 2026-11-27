
const mongoose = require("mongoose");

const ReadingList = require("../models/readingList.model");
const Article = require("../models/article.model");

// @desc    Create a reading list
// @route   POST /api/v1/reading-lists
// @access  Private
const createReadingList = async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Reading list name is required",
      });
    }

    const trimmedName = name.trim();

    if (trimmedName.length > 100) {
      return res.status(400).json({
        success: false,
        message: "Reading list name cannot exceed 100 characters",
      });
    }

    if (
      description !== undefined &&
      (typeof description !== "string" || description.length > 500)
    ) {
      return res.status(400).json({
        success: false,
        message: "Description must be text and cannot exceed 500 characters",
      });
    }

    const existingList = await ReadingList.findOne({
      user: req.user.id,
      name: trimmedName,
    }).collation({
      locale: "en",
      strength: 2,
    });

    if (existingList) {
      return res.status(409).json({
        success: false,
        message: "A reading list with this name already exists",
      });
    }

    const readingList = await ReadingList.create({
      user: req.user.id,
      name: trimmedName,
      description: description?.trim() || "",
    });

    return res.status(201).json({
      success: true,
      message: "Reading list created successfully",
      readingList,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "A reading list with this name already exists",
      });
    }

    console.error("Create reading list error:", error);

    return res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};

// @desc    Get all reading lists belonging to the logged-in user
// @route   GET /api/v1/reading-lists
// @access  Private
const getMyReadingLists = async (req, res) => {
  try {
    const readingLists = await ReadingList.find({
      user: req.user.id,
    })
      .populate({
        path: "articles",
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

    return res.status(200).json({
      success: true,
      total: readingLists.length,
      readingLists,
    });
  } catch (error) {
    console.error("Get reading lists error:", error);

    return res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};

// @desc    Get one reading list
// @route   GET /api/v1/reading-lists/:listId
// @access  Private
const getReadingListById = async (req, res) => {
  try {
    const { listId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(listId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid reading list ID",
      });
    }

    const readingList = await ReadingList.findOne({
      _id: listId,
      user: req.user.id,
    }).populate({
      path: "articles",
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
    });

    if (!readingList) {
      return res.status(404).json({
        success: false,
        message: "Reading list not found",
      });
    }

    return res.status(200).json({
      success: true,
      readingList,
    });
  } catch (error) {
    console.error("Get reading list error:", error);

    return res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};

// @desc    Rename or update a reading list
// @route   PATCH /api/v1/reading-lists/:listId
// @access  Private
const updateReadingList = async (req, res) => {
  try {
    const { listId } = req.params;
    const { name, description } = req.body;

    if (!mongoose.Types.ObjectId.isValid(listId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid reading list ID",
      });
    }

    if (name === undefined && description === undefined) {
      return res.status(400).json({
        success: false,
        message: "Provide a name or description to update",
      });
    }

    const updates = {};

    if (name !== undefined) {
      if (typeof name !== "string" || !name.trim()) {
        return res.status(400).json({
          success: false,
          message: "Reading list name cannot be empty",
        });
      }

      if (name.trim().length > 100) {
        return res.status(400).json({
          success: false,
          message: "Reading list name cannot exceed 100 characters",
        });
      }

      updates.name = name.trim();
    }

    if (description !== undefined) {
      if (
        typeof description !== "string" ||
        description.length > 500
      ) {
        return res.status(400).json({
          success: false,
          message: "Description must be text and cannot exceed 500 characters",
        });
      }

      updates.description = description.trim();
    }

    const readingList = await ReadingList.findOneAndUpdate(
      {
        _id: listId,
        user: req.user.id,
      },
      {
        $set: updates,
      },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!readingList) {
      return res.status(404).json({
        success: false,
        message: "Reading list not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Reading list updated successfully",
      readingList,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "A reading list with this name already exists",
      });
    }

    console.error("Update reading list error:", error);

    return res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};

// @desc    Delete a reading list
// @route   DELETE /api/v1/reading-lists/:listId
// @access  Private
const deleteReadingList = async (req, res) => {
  try {
    const { listId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(listId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid reading list ID",
      });
    }

    const readingList = await ReadingList.findOneAndDelete({
      _id: listId,
      user: req.user.id,
    });

    if (!readingList) {
      return res.status(404).json({
        success: false,
        message: "Reading list not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Reading list deleted successfully",
    });
  } catch (error) {
    console.error("Delete reading list error:", error);

    return res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};

// @desc    Add an article to a reading list
// @route   POST /api/v1/reading-lists/:listId/articles/:articleId
// @access  Private
const addArticleToReadingList = async (req, res) => {
  try {
    const { listId, articleId } = req.params;

    if (
      !mongoose.Types.ObjectId.isValid(listId) ||
      !mongoose.Types.ObjectId.isValid(articleId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid reading list or article ID",
      });
    }

    const readingList = await ReadingList.findOne({
      _id: listId,
      user: req.user.id,
    });

    if (!readingList) {
      return res.status(404).json({
        success: false,
        message: "Reading list not found",
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

    if (
      readingList.articles.some(
        (id) => id.toString() === articleId
      )
    ) {
      return res.status(409).json({
        success: false,
        message: "Article is already in this reading list",
      });
    }

    readingList.articles.push(articleId);
    await readingList.save();

    return res.status(200).json({
      success: true,
      message: "Article added to reading list successfully",
      readingList,
    });
  } catch (error) {
    console.error("Add article to reading list error:", error);

    return res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};

// @desc    Remove an article from a reading list
// @route   DELETE /api/v1/reading-lists/:listId/articles/:articleId
// @access  Private
const removeArticleFromReadingList = async (req, res) => {
  try {
    const { listId, articleId } = req.params;

    if (
      !mongoose.Types.ObjectId.isValid(listId) ||
      !mongoose.Types.ObjectId.isValid(articleId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid reading list or article ID",
      });
    }

    const readingList = await ReadingList.findOneAndUpdate(
      {
        _id: listId,
        user: req.user.id,
        articles: articleId,
      },
      {
        $pull: {
          articles: articleId,
        },
      },
      {
        new: true,
      }
    );

    if (!readingList) {
      return res.status(404).json({
        success: false,
        message: "Reading list or article not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Article removed from reading list successfully",
      readingList,
    });
  } catch (error) {
    console.error("Remove article from reading list error:", error);

    return res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};

module.exports = {
  createReadingList,
  getMyReadingLists,
  getReadingListById,
  updateReadingList,
  deleteReadingList,
  addArticleToReadingList,
  removeArticleFromReadingList,
};
