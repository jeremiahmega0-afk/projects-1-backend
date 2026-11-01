
const mongoose = require("mongoose");
const Comment = require("../models/comment.model");
const Article = require("../models/article.model");

const createComment = async (req, res) => {
  try {
    const { type, content } = req.body;

    // Check the article ID
    const { articleId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(articleId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid article ID",
      });
    }

    // Check whether the article exists and is published
    const article = await Article.findOne({
      _id: articleId,
      status: "published",
    });

    if (!article) {
      return res.status(404).json({
        success: false,
        message: "Published article not found",
      });
    }

    // Create the comment
    const comment = await Comment.create({
      type,
      content,
      author: req.user.id,
      article: articleId,
    });

    return res.status(201).json({
      success: true,
      message: "Comment created successfully",
      comment,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};

const getArticleComments = async (req, res) => {
  try {
    const { articleId } = req.params;

    // Check whether the article ID is valid
    if (!mongoose.Types.ObjectId.isValid(articleId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid article ID",
      });
    }

    // Find comments belonging to this article
    const comments = await Comment.find({
      article: articleId,
    })
      .populate("author", "name")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      message: "Comments retrieved successfully",
      totalComments: comments.length,
      comments,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};

module.exports = {
  createComment,
  getArticleComments,
};


