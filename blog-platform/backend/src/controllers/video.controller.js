
const Video = require("../models/video.model");
const Category = require("../models/category.model");
const VideoView = require("../models/videoView.model");
const slugify = require("slugify");
const uploadMedia = require("../utils/uploadMedia");
const cloudinary = require("../config/cloudinary");

const {
  createVideoSchema,
  updateVideoSchema,
  uploadVideoSchema,
} = require("../validations/video.validation");

const createVideo = async (req, res) => {
  try {
    // Step 1: Validate the information
    const validationResult = createVideoSchema.safeParse(req.body);

    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validationResult.error.issues,
      });
    }

    const {
      title,
      description,
      videoUrl,
      videoType,
      thumbnail,
      category,
      tags,
    } = validationResult.data;

    // Step 2: Check whether the category exists
    if (category) {
      const categoryExists = await Category.findById(category);

      if (!categoryExists) {
        return res.status(404).json({
          success: false,
          message: "Category not found",
        });
      }
    }

    // Step 3: Generate a slug
    const slug = slugify(title, {
      lower: true,
      strict: true,
    });

    // Step 4: Check for duplicate slugs
    const existingVideo = await Video.findOne({ slug });

    if (existingVideo) {
      return res.status(409).json({
        success: false,
        message: "A video with this title already exists",
      });
    }

    // Step 5: Save the video
    const video = await Video.create({
      title,
      slug,
      description,
      videoUrl,
      videoType,
      thumbnail,
      category: category || null,
      tags: tags || [],
      author: req.user.id,
      status: "draft",
    });

    // Step 6: Return the response
    return res.status(201).json({
      success: true,
      message: "Video created successfully",
      video,
    });

  } catch (error) {
    console.error("Create video error:", error);

    return res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};


const uploadVideo = async (req, res) => {
  let uploadedMedia = null;

  try {
    // Step 1: Validate the video information
    const validationResult = uploadVideoSchema.safeParse(req.body);

    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validationResult.error.issues,
      });
    }

    const {
      title,
      description,
      category,
      tags: tagsText,
    } = validationResult.data;

    // Step 2: Convert comma-separated tags into an array
    const tags = tagsText
      ? tagsText.split(",").map((tag) => tag.trim()).filter(Boolean)
      : [];

    if (tags.length > 10 || tags.some((tag) => tag.length > 30)) {
      return res.status(400).json({
        success: false,
        message: "You can add up to 10 tags, with a maximum of 30 characters each",
      });
    }

    // Step 3: Check whether the category exists
    if (category) {
      const categoryExists = await Category.findById(category);

      if (!categoryExists) {
        return res.status(404).json({
          success: false,
          message: "Category not found",
        });
      }
    }

    // Step 4: Generate a slug
    const slug = slugify(title, {
      lower: true,
      strict: true,
    });

    // Step 5: Check for duplicate video titles
    const existingVideo = await Video.findOne({ slug });

    if (existingVideo) {
      return res.status(409).json({
        success: false,
        message: "A video with this title already exists",
      });
    }

    // Step 6: Upload the video to Cloudinary
    const media = await uploadMedia(
      req.file.buffer,
      "video",
      "blog-platform/videos"
    );

    uploadedMedia = media;

    // Step 7: Save the video details in MongoDB
    const video = await Video.create({
      title,
      slug,
      description: description || "",
      videoUrl: media.url,
      videoPublicId: media.publicId,
      videoType: "upload",
      category: category || null,
      tags,
      author: req.user.id,
      status: "draft",
    });

    // Step 8: Return the response
    return res.status(201).json({
      success: true,
      message: "Video uploaded successfully. It is awaiting admin approval.",
      video,
    });

  } catch (error) {
    console.error("Upload video error:", error);

    // Remove the Cloudinary file if saving the video failed
    if (uploadedMedia?.publicId) {
      try {
        const cloudinary = require("../config/cloudinary");

        await cloudinary.uploader.destroy(
          uploadedMedia.publicId,
          { resource_type: "video" }
        );
      } catch (cleanupError) {
        console.error("Cloudinary cleanup error:", cleanupError);
      }
    }

    return res.status(500).json({
      success: false,
      message: "Failed to upload video",
    });
  }
};


