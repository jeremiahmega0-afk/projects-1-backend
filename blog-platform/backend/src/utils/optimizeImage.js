
const cloudinary = require("../config/cloudinary");

const optimizeImage = (publicId, options = {}) => {
  const {
    width = 1200,
    height = 1200,
    crop = "limit",
  } = options;

  return cloudinary.url(publicId, {
    secure: true,
    transformation: [
      {
        width,
        height,
        crop,
        quality: "auto",
        fetch_format: "auto",
      },
    ],
  });
};

module.exports = optimizeImage;
