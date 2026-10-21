const express = require("express");

const {
  createCategory,
  getCategories,
  updateCategory,
  deleteCategory,
} = require("../controllers/category.controller");

const protect = require("../middleware/auth.middleware");
const authorize = require("../middleware/role.middleware");
const validate = require("../middleware/validate.middleware");

const {
  createCategorySchema,
  updateCategorySchema,
} = require("../validations/category.validation");

const router = express.Router();

// Get all categories
router.get("/", getCategories);

// Create category — admin only
router.post(
  "/",
  protect,
  authorize("admin"),
  validate(createCategorySchema),
  createCategory
);
router.patch(
  "/:id",
  protect,
  authorize("admin"),
  validate(updateCategorySchema),
  updateCategory
);
router.delete(
  "/:id",
  protect,
  authorize("admin"),
  
  deleteCategory
);
module.exports = router;