const updateVideo = async (req, res) => {
    try {
        // Step 1: Validate the information
        const validationResult = updateVideoSchema.safeParse(req.body);

        if (!validationResult.success) {
            return res.status(400).json({
                success: false,
                message: "Validation failed",
                errors: validationResult.error.issues,
            });
        }

        const data = validationResult.data;

        // Step 2: Find the video
        const video = await Video.findById(req.params.id);

        if (!video) {
            return res.status(404).json({
                success: false,
                message: "Video not found",
            });
        }

        // Step 3: Update the title and slug
        if (data.title !== undefined) {
            const newSlug = slugify(data.title, {
                lower: true,
                strict: true,
            });

            const existingVideo = await Video.findOne({
                slug: newSlug,
                _id: { $ne: video._id },
            });

            if (existingVideo) {
                return res.status(409).json({
                    success: false,
                    message: "A video with this title already exists",
                });
            }

            video.title = data.title;
            video.slug = newSlug;
        }

        // Step 4: Update the description
        if (data.description !== undefined) {
            video.description = data.description;
        }

        // Step 5: Update the video URL
        if (data.videoUrl !== undefined) {
            video.videoUrl = data.videoUrl;
        }

        // Step 6: Update the video type
        if (data.videoType !== undefined) {
            video.videoType = data.videoType;
        }

        // Step 7: Update the thumbnail
        if (data.thumbnail !== undefined) {
            video.thumbnail = data.thumbnail;
        }

        // Step 8: Update the category
        if (data.category !== undefined) {
            if (data.category === "") {
                video.category = null;
            } else {
                const categoryExists = await Category.findById(data.category);

                if (!categoryExists) {
                    return res.status(404).json({
                        success: false,
                        message: "Category not found",
                    });
                }

                video.category = data.category;
            }
        }

        // Step 9: Update tags
        if (data.tags !== undefined) {
            video.tags = data.tags;
        }

        // Step 10: Update publication status
        if (data.status !== undefined) {
            video.status = data.status;

            if (data.status === "published") {
                if (!video.publishedAt) {
                    video.publishedAt = new Date();
                }
            } else {
                video.publishedAt = null;
            }
        }

        // Step 11: Save changes
        await video.save();

        return res.status(200).json({
            success: true,
            message: "Video updated successfully",
            video,
        });

    } catch (error) {
        console.error("Update video error:", error);

        return res.status(500).json({
            success: false,
            message: "Something went wrong",
        });
    }
};



