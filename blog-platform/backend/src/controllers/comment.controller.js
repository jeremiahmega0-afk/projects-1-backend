
const Comment = require("../models/comment.model");
const Article = require("../models/article.model");

const uploadMedia = require("../utils/uploadMedia");
const { fileTypeFromBuffer } = require("file-type");

const {
  createCommentSchema,
  updateCommentSchema,
} = require("../validations/comment.validation");

const createComment = async (req, res, next) => {
  try {
    // 1. Validate the comment data
    const validation = createCommentSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: validation.error.issues[0].message,
      });
    }

    // 2. Find the article
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
      content: validation.data.content || "",
      sticker: validation.data.sticker || "",
      author: req.user.id,
      article: article._id,
    });

    // 5. Return the result
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


const uploadCommentMedia = async (req, res, next) => {
  try {
    // 1. Make sure a file was uploaded
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Please upload an image or voice note",
      });
    }

    // 2. Check the file's real format
    const { fileTypeFromBuffer } = await import("file-type");
    const detectedType = await fileTypeFromBuffer(req.file.buffer);

    const allowedImageTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
    ];

    const allowedAudioTypes = [
      "audio/webm",
      "audio/ogg",
      "audio/mpeg",
      "audio/mp4",
      "audio/wav",
    ];

    if (
      !detectedType ||
      (!allowedImageTypes.includes(detectedType.mime) &&
        !allowedAudioTypes.includes(detectedType.mime))
    ) {
      return res.status(400).json({
        success: false,
        message: "The uploaded file format is not supported",
      });
    }

    // 3. Find the article
    const article = await Article.findById(req.params.articleId);

    if (!article) {
      return res.status(404).json({
        success: false,
        message: "Article not found",
      });
    }

    // 4. Only allow comments on published articles
    if (article.status !== "published") {
      return res.status(403).json({
        success: false,
        message: "You can only comment on published articles",
      });
    }

    // 5. Decide whether the file is an image or audio
    const isImage = allowedImageTypes.includes(detectedType.mime);
    const resourceType = isImage ? "image" : "video";
    const folder = isImage ? "blog/comment-images" : "blog/comment-audio";

    // 6. Upload the file to Cloudinary
    const uploaded = await uploadMedia(
      req.file.buffer,
      resourceType,
      folder
    );

    // 7. Save the comment in MongoDB
    const comment = await Comment.create({
      content: "",
      imageUrl: isImage ? uploaded.url : "",
      audioUrl: isImage ? "" : uploaded.url,
      author: req.user.id,
      article: article._id,
    });

    return res.status(201).json({
      success: true,
      message: "Media comment created successfully",
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
  uploadCommentMedia,
};
