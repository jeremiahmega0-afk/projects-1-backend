
const multer = require("multer");

const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB maximum
    files: 1,
  },

  fileFilter: (req, file, callback) => {
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
      "audio/webm",
      "audio/ogg",
      "audio/mpeg",
      "audio/mp4",
      "audio/wav",
    ];

    if (!allowedTypes.includes(file.mimetype)) {
      return callback(
        new Error("File type is not allowed")
      );
    }

    callback(null, true);
  },
});

module.exports = upload;
