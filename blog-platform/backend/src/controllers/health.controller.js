const healthCheck = (req, res) => {
  res.status(200).json({
    success: true,
    message: "AI Blog API is healthy",
  });
};

module.exports = {
  healthCheck,
};