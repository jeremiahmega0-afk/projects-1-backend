
const validateProfileImage = async (req, res, next) => {
  try {
    // Check whether the user selected an image
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Please upload a profile image",
      });
    }

    // Check the actual file content
    const { fileTypeFromBuffer } = await import("file-type");

    const fileType = await fileTypeFromBuffer(req.file.buffer);

    const allowedExtensions = ["jpg", "png", "webp"];

    if (!fileType || !allowedExtensions.includes(fileType.ext)) {
      return res.status(400).json({
        success: false,
        message: "Invalid image. Only JPG, PNG and WEBP images are allowed",
      });
    }

    // Continue if the image is valid
    req.profileImageFileType = fileType;

    next();
  } catch (error) {
    console.error("Profile image validation error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to validate profile image",
    });
  }
};

module.exports = validateProfileImage;
