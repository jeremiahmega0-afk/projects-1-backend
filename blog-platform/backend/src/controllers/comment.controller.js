
const mongoose = require("mongoose");
const Comment = require("../models/comment.model");
const Article = require("../models/article.model");
const { updateCommentSchema } = require("../validations/comment.validation");

const createComment = async (req, res) => {
  try {
    const {
      type,
      content,
      stickerUrl,
      audioUrl,
      audioDuration,
      parentComment,
    } = req.body;

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

    // If this is a reply, check that the parent comment exists
    if (parentComment) {
      const parent = await Comment.findOne({
        _id: parentComment,
        article: articleId,
      });

      if (!parent) {
        return res.status(404).json({
          success: false,
          message: "Parent comment not found for this article",
        });
      }
    }

    // Create the comment or reply
    const comment = await Comment.create({
  type,
  content,
  stickerUrl,
  audioUrl,
  audioDuration,
  author: req.user.id,
  article: articleId,
  parentComment: parentComment || null,
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
      parentComment: null,
    })
      .populate("author", "name")
      .sort({ createdAt: -1 });



    const commentsWithReplies = await Promise.all(
      comments.map(async (comment) => {
        const replies = await Comment.find({
          parentComment: comment._id,
        })
          .populate("author", "name")
          .sort({ createdAt: 1 });

        const repliesWithLikes = replies.map((reply) => ({
          ...reply.toObject(),
          totalLikes: reply.likes.length,
        }));

        return {
          ...comment.toObject(),
          totalLikes: comment.likes.length,
          replies: repliesWithLikes,
        };
      })
    );

    return res.status(200).json({
      success: true,
      message: "Comments retrieved successfully",
      totalComments: comments.length,
      comments: commentsWithReplies,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};

const toggleCommentLike = async (req, res) => {
  try {
    const { commentId } = req.params;
    const userId = req.user.id;

    // Check whether the comment ID is valid
    if (!mongoose.Types.ObjectId.isValid(commentId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid comment ID",
      });
    }

    // Find the comment
    const comment = await Comment.findById(commentId);

    if (!comment) {
      return res.status(404).json({
        success: false,
        message: "Comment not found",
      });
    }

    // Check whether the user has already liked the comment
    const alreadyLiked = comment.likes.some(
      (id) => id.toString() === userId.toString()
    );

    if (alreadyLiked) {
      // Remove the user's like
      comment.likes.pull(userId);
    } else {
      // Add the user's like
      comment.likes.addToSet(userId);
    }

    await comment.save();

    return res.status(200).json({
      success: true,
      message: alreadyLiked
        ? "Comment unliked successfully"
        : "Comment liked successfully",
      totalLikes: comment.likes.length,
      liked: !alreadyLiked,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};
const editComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    const { content } = req.body;
    const userId = req.user.id;

    // Check whether the comment ID is valid
    if (!mongoose.Types.ObjectId.isValid(commentId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid comment ID",
      });
    }

    // Find the comment
    const comment = await Comment.findById(commentId);

    if (!comment) {
      return res.status(404).json({
        success: false,
        message: "Comment not found",
      });
    }

    // Check whether the logged-in user owns this comment
    if (comment.author.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: "You can only edit your own comments",
      });
    }

    // Only text comments can be edited this way
    if (comment.type !== "text") {
      return res.status(400).json({
        success: false,
        message: "Only text comments can be edited with this endpoint",
      });
    }

    comment.content = content;

    await comment.save();

    return res.status(200).json({
      success: true,
      message: "Comment updated successfully",
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
const deleteComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    const userId = req.user.id;

    // Check whether the comment ID is valid
    if (!mongoose.Types.ObjectId.isValid(commentId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid comment ID",
      });
    }

    // Find the comment
    const comment = await Comment.findById(commentId);

    if (!comment) {
      return res.status(404).json({
        success: false,
        message: "Comment not found",
      });
    }

    // Check whether the logged-in user owns the comment
    if (comment.author.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: "You can only delete your own comments",
      });
    }

    // Delete all replies belonging to this comment
    await Comment.deleteMany({
      parentComment: comment._id,
    });

    // Delete the actual comment
    await Comment.findByIdAndDelete(commentId);

    return res.status(200).json({
      success: true,
      message: "Comment and its replies deleted successfully",
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
  toggleCommentLike,
  editComment,
  deleteComment,
};