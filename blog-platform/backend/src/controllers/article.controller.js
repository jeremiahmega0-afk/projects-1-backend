const mongoose = require("mongoose");
const Article = require("../models/article.model");
const ArticleRevision = require("../models/articleRevision.model");
const Category = require("../models/category.model");
const ArticleView = require("../models/articleView.model");
const slugify = require("slugify");
const cloudinary = require("../config/cloudinary");

const { getClientUrl } = require("../utils/website-url.utils");

const {
  createArticleSchema,
  updateArticleSchema,
} = require("../validations/article.validation");

const {
  scheduleArticleSchema,
} = require("../validations/articleSchedule.validation");

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

    const {
      title,
      content,
      coverImage,
      category,
      tags,
      metaTitle,
      metaDescription,
      canonicalUrl,
      ogTitle,
      ogDescription,
      ogImage,
    } = validationResult.data;

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
      coverImage: coverImage || "",
      coverImagePublicId: req.body.coverImagePublicId || "",
      author: req.user.id,
      category,
      tags: tags || [],
      metaTitle: metaTitle || title.substring(0, 60),
      metaDescription: metaDescription || content.substring(0, 160),
      canonicalUrl: canonicalUrl || "",
      ogTitle: ogTitle || title.substring(0, 95),
      ogDescription: ogDescription || content.substring(0, 200),
      ogImage: ogImage || coverImage || "",
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


