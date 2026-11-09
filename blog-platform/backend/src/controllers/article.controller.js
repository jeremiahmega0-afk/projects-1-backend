const mongoose = require("mongoose");
const Article = require("../models/article.model");
const Category = require("../models/category.model");
const ArticleView = require("../models/articleView.model");
const slugify = require("slugify");

const {
  createArticleSchema,
  updateArticleSchema,
} = require("../validations/article.validation");

const createArticle = async (req, res) => {
  try {
    const validationResult = createArticleSchema.safeParse(req.body);

    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validationResult.error.issues,
      });
    }

    const { title, content, coverImage, category } = validationResult.data;

    if (category) {
      const categoryExists = await Category.findById(category);

      if (!categoryExists) {
        return res.status(404).json({
          success: false,
          message: "Category not found",
        });
      }
    }

    const slug = slugify(title, {
      lower: true,
      strict: true,
    });

    const existingArticle = await Article.findOne({ slug });

    if (existingArticle) {
      return res.status(409).json({
        success: false,
        message: "An article with this title already exists",
      });
    }

    const article = await Article.create({
      title,
      slug,
      content,
      coverImage,
      category,
      author: req.user.id,
    });

    res.status(201).json({
      success: true,
      message: "Article created successfully",
      article,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};
const getArticles = async (req, res) => {
  try {
    const { search, category, page = 1, limit = 10 } = req.query;

    // Convert page and limit into numbers
    const pageNumber = Math.max(1, Number(page) || 1);
    const limitNumber = Math.min(
      50,
      Math.max(1, Number(limit) || 10)
    );

    // Always show published articles only
    const filter = {
      status: "published",
    };

    // Search articles by title
    if (search) {
      filter.title = {
        $regex: search,
        $options: "i",
      };
    }

    // Filter articles by category
    if (category) {
      if (!mongoose.Types.ObjectId.isValid(category)) {
        return res.status(400).json({
          success: false,
          message: "Invalid category ID",
        });
      }

      filter.category = category;
    }

    // Calculate how many articles to skip
    const skip = (pageNumber - 1) * limitNumber;

    // Get articles and total number of matching articles
    const [articles, totalArticles] = await Promise.all([
      Article.find(filter)
        .populate("category", "name slug description")
        .populate("author", "name email avatar")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNumber),

      Article.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      count: articles.length,
      totalArticles,
      currentPage: pageNumber,
      totalPages: Math.ceil(totalArticles / limitNumber),
      articles,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};

const getArticleBySlug = async (req, res) => {
  try {
    const { slug } = req.params;

    const article = await Article.findOne({
      slug,
      status: "published",
    });

    if (!article) {
      return res.status(404).json({
        success: false,
        message: "Article not found",
      });
    }

    let viewCounted = false;

    // Count every anonymous visit.
    // Count and save every anonymous visit.
    if (!req.user) {
      const session = await Article.db.startSession();

      try {
        await session.withTransaction(async () => {
          // Save the anonymous visitor's view.
          const anonymousView = new ArticleView({
            article: article._id,
          });

          await anonymousView.save({ session });

          // Increase the article's view count.
          await Article.updateOne(
            { _id: article._id, status: "published" },
            { $inc: { views: 1 } },
            { session }
          );
        });

        viewCounted = true;
      } finally {
        await session.endSession();
      }
    } else {
      const session = await Article.db.startSession();

      try {
        await session.withTransaction(async () => {
          const articleView = new ArticleView({
            article: article._id,
            user: req.user.id,
          });

          // Save the user's view record.
          await articleView.save({ session });

          // Increase the article's view count.
          await Article.updateOne(
            { _id: article._id, status: "published" },
            { $inc: { views: 1 } },
            { session }
          );
        });

        viewCounted = true;
      } catch (error) {
        if (error.code !== 11000) {
          throw error;
        }
        // The user has already viewed this article.
      } finally {
        await session.endSession();
      }
    }

    const updatedArticle = await Article.findById(article._id)
      .populate("author", "name email avatar");

    return res.status(200).json({
      success: true,
      viewCounted,
      article: updatedArticle,
    });

  } catch (error) {
    console.error("Get article by slug error:", error);

    return res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};


const getMyArticleById = async (req, res) => {
  try {
    const { id } = req.params;

    // Check whether the article ID is valid
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid article ID",
      });
    }

    // Find the article
    const article = await Article.findById(id)
      .populate("category", "name slug description")
      .populate("author", "name email avatar");

    // Check whether the article exists
    if (!article) {
      return res.status(404).json({
        success: false,
        message: "Article not found",
      });
    }

    // Check whether the logged-in user owns the article
    if (article.author._id.toString() !== req.user.id.toString()) {
      return res.status(403).json({
        success: false,
        message: "You can only view your own articles",
      });
    }

    return res.status(200).json({
      success: true,
      article,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};
const updateArticle = async (req, res) => {
  try {
    // 1. Validate the request body
    const validationResult = updateArticleSchema.safeParse(req.body);

    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validationResult.error.issues,
      });
    }

    const {
      title,
      content,
      coverImage,
      category,
      status,
    } = validationResult.data;

    // 2. Validate the article ID
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid article ID",
      });
    }

    // 3. Find the article
    const article = await Article.findById(id);

    if (!article) {
      return res.status(404).json({
        success: false,
        message: "Article not found",
      });
    }

    // 4. Check ownership BEFORE changing anything
    const articleAuthorId = article.author.toString();
    const loggedInUserId = req.user?.id?.toString();

    if (!loggedInUserId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    if (articleAuthorId !== loggedInUserId) {
      return res.status(403).json({
        success: false,
        message: "You can only update your own articles",
      });
    }

    // 5. Validate the category before updating
    if (category !== undefined && category !== "") {
      if (!mongoose.Types.ObjectId.isValid(category)) {
        return res.status(400).json({
          success: false,
          message: "Invalid category ID",
        });
      }

      const categoryExists = await Category.findById(category);

      if (!categoryExists) {
        return res.status(404).json({
          success: false,
          message: "Category not found",
        });
      }
    }

    // 6. Generate and check the new slug
    if (title !== undefined && title !== article.title) {
      const newSlug = slugify(title, {
        lower: true,
        strict: true,
      });

      if (!newSlug) {
        return res.status(400).json({
          success: false,
          message: "Title must contain letters or numbers",
        });
      }

      const existingArticle = await Article.findOne({
        slug: newSlug,
        _id: { $ne: article._id },
      });

      if (existingArticle) {
        return res.status(409).json({
          success: false,
          message: "An article with this title already exists",
        });
      }

      article.slug = newSlug;
    }

    // 7. Detect content changes
    const contentChanged =
      title !== undefined ||
      content !== undefined ||
      coverImage !== undefined ||
      category !== undefined;

    // Send edited published articles back for review
    if (article.status === "published" && contentChanged) {
      article.status = "pending";
      article.publishedAt = null;
    }

    // 8. Apply permitted changes
    if (title !== undefined) {
      article.title = title;
    }

    if (content !== undefined) {
      article.content = content;
    }

    if (coverImage !== undefined) {
      article.coverImage = coverImage;
    }

    if (category !== undefined) {
      article.category = category || null;
    }

    if (status !== undefined) {
      article.status = status;

      if (status === "draft") {
        article.publishedAt = null;
      }
    }

    // 9. Save only after all checks pass
    await article.save();

    return res.status(200).json({
      success: true,
      message: "Article updated successfully",
      article,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};


const deleteArticle = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid article ID",
      });
    }

    const article = await Article.findById(id);

    if (!article) {
      return res.status(404).json({
        success: false,
        message: "Article not found",
      });
    }

    const articleAuthorId = article.author.toString();
    const loggedInUserId = req.user?.id?.toString();

    if (!loggedInUserId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    if (articleAuthorId !== loggedInUserId) {
      return res.status(403).json({
        success: false,
        message: "You can only delete your own articles",
      });
    }

    await article.deleteOne();

    return res.status(200).json({
      success: true,
      message: "Article deleted successfully",
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};

const getAllArticlesForAdmin = async (req, res) => {
  try {
    const articles = await Article.find()
      .populate("author", "name email avatar")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: articles.length,
      articles,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};
const approveArticle = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid article ID",
      });
    }

    const article = await Article.findById(id);

    if (!article) {
      return res.status(404).json({
        success: false,
        message: "Article not found",
      });
    }
    if (article.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: "Only pending articles can be approved",
      });
    }
    article.status = "published";
    article.publishedAt = new Date();

    await article.save();

    return res.status(200).json({
      success: true,
      message: "Article approved and published successfully",
      article,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
}

const rejectArticle = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid article ID",
      });
    }

    const article = await Article.findById(id);

    if (!article) {
      return res.status(404).json({
        success: false,
        message: "Article not found",
      });
    }

    if (article.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: "Only pending articles can be rejected",
      });
    }

    article.status = "rejected";
    article.publishedAt = null;

    await article.save();

    return res.status(200).json({
      success: true,
      message: "Article rejected successfully",
      article,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};


const toggleArticleLike = async (req, res) => {
  try {
    const { articleId } = req.params;
    const userId = new mongoose.Types.ObjectId(req.user.id);

    if (!mongoose.Types.ObjectId.isValid(articleId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid article ID",
      });
    }

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

    const updatedArticle = await Article.findOneAndUpdate(
      {
        _id: articleId,
        status: "published",
      },

      [
        {
          $set: {
            likes: {
              $let: {
                vars: {
                  currentLikes: { $ifNull: ["$likes", []] }
                },
                in: {
                  $cond: [
                    { $in: [userId, "$$currentLikes"] },
                    {
                      $filter: {
                        input: "$$currentLikes",
                        as: "like",
                        cond: { $ne: ["$$like", userId] }
                      }
                    },
                    {
                      $concatArrays: ["$$currentLikes", [userId]]
                    }
                  ]
                }
              }
            }
          }
        }
      ],
      { returnDocument: "after", updatePipeline: true }
    );

    if (!updatedArticle) {
      return res.status(404).json({
        success: false,
        message: "Published article not found",
      });
    }

    const liked = updatedArticle.likes.some(
      (id) => id.toString() === userId.toString()
    );

    return res.status(200).json({
      success: true,
      message: liked
        ? "Article liked successfully"
        : "Article unliked successfully",
      totalLikes: updatedArticle.likes.length,
      liked,
    });
  } catch (error) {
    console.error("Toggle article like error:", error);

    return res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};


const toggleArticleReaction = async (req, res) => {
  try {
    const { articleId } = req.params;
    const { type } = req.body;
    const userId = new mongoose.Types.ObjectId(req.user.id);

    if (!mongoose.Types.ObjectId.isValid(articleId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid article ID",
      });
    }

    const allowedReactions = ["love", "laugh", "wow", "sad"];

    if (!allowedReactions.includes(type)) {
      return res.status(400).json({
        success: false,
        message: "Invalid reaction type",
      });
    }

    const updatedArticle = await Article.findOneAndUpdate(
      {
        _id: articleId,
        status: "published",
      },
      [
        {
          $set: {
            reactions: {
              $let: {
                vars: {
                  currentReactions: {
                    $ifNull: ["$reactions", []],
                  },
                  existingReaction: {
                    $arrayElemAt: [
                      {
                        $filter: {
                          input: {
                            $ifNull: ["$reactions", []],
                          },
                          as: "reaction",
                          cond: {
                            $eq: ["$$reaction.user", userId],
                          },
                        },
                      },
                      0,
                    ],
                  },
                },
                in: {
                  $cond: [
                    {
                      $eq: ["$$existingReaction.type", type],
                    },
                    {
                      $filter: {
                        input: "$$currentReactions",
                        as: "reaction",
                        cond: {
                          $ne: ["$$reaction.user", userId],
                        },
                      },
                    },
                    {
                      $concatArrays: [
                        {
                          $filter: {
                            input: "$$currentReactions",
                            as: "reaction",
                            cond: {
                              $ne: ["$$reaction.user", userId],
                            },
                          },
                        },
                        [
                          {
                            user: userId,
                            type: type,
                          },
                        ],
                      ],
                    },
                  ],
                },
              },
            },
          },
        },
      ],
      {
        returnDocument: "after",
        updatePipeline: true,
      }
    );

    if (!updatedArticle) {
      return res.status(404).json({
        success: false,
        message: "Published article not found",
      });
    }

    const userReaction = updatedArticle.reactions.find(
      (reaction) =>
        reaction.user.toString() === userId.toString()
    );

    const reactionCounts = {
      love: updatedArticle.reactions.filter(
        (reaction) => reaction.type === "love"
      ).length,
      laugh: updatedArticle.reactions.filter(
        (reaction) => reaction.type === "laugh"
      ).length,
      wow: updatedArticle.reactions.filter(
        (reaction) => reaction.type === "wow"
      ).length,
      sad: updatedArticle.reactions.filter(
        (reaction) => reaction.type === "sad"
      ).length,
    };

    return res.status(200).json({
      success: true,
      message: userReaction
        ? "Reaction saved successfully"
        : "Reaction removed successfully",
      myReaction: userReaction ? userReaction.type : null,
      reactionCounts,
    });
  } catch (error) {
    console.error("Toggle article reaction error:", error);

    return res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};

const getArticleStatistics = async (req, res) => {
  try {
    // Count all published articles.
    const totalPublishedArticles = await Article.countDocuments({
      status: "published",
    });

    // Calculate total views across published articles.
    const viewsResult = await Article.aggregate([
      {
        $match: {
          status: "published",
        },
      },
      {
        $group: {
          _id: null,
          totalViews: {
            $sum: {
              $ifNull: ["$views", 0],
            },
          },
        },
      },
    ]);

    const totalViews = viewsResult.length > 0
      ? viewsResult[0].totalViews
      : 0;

    // Find the five most-viewed published articles.
    const mostViewedArticles = await Article.find({
      status: "published",
    })
      .select("title slug views publishedAt")
      .sort({ views: -1, createdAt: -1 })
      .limit(5);

    return res.status(200).json({
      success: true,
      statistics: {
        totalPublishedArticles,
        totalViews,
        mostViewedArticles,
      },
    });
  } catch (error) {
    console.error("Article statistics error:", error);

    return res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};

const getSingleArticleStatistics = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid article ID",
      });
    }

    // Find the article.
    const article = await Article.findById(id)
      .select("title slug status views likes reactions");

    // Check whether the article exists.
    if (!article) {
      return res.status(404).json({
        success: false,
        message: "Article not found",
      });
    }

    // Count each reaction type.
    const reactionCounts = {
      love: 0,
      laugh: 0,
      wow: 0,
      sad: 0,
    };

    article.reactions.forEach((reaction) => {
      reactionCounts[reaction.type]++;
    });

    return res.status(200).json({
      success: true,
      statistics: {
        title: article.title,
        slug: article.slug,
        status: article.status,
        views: article.views || 0,
        totalLikes: article.likes.length,
        totalReactions: article.reactions.length,
        reactionCounts,
      },
    });
  } catch (error) {
    console.error("Single article statistics error:", error);

    return res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};