const deleteVideo = async (req, res) => {
  try {
    // Step 1: Find the video
    const video = await Video.findById(req.params.id);

    // Step 2: Check whether the video exists
    if (!video) {
      return res.status(404).json({
        success: false,
        message: "Video not found",
      });
    }

    // Step 3: Delete the actual video from Cloudinary
    if (video.videoType === "upload" && video.videoPublicId) {
      const cloudinaryResult = await cloudinary.uploader.destroy(
        video.videoPublicId,
        {
          resource_type: "video",
          invalidate: true,
        }
      );

      // Stop if Cloudinary did not confirm deletion
      if (cloudinaryResult.result !== "ok" &&
          cloudinaryResult.result !== "not found") {
        return res.status(502).json({
          success: false,
          message: "Failed to delete video from Cloudinary",
        });
      }
    }

    // Step 4: Delete the video record from MongoDB
    await video.deleteOne();

    // Step 5: Return response
    return res.status(200).json({
      success: true,
      message: "Video deleted successfully",
    });

  } catch (error) {
    console.error("Delete video error:", error);

    return res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};



const getPublishedVideos = async (req, res) => {
    try {
        // Step 1: Pagination
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.min(
            50,
            Math.max(1, parseInt(req.query.limit, 10) || 10)
        );

        const skip = (page - 1) * limit;

        // Step 2: Start with published videos only
        const filter = {
            status: "published",
        };

        // Step 3: Search by title
        if (req.query.search) {
            filter.title = {
                $regex: req.query.search,
                $options: "i",
            };
        }

        // Step 4: Filter by category
        if (req.query.category) {
            filter.category = req.query.category;
        }

        // Step 5: Filter by tag
        if (req.query.tag) {
            filter.tags = {
                $in: [req.query.tag],
            };
        }

        // Step 6: Filter by video type
        if (req.query.videoType) {
            if (!["youtube", "upload"].includes(req.query.videoType)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid video type",
                });
            }

            filter.videoType = req.query.videoType;
        }

        // Step 7: Get videos
        const videos = await Video.find(filter)
            .populate("author", "name avatar")
            .populate("category", "name slug")
            .select("-__v")
            .sort({ publishedAt: -1 })
            .skip(skip)
            .limit(limit);

        // Step 8: Count matching videos
        const totalVideos = await Video.countDocuments(filter);

        // Step 9: Return response
        return res.status(200).json({
            success: true,
            totalVideos,
            currentPage: page,
            totalPages: Math.ceil(totalVideos / limit),
            videos,
        });

    } catch (error) {
        console.error("Get published videos error:", error);

        return res.status(500).json({
            success: false,
            message: "Something went wrong",
        });
    }
};


const getMostViewedVideos = async (req, res) => {
  try {
    // Step 1: Get the requested limit
    const limit = Math.min(
      50,
      Math.max(1, parseInt(req.query.limit, 10) || 10)
    );

    // Step 2: Find published videos and sort by views
    const videos = await Video.find({
      status: "published",
    })
      .populate("author", "name avatar")
      .populate("category", "name slug")
      .select("-__v")
      .sort({ views: -1, publishedAt: -1 })
      .limit(limit);

    // Step 3: Return the videos
    return res.status(200).json({
      success: true,
      totalVideos: videos.length,
      videos,
    });
  } catch (error) {
    console.error("Get most viewed videos error:", error);

    return res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};


const getLeastViewedVideos = async (req, res) => {
  try {
    // Step 1: Get the requested limit
    const limit = Math.min(
      50,
      Math.max(1, parseInt(req.query.limit, 10) || 10)
    );

    // Step 2: Find published videos and sort by views
    const videos = await Video.find({
      status: "published",
    })
      .populate("author", "name avatar")
      .populate("category", "name slug")
      .select("-__v")
      .sort({ views: 1, publishedAt: -1 })
      .limit(limit);

    // Step 3: Return the videos
    return res.status(200).json({
      success: true,
      totalVideos: videos.length,
      videos,
    });
  } catch (error) {
    console.error("Get least viewed videos error:", error);

    return res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};


const getDailyVideoViews = async (req, res) => {
  try {
    // Step 1: Group recorded views by day
    const dailyViews = await VideoView.aggregate([
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$createdAt",
              timezone: "Africa/Lagos",
            },
          },
          totalViews: {
            $sum: 1,
          },
        },
      },

      // Step 2: Arrange dates from oldest to newest
      {
        $sort: {
          _id: 1,
        },
      },
    ]);

    // Step 3: Return the result
    return res.status(200).json({
      success: true,
      message: "Daily video views retrieved successfully",
      dailyViews,
    });
  } catch (error) {
    console.error("Get daily video views error:", error);

    return res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};


