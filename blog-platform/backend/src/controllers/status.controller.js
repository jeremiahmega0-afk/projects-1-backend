const getStatus = async (req, res) => {
  res.status(200).json({
     "success": true,
  "status": "online",
  "message": "AI Blog Platform is working perfectly"
  });
};

module.exports = {
  getStatus,
};