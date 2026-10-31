const mongoose = require("mongoose");
const Article = require("../models/article.model");
const Category = require("../models/category.model");
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
    const articles = await Article.find({
      status: "published",
    })
      .populate("category", "name slug description")
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
const getArticleBySlug = async (req, res) => {
  try {
    const { slug } = req.params;

    const article = await Article.findOne({
      slug,
      status: "published",
    }).populate("author", "name email avatar");

    if (!article) {
      return res.status(404).json({
        success: false,
        message: "Article not found",
      });
    }

    res.status(200).json({
      success: true,
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

module.exports = {
  createArticle,
  getArticles,
  getArticleBySlug,
  updateArticle,
  deleteArticle,
  getAllArticlesForAdmin,
  approveArticle,
  rejectArticle,
};