const getDailyArticleViews = async (req, res) => {
  try {
    const dailyViews = await ArticleView.aggregate([
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$createdAt",
              timezone: "Africa/Lagos",
            },
          },
          views: { $sum: 1 },
        },
      },
      {
        $sort: {
          _id: 1,
        },
      },
      {
        $project: {
          _id: 0,
          date: "$_id",
          views: 1,
        },
      },
    ]);

    return res.status(200).json({
      success: true,
      dailyViews,
    });
  } catch (error) {
    console.error("Daily article views error:", error);

    return res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};


const getSingleArticleDailyViews = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid article ID",
      });
    }

    // Check whether the article exists.
    const article = await Article.findById(id).select("title");

    if (!article) {
      return res.status(404).json({
        success: false,
        message: "Article not found",
      });
    }

    // Count views for this article, grouped by date.
    const dailyViews = await ArticleView.aggregate([
      {
        $match: {
          article: article._id,
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$createdAt",
              timezone: "Africa/Lagos",
            },
          },
          views: { $sum: 1 },
        },
      },
      {
        $sort: {
          _id: 1,
        },
      },
      {
        $project: {
          _id: 0,
          date: "$_id",
          views: 1,
        },
      },
    ]);

    return res.status(200).json({
      success: true,
      article: article.title,
      dailyViews,
    });
  } catch (error) {
    console.error("Single article daily views error:", error);

    return res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};


