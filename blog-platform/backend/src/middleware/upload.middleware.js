
// const multer = require("multer");
// const allowedTypes = [
//   "image/jpeg",
//   "image/png",
//   "image/webp",
//   "image/gif",
//   "audio/webm",
//   "audio/ogg",
//   "audio/mpeg",
//   "audio/mp4",
//   "audio/wav",
//   "video/webm",
// ];

// const upload = multer({
//   storage: multer.memoryStorage(),

//   limits: {
//     fileSize: 5 * 1024 * 1024,
//     files: 1,
//   },

//  fileFilter: (req, file, callback) => {
//   console.log("Uploaded MIME type:", file.mimetype);

//   const mimeType = file.mimetype.split(";")[0].trim();

//   if (!allowedTypes.includes(mimeType)) {
//     return callback(new Error("File type is not allowed"));
//   }

//   callback(null, true);
// },
// });

// module.exports = upload;

