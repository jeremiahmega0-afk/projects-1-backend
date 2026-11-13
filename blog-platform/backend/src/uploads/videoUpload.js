
const multer = require("multer");

const allowedTypes = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
];

const videoUpload = multer({
  storage: multer.memoryStorage(),

  fileFilter: (req, file, callback) => {
    if (!allowedTypes.includes(file.mimetype)) {
      return callback(
        new Error("Only MP4, WebM and MOV videos are allowed")
      );
    }

    callback(null, true);
  },

  limits: {
    fileSize: 100 * 1024 * 1024,
    files: 1,
  },
});

module.exports = videoUpload;
