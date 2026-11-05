const express = require("express");
const cookieParser = require("cookie-parser");
const helmet = require("helmet");
const cors = require("cors");

const healthRoutes = require("./routes/health.routes");
const aboutRoutes = require("./routes/about.routes");
const statusRoutes = require("./routes/status.routes");
const authRoutes = require("./routes/auth.routes");
const userRoutes = require("./routes/user.routes");
const articleRoutes = require("./routes/article.routes");
const categoryRoutes = require("./routes/category.routes");
const commentRoutes = require("./routes/comment.routes");
const commentReportRoutes = require("./routes/commentReport.routes");
const commentModerationRoutes = require("./routes/commentModeration.routes");

const {
  notFound,
  errorHandler,
} = require("./middleware/error.middleware");
const apiLimiter = require("./middleware/rate-limit.middleware");
const path = require("path");

const app = express();
app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);

app.use(helmet());
app.use(express.json({ limit: "100kb" }));;
app.use(cookieParser());
app.use("/api", apiLimiter);
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use("/api/v1/health", healthRoutes);
app.use("/api/v1/about", aboutRoutes);
app.use("/api/v1/status", statusRoutes);
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/articles", articleRoutes);
app.use("/api/v1/categories", categoryRoutes);
app.use("/api/v1/comments", commentRoutes);
app.use("/api/v1/comment-reports", commentReportRoutes);
app.use("/api/v1/comment-moderation", commentModerationRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;