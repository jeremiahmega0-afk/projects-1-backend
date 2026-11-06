
const mongoose = require("mongoose");
const Comment = require("../models/comment.model");
const Article = require("../models/article.model");
const cloudinary = require("../config/cloudinary");
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
      if (!mongoose.Types.ObjectId.isValid(parentComment)) {
        return res.status(400).json({
          success: false,
          message: "Invalid parent comment ID",
        });
      }

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

      // Prevent replying to hidden or rejected comments
      if (parent.status !== "approved") {
        return res.status(403).json({
          success: false,
          message: "You cannot reply to a hidden or rejected comment",
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
      status: "approved",
    })
      .populate("author", "name")
      .sort({ createdAt: -1 });

    const commentsWithReplies = await Promise.all(
      comments.map(async (comment) => {
        const replies = await Comment.find({
          parentComment: comment._id,
          status: "approved",
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
    const userId = new mongoose.Types.ObjectId(req.user.id);

    if (!mongoose.Types.ObjectId.isValid(commentId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid comment ID",
      });
    }

   const updatedComment = await Comment.findOneAndUpdate(
  {
    _id: commentId,
    status: "approved",
  },
  [
    {
      $set: {
        likes: {
          $cond: [
            { $in: [userId, "$likes"] },
            {
              $filter: {
                input: "$likes",
                as: "like",
                cond: { $ne: ["$$like", userId] },
              },
            },
            { $concatArrays: ["$likes", [userId]] },
          ],
        },
      },
    },
  ],
  {
    new: true,
    updatePipeline: true,
  }
);

    if (!updatedComment) {
      const exists = await Comment.exists({ _id: commentId });

      return res.status(exists ? 403 : 404).json({
        success: false,
        message: exists
          ? "You cannot like a hidden or rejected comment"
          : "Comment not found",
      });
    }

    const liked = updatedComment.likes.some(
      (id) => id.toString() === userId.toString()
    );

    return res.status(200).json({
      success: true,
      message: liked
        ? "Comment liked successfully"
        : "Comment unliked successfully",
      totalLikes: updatedComment.likes.length,
      liked,
    });
  } catch (error) {
    console.error("Toggle comment like error:", error);

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

    // Prevent editing hidden or rejected comments
    if (comment.status !== "approved") {
      return res.status(403).json({
        success: false,
        message: "You cannot edit a hidden or rejected comment",
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


const deleteCommentAndReplies = async (commentId, session) => {
  const commentIds = [commentId];
  let index = 0;

  // Step 1: Find all replies, including nested replies
  while (index < commentIds.length) {
    const replies = await Comment.find({
      parentComment: commentIds[index],
    })
      .select("_id")
      .session(session);

    for (const reply of replies) {
      commentIds.push(reply._id);
    }

    index++;
  }

  // Step 2: Collect Cloudinary audio IDs before deleting comments
  const comments = await Comment.find({
    _id: { $in: commentIds },
  })
    .select("_id audioPublicId")
    .session(session);

  const audioPublicIds = comments
    .map((comment) => comment.audioPublicId)
    .filter((publicId) => publicId);

  // Step 3: Delete all comments from MongoDB
  await Comment.deleteMany(
    { _id: { $in: commentIds } },
    { session }
  );

  // Step 4: Return audio IDs for later Cloudinary cleanup
  return audioPublicIds;
};



const deleteComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    const userId = req.user.id;

    if (!mongoose.Types.ObjectId.isValid(commentId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid comment ID",
      });
    }

    const comment = await Comment.findById(commentId);

    if (!comment) {
      return res.status(404).json({
        success: false,
        message: "Comment not found",
      });
    }

    if (comment.author.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to delete this comment",
      });
    }

    const session = await mongoose.startSession();
    let audioPublicIds = [];

    try {
      await session.withTransaction(async () => {
        audioPublicIds = await deleteCommentAndReplies(
          comment._id,
          session
        );
      });
    } finally {
      await session.endSession();
    }

    // Delete audio files from Cloudinary after MongoDB succeeds
    const cleanupResults = await Promise.allSettled(
      audioPublicIds.map((publicId) =>
        cloudinary.uploader.destroy(publicId, {
          resource_type: "video",
        })
      )
    );

    const failedCleanups = cleanupResults.filter(
      (result) => result.status === "rejected"
    );

    if (failedCleanups.length > 0) {
      console.error(
        "Some Cloudinary audio files could not be deleted:",
        failedCleanups
      );
    }

    return res.status(200).json({
      success: true,
      message: "Comment and its replies deleted successfully",
      audioFilesDeleted:
        audioPublicIds.length - failedCleanups.length,
      audioFilesFailed: failedCleanups.length,
    });
  } catch (error) {
    console.error("Delete comment error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete comment",
    });
  }
};

const getAllComments = async (req, res) => {
  try {
    const { status, type, articleId } = req.query;

    // Pagination settings
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(req.query.limit) || 10)
    );

    const skip = (page - 1) * limit;

    // Build filter
    const filter = {};

    if (status) {
      const allowedStatuses = ["approved", "hidden", "rejected"];

      if (!allowedStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid comment status",
        });
      }

      filter.status = status;
    }

    if (type) {
      const allowedTypes = ["text", "sticker", "audio"];

      if (!allowedTypes.includes(type)) {
        return res.status(400).json({
          success: false,
          message: "Invalid comment type",
        });
      }

      filter.type = type;
    }

    if (articleId) {
      if (!mongoose.Types.ObjectId.isValid(articleId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid article ID",
        });
      }

      filter.article = articleId;
    }

    // Count matching comments
    const totalComments = await Comment.countDocuments(filter);

    // Get comments for the selected page
    const comments = await Comment.find(filter)
      .populate("author", "name email")
      .populate("article", "title")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalPages = Math.ceil(totalComments / limit);

    return res.status(200).json({
      success: true,
      message: "Comments retrieved successfully",
      pagination: {
        totalComments,
        totalPages,
        currentPage: page,
        limit,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
      comments,
    });
  } catch (error) {
    console.error("Get all comments error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve comments",
    });
  }
};


module.exports = {
  createComment,
  getArticleComments,
  toggleCommentLike,
  editComment,
  deleteComment,
  getAllComments,
};