
require("dotenv").config();

const app = require("./app");
const connectDB = require("./config/db");
const startArticleScheduler = require("./utils/article-scheduler.utils");

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await connectDB();

  // Start automatic article publishing
  startArticleScheduler();

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
};

startServer();
