
const validateVideoFile = async (req, res, next) => {
  try {
    // Check whether a video was uploaded
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Please upload a video file",
      });
    }

    // Read the actual file contents
    const { fileTypeFromBuffer } = await import("file-type");

    const fileType = await fileTypeFromBuffer(req.file.buffer);

    // Allowed video formats
    const allowedExtensions = ["mp4", "webm", "mov"];

    // Reject files that are not genuine videos
    if (!fileType || !allowedExtensions.includes(fileType.ext)) {
      return res.status(400).json({
        success: false,
        message: "Invalid video file. Only MP4, WebM and MOV videos are allowed",
      });
    }

    // Save detected file information
    req.videoFileType = fileType;

    next();
  } catch (error) {
    console.error("Video validation error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to validate video file",
    });
  }
};

module.exports = validateVideoFile;