const getVideoViewsByDateRange = async (req, res) => {
  try {
    // Step 1: Get dates from the request
    const { startDate, endDate } = req.query;

    // Step 2: Check that both dates were provided
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: "Start date and end date are required",
      });
    }

  
    // Step 3: Validate the date format and actual calendar dates
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;

    const isValidDate = (date) => {
      if (!datePattern.test(date)) {
        return false;
      }

      const [year, month, day] = date.split("-").map(Number);

      const parsedDate = new Date(Date.UTC(year, month - 1, day));

      return (
        parsedDate.getUTCFullYear() === year &&
        parsedDate.getUTCMonth() === month - 1 &&
        parsedDate.getUTCDate() === day
      );
    };

    if (!isValidDate(startDate) || !isValidDate(endDate)) {
      return res.status(400).json({
        success: false,
        message: "Invalid date. Use a valid date in YYYY-MM-DD format",
      });
    }

    // Step 4: Create Nigerian date boundaries
    const start = new Date(`${startDate}T00:00:00+01:00`);
    const end = new Date(`${endDate}T23:59:59.999+01:00`);

    // Step 5: Check that the start date is not after the end date
    if (start > end) {
      return res.status(400).json({
        success: false,
        message: "Start date cannot be after end date",
      });
    }


    // Step 6: Find views within the selected dates
    const views = await VideoView.countDocuments({
      createdAt: {
        $gte: start,
        $lte: end,
      },
    });

    // Step 7: Return the result
    return res.status(200).json({
      success: true,
      message: "Video views retrieved successfully",
      dateRange: {
        startDate,
        endDate,
      },
      totalViews: views,
    });
  } catch (error) {
    console.error("Get video views by date range error:", error);

    return res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};


const getVideoById = async (req, res) => {
    const session = await VideoView.startSession();

    try {
        // Step 1: Start database transaction
        session.startTransaction();

        // Step 2: Find a published video
        const video = await Video.findOne({
            _id: req.params.id,
            status: "published",
        })
            .populate("author", "name avatar")
            .populate("category", "name slug")
            .session(session);

        if (!video) {
            await session.abortTransaction();

            return res.status(404).json({
                success: false,
                message: "Video not found",
            });
        }

        // Step 3: Identify the visitor
        const userId = req.user ? req.user.id : null;

        let shouldIncreaseView = true;

        // Step 4: Check whether this logged-in user
        // has already viewed this video
        if (userId) {
            const existingView = await VideoView.findOne({
                video: video._id,
                user: userId,
            }).session(session);

            if (existingView) {
                shouldIncreaseView = false;
            }
        }

        // Step 5: Record the view
        if (shouldIncreaseView) {
            await VideoView.create(
                [{
                    video: video._id,
                    user: userId,
                }],
                { session }
            );

            // Increase the video's view count
            video.views += 1;

            await video.save({ session });
        }

        // Step 6: Commit transaction
        await session.commitTransaction();

        return res.status(200).json({
            success: true,
            message: "Video retrieved successfully",
            video,
        });

    } catch (error) {
        await session.abortTransaction();

        console.error("Get video error:", error);

        return res.status(500).json({
            success: false,
            message: "Something went wrong",
        });

    } finally {
        await session.endSession();
    }
};


const getVideoStatistics = async (req, res) => {
  try {
    // Get statistics for published videos
    const result = await Video.aggregate([
      {
        $match: {
          status: "published",
        },
      },
      {
        $group: {
          _id: null,
          totalPublishedVideos: { $sum: 1 },
          totalViews: { $sum: "$views" },
          averageViews: { $avg: "$views" },
        },
      },
    ]);

    // Handle the situation where no published videos exist
    const statistics = result[0] || {
      totalPublishedVideos: 0,
      totalViews: 0,
      averageViews: 0,
    };

    return res.status(200).json({
      success: true,
      message: "Video statistics retrieved successfully",
      statistics: {
        totalPublishedVideos: statistics.totalPublishedVideos,
        totalViews: statistics.totalViews,
        averageViews: Math.round(statistics.averageViews * 100) / 100,
      },
    });
  } catch (error) {
    console.error("Get video statistics error:", error);

    return res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};


module.exports = {
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
};