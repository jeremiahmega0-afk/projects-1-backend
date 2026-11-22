
const cron = require("node-cron");
const Article = require("../models/article.model");

const startArticleScheduler = () => {
  cron.schedule(
    "* * * * *",
    async () => {
      try {
        const now = new Date();

        const result = await Article.updateMany(
          {
            status: "scheduled",
            scheduledAt: { $lte: now },
          },
          {
            $set: {
              status: "published",
              publishedAt: now,
              scheduledAt: null,
            },
          }
        );

        if (result.modifiedCount > 0) {
          console.log(
            `${result.modifiedCount} scheduled article(s) published successfully.`
          );
        }
      } catch (error) {
        console.error("Article scheduler error:", error);
      }
    },
    {
      timezone: "Africa/Lagos",
      noOverlap: true,
    }
  );

  console.log("Article scheduler started successfully.");
};

module.exports = startArticleScheduler;
