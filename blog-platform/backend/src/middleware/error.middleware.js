
const multer = require("multer");

const notFound = (req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
};

const errorHandler = (err, req, res, next) => {
  // Invalid JSON
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({
      success: false,
      message: "Invalid JSON request body",
    });
  }

  // Request body too large
  if (err.type === "entity.too.large") {
    return res.status(413).json({
      success: false,
      message: "Request body is too large. Maximum allowed size is 100kb.",
    });
  }

  // Multer file upload errors
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({
        success: false,
        message: "File is too large. Please upload a smaller file.",
      });
    }

    if (err.code === "LIMIT_FILE_COUNT") {
      return res.status(400).json({
        success: false,
        message: "Only one file can be uploaded at a time.",
      });
    }

    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }

  // Unsupported file type rejected by Multer
  if (
    err.message === "Only JPG, PNG and WEBP images are allowed"
  ) {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }

  console.error(err);

  return res.status(500).json({
    success: false,
    message: "Something went wrong on the server",
  });
};

module.exports = {
  notFound,
  errorHandler,
};
