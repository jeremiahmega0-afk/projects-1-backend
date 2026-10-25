
const Comment = require("../models/comment.model");
const Article = require("../models/article.model");
const {
  createCommentSchema,
  updateCommentSchema,
} = require("../validations/comment.validation");
const createComment = async (req, res, next) => {
  try {
    // 1. Check whether the comment content is valid
    const validation = createCommentSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: validation.error.issues[0].message,
      });
    }

    // 2. Find the article the user wants to comment on
    const article = await Article.findById(req.params.articleId);

    if (!article) {
      return res.status(404).json({
        success: false,
        message: "Article not found",
      });
    }

    // 3. Only allow comments on published articles
    if (article.status !== "published") {
      return res.status(403).json({
        success: false,
        message: "You can only comment on published articles",
      });
    }

    // 4. Save the comment
    const comment = await Comment.create({
      content: validation.data.content,
      author: req.user.id,
      article: article._id,
    });

    // 5. Send the result back
    return res.status(201).json({
      success: true,
      message: "Comment created successfully",
      comment,
    });
  } catch (error) {
    next(error);
  }
};

const getComments = async (req, res, next) => {
  try {
    // 1. Find the article
    const article = await Article.findById(req.params.articleId);

    if (!article) {
      return res.status(404).json({
        success: false,
        message: "Article not found",
      });
    }

    // 2. Only show comments for published articles
    if (article.status !== "published") {
      return res.status(404).json({
        success: false,
        message: "Article not found",
      });
    }

    // 3. Find the comments and their public author information
    const comments = await Comment.find({
      article: article._id,
    })
      .populate("author", "name avatar")
      .sort({ createdAt: -1 });

    // 4. Return the comments
    return res.status(200).json({
      success: true,
      count: comments.length,
      comments,
    });
  } catch (error) {
    next(error);
  }
}
const updateComment = async (req, res, next) => {
  try {
    // 1. Check that the new comment content is valid
    const validation = updateCommentSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: validation.error.issues[0].message,
      });
    }

    // 2. Find the comment
    const comment = await Comment.findById(req.params.commentId);

    if (!comment) {
      return res.status(404).json({
        success: false,
        message: "Comment not found",
      });
    }

    // 3. Check that the logged-in user owns the comment
    if (comment.author.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "You can only update your own comments",
      });
    }

    // 4. Update the comment content
    comment.content = validation.data.content;

    await comment.save();

    // 5. Return the updated comment
    return res.status(200).json({
      success: true,
      message: "Comment updated successfully",
      comment,
    });
  } catch (error) {
    next(error);
  }
};


module.exports = {
  createComment,
    getComments,
    updateComment,
};
