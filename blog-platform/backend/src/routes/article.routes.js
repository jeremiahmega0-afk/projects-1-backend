const express = require("express");

const protect = require("../middleware/auth.middleware");
const authorize = require("../middleware/role.middleware");
const {
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
} = require("../controllers/article.controller");
const validate = require("../middleware/validate.middleware");
const imageUpload = require("../uploads/imageUpload");
const uploadMedia = require("../utils/uploadMedia");
const {
  articleReactionSchema,
} = require("../validations/articleReaction.validation");
const optionalProtect = require("../middleware/optionalAuth.middleware");

const uploadCoverImage = async (req, res, next) => {
  if (!req.file) {
    return next();
  }

  try {
    const uploadedImage = await uploadMedia(
      req.file.buffer,
      "image",
      "blog-platform/articles"
    );
    req.body.coverImage = uploadedImage.url;
    next();
  } catch (error) {
    next(error);
  }
};

const {
  createArticleSchema,
  updateArticleSchema,
} = require("../validations/article.validation");
const router = express.Router();

router.post(
  "/",
  protect,
  imageUpload.single("coverImage"),
  validate(createArticleSchema),
  uploadCoverImage,
  createArticle
);
router.get("/", getArticles);
router.get("/my-articles/:id", protect, getMyArticleById);
router.get(
  "/admin/all",
  protect,
  authorize("admin"),
  getAllArticlesForAdmin
);
router.patch(
  "/admin/:id/approve",
  protect,
  authorize("admin"),
  approveArticle
);

router.patch(
  "/admin/:id/reject",
  protect,
  authorize("admin"),
  rejectArticle
);

router.get(
  "/admin/statistics",
  protect,
  authorize("admin"),
  getArticleStatistics
);

router.get(
  "/admin/statistics/daily-views",
  protect,
  authorize("admin"),
  getDailyArticleViews
);

router.get(
  "/admin/statistics/most-viewed",
  protect,
  authorize("admin"),
  getMostViewedArticles
);

router.get(
  "/admin/statistics/least-viewed",
  protect,
  authorize("admin"),
  getLeastViewedArticles
);

router.get(
  "/admin/statistics/views",
  protect,
  authorize("admin"),
  getArticleStatistics
);

router.get(
  "/admin/statistics/:id",
  protect,
  authorize("admin"),
  getSingleArticleStatistics
);

router.get(
  "/admin/statistics/:id/daily-views",
  protect,
  authorize("admin"),
  getSingleArticleDailyViews
);

router.get("/:slug", optionalProtect, getArticleBySlug);
router.patch(
  "/:id",
  protect,
  imageUpload.single("coverImage"),
  validate(updateArticleSchema),
  uploadCoverImage,
  updateArticle
);



router.delete("/:id", protect, deleteArticle);

router.post("/:articleId/like", protect, toggleArticleLike);

router.post(
  "/:articleId/reaction",
  protect,
  validate(articleReactionSchema),
  toggleArticleReaction
);

module.exports = router;