const notFound = (req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
};

const errorHandler = (err, req, res, next) => {
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({
      success: false,
      message: "Invalid JSON request body",
    });
  }

  if (err.type === "entity.too.large") {
    return res.status(413).json({
      success: false,
      message: "Request body is too large. Maximum allowed size is 100kb.",
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