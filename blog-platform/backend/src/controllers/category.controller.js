const mongoose = require("mongoose");
const Category = require("../models/category.model");
const slugify = require("slugify");
const Article = require("../models/article.model");
const {
  createCategorySchema,
  updateCategorySchema,
} = require("../validations/category.validation");

// Create category
const createCategory = async (req, res) => {
  try {
    const validationResult = createCategorySchema.safeParse(req.body);

    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validationResult.error.issues,
      });
    }

    const { name, description } = validationResult.data;
    const normalizedName = name.trim();
    const slug = slugify(normalizedName, {
      lower: true,
      strict: true,
    });

    const existingCategory = await Category.findOne({ slug });

    if (existingCategory) {
      return res.status(409).json({
        success: false,
        message: "Category already exists",
      });
    }

    const category = await Category.create({
      name: normalizedName,
      slug,
      description: description || "",
    });

    return res.status(201).json({
      success: true,
      message: "Category created successfully",
      category,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Failed to create category",
    });
  }
};

// Get all categories
const getCategories = async (req, res) => {
  try {
    const categories = await Category.find().sort({
      name: 1,
    });

    return res.status(200).json({
      success: true,
      categories,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Failed to get categories",
    });
  }
};

const updateCategory = async (req, res) => {
  try {
    const validationResult = {
  data: req.body,
};

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid category id",
      });
    }

    const category = await Category.findById(req.params.id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    const { name, description } = validationResult.data;

    if (name !== undefined) {
      const normalizedName = name.trim();
      const slug = slugify(normalizedName, {
        lower: true,
        strict: true,
      });

      const existingCategory = await Category.findOne({
        slug,
        _id: { $ne: category._id },
      });

      if (existingCategory) {
        return res.status(409).json({
          success: false,
          message: "Category already exists",
        });
      }

      category.name = normalizedName;
      category.slug = slug;
    }

    if (description !== undefined) {
      category.description = description || "";
    }

    await category.save();

    return res.status(200).json({
      success: true,
      message: "Category updated successfully",
      category,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Failed to update category",
    });
  }
};
// Delete category
const deleteCategory = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid category id",
      });
    }

    const category = await Category.findById(req.params.id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }
    const articlesUsingCategory = await Article.findOne({
      category: category._id,
    });

    if (articlesUsingCategory) {
      return res.status(409).json({
        success: false,
        message: "Cannot delete category because it is being used by an article",
      });
    }
    await Category.findByIdAndDelete(req.params.id);

    return res.status(200).json({
      success: true,
      message: "Category deleted successfully",
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete category",
    });
  }
};
module.exports = {
  createCategory,
  getCategories,
  updateCategory,
  deleteCategory,
};