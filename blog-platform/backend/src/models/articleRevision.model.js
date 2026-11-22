
const mongoose = require("mongoose");

const articleRevisionSchema = new mongoose.Schema(
    {
        article: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Article",
            required: true,
        },

        title: {
            type: String,
            required: true,
            trim: true,
        },

        content: {
            type: String,
            required: true,
        },

        slug: {
            type: String,
            required: true,
            trim: true,
            lowercase: true,
        },

        coverImage: {
            type: String,
            default: "",
        },

        coverImagePublicId: {
            type: String,
            default: "",
        },

        category: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Category",
            default: null,
        },

        tags: {
            type: [String],
            default: [],
        },

        metaTitle: {
            type: String,
            default: "",
        },

        metaDescription: {
            type: String,
            default: "",
        },

        canonicalUrl: {
            type: String,
            default: "",
        },

        ogTitle: {
            type: String,
            default: "",
        },

        ogDescription: {
            type: String,
            default: "",
        },

        ogImage: {
            type: String,
            default: "",
        },

        editedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
    },
    {
        timestamps: true,
    }
);

articleRevisionSchema.index(
    {
        article: 1,
        createdAt: -1,
    },
    {
        name: "article_revision_history",
    }
);

const ArticleRevision = mongoose.model(
    "ArticleRevision",
    articleRevisionSchema
);

module.exports = ArticleRevision;
