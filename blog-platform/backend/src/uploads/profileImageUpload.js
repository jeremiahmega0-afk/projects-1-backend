
const multer = require("multer");

const allowedTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

const profileImageUpload = multer({
  storage: multer.memoryStorage(),

  fileFilter: (req, file, callback) => {
    if (!allowedTypes.includes(file.mimetype)) {
      return callback(
        new Error("Only JPG, PNG and WEBP images are allowed")
      );
    }

    callback(null, true);
  },

  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
  },
});

module.exports = profileImageUpload;