const scheduleArticle = async (req, res) => {
  try {
    // 1. Validate the scheduled date
    const validationResult = scheduleArticleSchema.safeParse(req.body);

    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validationResult.error.issues,
      });
    }

    const { scheduledAt } = validationResult.data;

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

    // 4. Check whether the logged-in user owns the article
    if (article.author.toString() !== req.user.id.toString()) {
      return res.status(403).json({
        success: false,
        message: "You can only schedule your own articles",
      });
    }

    // 5. Only approved articles can be scheduled
    if (article.status !== "approved") {
      return res.status(400).json({
        success: false,
        message: "Only approved articles can be scheduled",
      });
    }

    // 6. Save the schedule
    article.status = "scheduled";
    article.scheduledAt = new Date(scheduledAt);
    article.publishedAt = null;

    await article.save();

    return res.status(200).json({
      success: true,
      message: "Article scheduled successfully",
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

const getArticles = async (req, res) => {
  try {
    const { search, category, tag, page = 1, limit = 10 } = req.query;

    // Convert page and limit into numbers
    const pageNumber = Math.max(1, Number(page) || 1);
    const limitNumber = Math.min(
      50,
      Math.max(1, Number(limit) || 10)
    );

    // Show only published articles that are not in the trash
    const filter = {
      status: "published",
      isDeleted: false,
    };


    // Search articles by title, content, and tags
    if (search && search.trim()) {
      filter.$text = {
        $search: search.trim(),
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
    // Filter articles by tag
    if (tag && tag.trim()) {
      filter.tags = tag.trim().toLowerCase();
    }

    // Calculate how many articles to skip
    const skip = (pageNumber - 1) * limitNumber;

    // Get articles and total number of matching articles
    const articleQuery = Article.find(
      filter,
      search && search.trim()
        ? { score: { $meta: "textScore" } }
        : {}
    )
      .populate("category", "name slug description")
      .populate("author", "name email avatar")
      .skip(skip)
      .limit(limitNumber);

    if (search && search.trim()) {
      articleQuery.sort({
        score: { $meta: "textScore" },
      });
    } else {
      articleQuery.sort({ createdAt: -1 });
    }

    const [articles, totalArticles] = await Promise.all([
      articleQuery,

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
      isDeleted: false,
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
      .populate("author", "name username avatar bio")
      .populate("category", "name slug description");

    const articleUrl = `${getClientUrl()}/articles/${updatedArticle.slug}`;

    const canonicalArticleUrl =
      updatedArticle.canonicalUrl || articleUrl;

    const structuredData = {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      inLanguage: "en",
      wordCount: updatedArticle.content.trim().split(/\s+/).length,

      headline:
        updatedArticle.ogTitle ||
        updatedArticle.metaTitle ||
        updatedArticle.title,

      articleBody: updatedArticle.content,

      description:
        updatedArticle.ogDescription ||
        updatedArticle.metaDescription ||
        updatedArticle.content.substring(0, 160),

      url: canonicalArticleUrl,

      mainEntityOfPage: {
        "@type": "WebPage",
        "@id": canonicalArticleUrl,
      },

      datePublished: updatedArticle.publishedAt,
      dateModified: updatedArticle.updatedAt,

      author: {
        "@type": "Person",
        name:
          updatedArticle.author?.name ||
          updatedArticle.author?.username,

        identifier: updatedArticle.author?.username,
      },

      publisher: {
        "@type": "Organization",
        name: "Jerry Blog Platform",
        url: getClientUrl(),
      },

      copyrightHolder: {
        "@type": "Person",
        name:
          updatedArticle.author?.name ||
          updatedArticle.author?.username,
      },

      copyrightYear: updatedArticle.publishedAt
        ? new Date(updatedArticle.publishedAt).getFullYear()
        : undefined,

      image:
        updatedArticle.ogImage ||
        updatedArticle.coverImage ||
        undefined,

      keywords: updatedArticle.tags,

      articleSection: updatedArticle.category?.name || "General",

      about: updatedArticle.category
        ? {
          "@type": "Thing",
          name: updatedArticle.category.name,
        }
        : undefined,
    };

    return res.status(200).json({
      success: true,
      viewCounted,
      article: updatedArticle,
      structuredData,
    });

  } catch (error) {
    console.error("Get article by slug error:", error);

    return res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};

const getRelatedArticles = async (req, res) => {
  try {
    const { slug } = req.params;

    // Find the article the visitor is currently reading.
    const article = await Article.findOne({
      slug,
      status: "published",
      isDeleted: false,
    });
    if (!article) {
      return res.status(404).json({
        success: false,
        message: "Article not found",
      });
    }

    // If the article has no category, return an empty list.
    if (!article.category) {
      return res.status(200).json({
        success: true,
        total: 0,
        relatedArticles: [],
      });
    }

    // Find other published articles in the same category.
    const relatedArticles = await Article.find({
      category: article.category,
      status: "published",
      isDeleted: false,
      _id: { $ne: article._id },
    })
      .select("title slug coverImage publishedAt views")
      .populate("author", "name avatar")
      .limit(5)
      .sort({ publishedAt: -1 });

    return res.status(200).json({
      success: true,
      total: relatedArticles.length,
      relatedArticles,
    });

  } catch (error) {
    console.error("Get related articles error:", error);

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
    // 1. Remove the server-generated public ID before validating user input
    const bodyToValidate = { ...req.body };

    delete bodyToValidate.coverImagePublicId;

    // Validate the request body
    const validationResult = updateArticleSchema.safeParse(bodyToValidate);

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
      tags,
      metaTitle,
      metaDescription,
      canonicalUrl,
      ogTitle,
      ogDescription,
      ogImage,
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

    // Remember the old cover image before replacing it
    const oldCoverImagePublicId = article.coverImagePublicId;

    // Capture the original article before making changes
    const originalArticle = {
      title: article.title,
      content: article.content,
      slug: article.slug,
      coverImage: article.coverImage,
      coverImagePublicId: article.coverImagePublicId,
      category: article.category,
      tags: [...article.tags],
      metaTitle: article.metaTitle,
      metaDescription: article.metaDescription,
      canonicalUrl: article.canonicalUrl,
      ogTitle: article.ogTitle,
      ogDescription: article.ogDescription,
      ogImage: article.ogImage,
    };

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

    // Detect automatically generated SEO metadata BEFORE making changes

    const shouldAutoUpdateMetaTitle =
      !article.metaTitle ||
      article.metaTitle === article.title.substring(0, 60);

    const shouldAutoUpdateMetaDescription =
      !article.metaDescription ||
      article.metaDescription === article.content.substring(0, 160);

    const shouldAutoUpdateOgTitle =
      !article.ogTitle ||
      article.ogTitle === article.title.substring(0, 95);

    const shouldAutoUpdateOgDescription =
      !article.ogDescription ||
      article.ogDescription === article.content.substring(0, 200);

    const shouldAutoUpdateOgImage =
      !article.ogImage ||
      article.ogImage === article.coverImage;

    // 7. Detect content changes
    const contentChanged =
      title !== undefined ||
      content !== undefined ||
      coverImage !== undefined ||
      category !== undefined ||
      tags !== undefined ||
      metaTitle !== undefined ||
      metaDescription !== undefined ||
      canonicalUrl !== undefined ||
      ogTitle !== undefined ||
      ogDescription !== undefined ||
      ogImage !== undefined;


    // Send edited published or scheduled articles back for review
    if (
      ["published", "scheduled"].includes(article.status) &&
      contentChanged
    ) {
      article.status = "pending";
      article.publishedAt = null;
      article.scheduledAt = null;
    }

    // Automatically refresh generated SEO metadata

    if (title !== undefined && shouldAutoUpdateMetaTitle) {
      article.metaTitle = title.substring(0, 60);
    }

    if (content !== undefined && shouldAutoUpdateMetaDescription) {
      article.metaDescription = content.substring(0, 160);
    }

    if (title !== undefined && shouldAutoUpdateOgTitle) {
      article.ogTitle = title.substring(0, 95);
    }

    if (content !== undefined && shouldAutoUpdateOgDescription) {
      article.ogDescription = content.substring(0, 200);
    }

    if (coverImage !== undefined && shouldAutoUpdateOgImage) {
      article.ogImage = coverImage;
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

    // Save the new Cloudinary public ID when a new image is uploaded
    if (req.file && req.body.coverImagePublicId) {
      article.coverImagePublicId = req.body.coverImagePublicId;
    }

    if (category !== undefined) {
      article.category = category || null;
    }

    if (tags !== undefined) {
      article.tags = tags;
    }

    if (metaTitle !== undefined) {
      article.metaTitle = metaTitle;
    }

    if (metaDescription !== undefined) {
      article.metaDescription = metaDescription;
    }

    if (canonicalUrl !== undefined) {
      article.canonicalUrl = canonicalUrl;
    }

    if (ogTitle !== undefined) {
      article.ogTitle = ogTitle;
    }

    if (ogDescription !== undefined) {
      article.ogDescription = ogDescription;
    }

    if (ogImage !== undefined) {
      article.ogImage = ogImage;
    }

    if (status !== undefined) {
      article.status = status;

      if (["draft", "pending"].includes(status)) {
        article.publishedAt = null;
        article.scheduledAt = null;
      }
    }

    // Save the previous article version before updating it
    await ArticleRevision.create({
      article: article._id,
      ...originalArticle,
      editedBy: req.user.id,
    });

    // 9. Save only after all checks pass
    await article.save();

    // Delete the old cover image after the new article data is saved
    if (
      req.file &&
      oldCoverImagePublicId &&
      oldCoverImagePublicId !== article.coverImagePublicId
    ) {
      try {
        await cloudinary.uploader.destroy(oldCoverImagePublicId, {
          resource_type: "image",
        });

        console.log("Old article cover image deleted successfully");
      } catch (cloudinaryError) {
        console.error("Failed to delete old article cover image:", cloudinaryError);
      }
    }

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


const getArticleRevisions = async (req, res) => {
  try {
    // 1. Validate the article ID
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid article ID",
      });
    }

    // 2. Find the article
    const article = await Article.findById(id);

    if (!article) {
      return res.status(404).json({
        success: false,
        message: "Article not found",
      });
    }

    // 3. Check ownership
    if (article.author.toString() !== req.user.id.toString()) {
      return res.status(403).json({
        success: false,
        message: "You can only view revisions of your own articles",
      });
    }

    // 4. Retrieve the article's previous versions
    const revisions = await ArticleRevision.find({
      article: article._id,
    })
      .populate("editedBy", "name username")
      .sort({ createdAt: -1 });

    // 5. Return the revision history
    return res.status(200).json({
      success: true,
      count: revisions.length,
      revisions,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};


const restoreArticleRevision = async (req, res) => {
  try {
    // 1. Get article ID and revision ID
    const { id, revisionId } = req.params;

    // 2. Validate both IDs
    if (
      !mongoose.Types.ObjectId.isValid(id) ||
      !mongoose.Types.ObjectId.isValid(revisionId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid article or revision ID",
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

    // 4. Check article ownership
    if (article.author.toString() !== req.user.id.toString()) {
      return res.status(403).json({
        success: false,
        message: "You can only restore your own articles",
      });
    }

    // 5. Find the selected revision
    const revision = await ArticleRevision.findOne({
      _id: revisionId,
      article: article._id,
    });

    if (!revision) {
      return res.status(404).json({
        success: false,
        message: "Article revision not found",
      });
    }

    // Check whether another article already uses this slug
    const existingArticle = await Article.findOne({
      slug: revision.slug,
      _id: { $ne: article._id },
    });

    if (existingArticle) {
      return res.status(409).json({
        success: false,
        message: "Cannot restore this revision because its slug is already in use",
      });
    }

    // 6. Save the current article before restoring
    await ArticleRevision.create({
      article: article._id,
      title: article.title,
      content: article.content,
      slug: article.slug,
      coverImage: article.coverImage,
      coverImagePublicId: article.coverImagePublicId,
      category: article.category,
      tags: [...article.tags],
      metaTitle: article.metaTitle,
      metaDescription: article.metaDescription,
      canonicalUrl: article.canonicalUrl,
      ogTitle: article.ogTitle,
      ogDescription: article.ogDescription,
      ogImage: article.ogImage,
      editedBy: req.user.id,
    });

    // 7. Restore the selected version
    article.title = revision.title;
    article.content = revision.content;
    article.slug = revision.slug;
    article.coverImage = revision.coverImage;
    article.coverImagePublicId = revision.coverImagePublicId || "";
    article.category = revision.category;
    article.tags = [...revision.tags];
    article.metaTitle = revision.metaTitle;
    article.metaDescription = revision.metaDescription;
    article.canonicalUrl = revision.canonicalUrl;
    article.ogTitle = revision.ogTitle;
    article.ogDescription = revision.ogDescription;
    article.ogImage = revision.ogImage;

    // Require approval for restored articles unless they are drafts
    if (article.status !== "draft") {
      article.status = "pending";
    }

    article.publishedAt = null;
    article.scheduledAt = null;

    // 9. Save the restored article
    await article.save();

    return res.status(200).json({
      success: true,
      message: "Article revision restored successfully",
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


const compareArticleRevisions = async (req, res) => {
  try {
    // 1. Get the article ID and two revision IDs
    const { id } = req.params;
    const { revision1, revision2 } = req.query;

    // 2. Validate the IDs
    if (
      !mongoose.Types.ObjectId.isValid(id) ||
      !mongoose.Types.ObjectId.isValid(revision1) ||
      !mongoose.Types.ObjectId.isValid(revision2)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid article or revision ID",
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

    // 4. Check article ownership
    if (article.author.toString() !== req.user.id.toString()) {
      return res.status(403).json({
        success: false,
        message: "You can only compare revisions of your own articles",
      });
    }

    // 5. Find both revisions
    const revisions = await ArticleRevision.find({
      article: article._id,
      _id: { $in: [revision1, revision2] },
    }).populate("editedBy", "name username");

    // 6. Make sure both revisions exist
    if (revisions.length !== 2) {
      return res.status(404).json({
        success: false,
        message: "One or both article revisions were not found",
      });
    }

    // 7. Return both revisions
    return res.status(200).json({
      success: true,
      message: "Article revisions retrieved for comparison",
      revisions,
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

    // 1. Validate article ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid article ID",
      });
    }

    // 2. Find the article
    const article = await Article.findById(id);

    if (!article) {
      return res.status(404).json({
        success: false,
        message: "Article not found",
      });
    }

    // 3. Check authentication
    const articleAuthorId = article.author.toString();
    const loggedInUserId = req.user?.id?.toString();

    if (!loggedInUserId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    // 4. Check ownership
    if (articleAuthorId !== loggedInUserId) {
      return res.status(403).json({
        success: false,
        message: "You can only delete your own articles",
      });
    }

    // 5. Prevent deleting an article already in trash
    if (article.isDeleted) {
      return res.status(400).json({
        success: false,
        message: "Article is already in the trash",
      });
    }

    // 6. Move article to trash
    article.isDeleted = true;
    article.deletedAt = new Date();

    await article.save();

    // 7. Send success response
    return res.status(200).json({
      success: true,
      message: "Article moved to trash successfully",
      article: {
        id: article._id,
        title: article.title,
        isDeleted: article.isDeleted,
        deletedAt: article.deletedAt,
      },
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
    article.status = "approved";
    article.publishedAt = null;
    article.scheduledAt = null;

    await article.save();

    return res.status(200).json({
      success: true,
      message: "Article approved successfully. It can now be scheduled.",
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
    article.scheduledAt = null;

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


const getViewsByDateRange = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    // Check that both dates were provided.
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: "Start date and end date are required",
      });
    }

    // Convert the dates into JavaScript Date objects.
    const start = new Date(`${startDate}T00:00:00.000+01:00`);
    const end = new Date(`${endDate}T23:59:59.999+01:00`);

    // Check that the dates are valid.
    if (
      Number.isNaN(start.getTime()) ||
      Number.isNaN(end.getTime()) ||
      startDate > endDate
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid date range",
      });
    }

    // Count views within the selected date range.
    const totalViews = await ArticleView.countDocuments({
      createdAt: {
        $gte: start,
        $lte: end,
      },
    });

    return res.status(200).json({
      success: true,
      startDate,
      endDate,
      totalViews,
    });
  } catch (error) {
    console.error("Date range views error:", error);

    return res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};

const getAllArticleTags = async (req, res) => {
  try {
    // Get limit from query parameters
    const requestedLimit = req.query.limit;

    let limit = 10;

    if (requestedLimit !== undefined) {
      const parsedLimit = Number(requestedLimit);

      if (
        !Number.isInteger(parsedLimit) ||
        parsedLimit < 1
      ) {
        return res.status(400).json({
          success: false,
          message: "Limit must be a positive whole number",
        });
      }

      limit = Math.min(parsedLimit, 50);
    }

    const tags = await Article.aggregate([
      // Only published articles
      {
        $match: {
          status: "published",
        },
      },

      // Separate each tag
      {
        $unwind: "$tags",
      },

      // Count articles using each tag
      {
        $group: {
          _id: "$tags",
          articleCount: {
            $sum: 1,
          },
        },
      },

      // Most popular tags first
      {
        $sort: {
          articleCount: -1,
          _id: 1,
        },
      },

      // Limit the number of results
      {
        $limit: limit,
      },

      // Format the response
      {
        $project: {
          _id: 0,
          name: "$_id",
          articleCount: 1,
        },
      },
    ]);

    return res.status(200).json({
      success: true,
      count: tags.length,
      tags,
    });
  } catch (error) {
    console.error("Get article tags error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch article tags",
    });
  }
};

const searchArticleSuggestions = async (req, res) => {
  try {
    const search = req.query.search;

    // Check whether search was provided
    if (search === undefined) {
      return res.status(400).json({
        success: false,
        message: "Search term is required",
      });
    }

    // Ensure search is a single text value
    if (typeof search !== "string") {
      return res.status(400).json({
        success: false,
        message: "Search term must be a valid string",
      });
    }

    // Search term cannot exceed 100 characters
    if (search.length > 100) {
      return res.status(400).json({
        success: false,
        message: "Search term cannot exceed 100 characters",
      });
    }

    // Check whether search was provided
    if (!search || !search.trim()) {
      return res.status(400).json({
        success: false,
        message: "Search term is required",
      });
    }

    // Search must contain at least 2 characters
    if (search.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: "Search term must be at least 2 characters",
      });
    }

    // Escape special characters before using search in a regular expression
    const escapedSearch = search
      .trim()
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    // Find matching published article titles or tags
    const suggestions = await Article.find({
      status: "published",
      $or: [
        {
          title: {
            $regex: escapedSearch,
            $options: "i",
          },
        },
        {
          tags: {
            $regex: escapedSearch,
            $options: "i",
          },
        },
        {
          content: {
            $regex: escapedSearch,
            $options: "i",
          },
        },
      ],
    })
      .select("title slug")
      .limit(5)
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: suggestions.length,
      suggestions,
    });
  } catch (error) {
    console.error("Article suggestion error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch search suggestions",
    });
  }
};


module.exports = {
  createArticle,
  getArticles,
  getArticleBySlug,
  getArticleRevisions,
  restoreArticleRevision,
  compareArticleRevisions,
  getMyArticleById,
  updateArticle,
  deleteArticle,
  getAllArticlesForAdmin,
  approveArticle,
  rejectArticle,
  scheduleArticle,
  toggleArticleLike,
  toggleArticleReaction,
  getArticleStatistics,
  getSingleArticleStatistics,
  getDailyArticleViews,
  getSingleArticleDailyViews,
  getMostViewedArticles,
  getLeastViewedArticles,
  getViewsByDateRange,
  getRelatedArticles,
  getAllArticleTags,
  searchArticleSuggestions,
};