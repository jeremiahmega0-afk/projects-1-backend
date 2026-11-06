
const multer = require("multer");

const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    "audio/mpeg",
    "audio/mp3",
    "audio/wav",
    "audio/ogg",
    "audio/webm",
    "audio/mp4",
    "video/webm",
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only audio files are allowed!"), false);
  }
};

const audioUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 1,
  },
});

// Check the actual file content
const validateAudioFile = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Please upload an audio file",
      });
    }

    const { fileTypeFromBuffer } = await import("file-type");

    const fileType = await fileTypeFromBuffer(req.file.buffer);

    const allowedSignatures = [
      "mp3",
      "wav",
      "ogg",
      "webm",
      "mp4",
    ];

    if (!fileType || !allowedSignatures.includes(fileType.ext)) {
      return res.status(400).json({
        success: false,
        message: "Invalid audio file content",
      });
    }

    req.audioFileType = fileType;

    next();
  } catch (error) {
    console.error("Audio validation error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to validate audio file",
    });
  }
};

module.exports = audioUpload;
module.exports.validateAudioFile = validateAudioFile;
