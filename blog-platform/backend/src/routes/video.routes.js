
const express = require("express");
const router = express.Router();

const protect = require("../middleware/auth.middleware");
const authorize = require("../middleware/role.middleware");
const optionalProtect = require("../middleware/optionalAuth.middleware");
const videoUpload = require("../uploads/videoUpload");
const validateVideoFile = require("../middleware/videoValidation.middleware");

const {
  createVideo,
  uploadVideo,
  updateVideo,
  deleteVideo,
  getPublishedVideos,
  getVideoById,
  getVideoStatistics,
  getMostViewedVideos,
  getLeastViewedVideos,
  getDailyVideoViews,
  getVideoViewsByDateRange,
} = require("../controllers/video.controller");

// Create a video (admin only)
router.post(
  "/",
  protect,
  authorize("admin"),
  createVideo
);

// Upload a video (all registered users)
router.post(
  "/upload",
  protect,
  videoUpload.single("video"),
  validateVideoFile,
  uploadVideo
);

// Update a video (admin only)
router.patch(
    "/:id",
    protect,
    authorize("admin"),
    updateVideo
);

// Delete a video (admin only)
router.delete(
    "/:id",
    protect,
    authorize("admin"),
    deleteVideo
);

// Get published videos (public)
router.get(
    "/",
    getPublishedVideos
);

// Get video statistics (admin only)
router.get(
  "/admin/statistics",
  protect,
  authorize("admin"),
  getVideoStatistics
);

// Get most viewed videos (admin only)
router.get(
  "/admin/most-viewed",
  protect,
  authorize("admin"),
  getMostViewedVideos
);
// Get least viewed videos (admin only)
router.get(
  "/admin/least-viewed",
  protect,
  authorize("admin"),
  getLeastViewedVideos
);
// Get daily video views (admin only)
router.get(
  "/admin/statistics/daily-views",
  protect,
  authorize("admin"),
  getDailyVideoViews
);
// Get video views by date range (admin only)
router.get(
  "/admin/statistics/views-by-date",
  protect,
  authorize("admin"),
  getVideoViewsByDateRange
);
// Get one published video and record its view
router.get(
    "/:id",
    optionalProtect,
    getVideoById
);


module.exports = router;