const getMostViewedArticles = async (req, res) => {
  try {
    const mostViewedArticles = await Article.find({
      status: "published",
    })
      .select("title slug coverImage views publishedAt")
      .sort({ views: -1, createdAt: -1 })
      .limit(10);

    return res.status(200).json({
      success: true,
      total: mostViewedArticles.length,
      articles: mostViewedArticles,
    });
  } catch (error) {
    console.error("Most viewed articles error:", error);

    return res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};


const getLeastViewedArticles = async (req, res) => {
  try {
    const leastViewedArticles = await Article.find({
      status: "published",
    })
      .select("title slug coverImage views publishedAt")
      .sort({ views: 1, createdAt: -1 })
      .limit(10);

    return res.status(200).json({
      success: true,
      total: leastViewedArticles.length,
      articles: leastViewedArticles,
    });
  } catch (error) {
    console.error("Least viewed articles error:", error);

    return res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};


module.exports = {
  createArticle,
  getArticles,
  getArticleBySlug,
  getMyArticleById,
  updateArticle,
  deleteArticle,
  getAllArticlesForAdmin,
  approveArticle,
  rejectArticle,
  toggleArticleLike,
  toggleArticleReaction,
  getArticleStatistics,
  getSingleArticleStatistics,
  getDailyArticleViews,
  getSingleArticleDailyViews,
  getMostViewedArticles,
  getLeastViewedArticles,
};