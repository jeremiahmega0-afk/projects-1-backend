const express = require("express");

const protect = require("../middleware/auth.middleware");
const authorize = require("../middleware/role.middleware");
const {
  createArticle,
  getArticles,
  getArticleBySlug,
  updateArticle,
  deleteArticle,
  getAllArticlesForAdmin,
  approveArticle,
  rejectArticle,
} = require("../controllers/article.controller");
const validate = require("../middleware/validate.middleware");

const {
  createArticleSchema,
  updateArticleSchema,
} = require("../validations/article.validation");
const router = express.Router();

router.post(
  "/",
  protect,
  validate(createArticleSchema),
  createArticle
);
router.get("/", getArticles);
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

router.get("/:slug", getArticleBySlug);
router.patch(
  "/:id",
  protect,
  validate(updateArticleSchema),
  updateArticle
);
router.delete("/:id", protect, deleteArticle);

module.exports = router;