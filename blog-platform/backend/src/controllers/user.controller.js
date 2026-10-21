const getProfile = (req, res) => {
  res.status(200).json({
    success: true,
    message: "Profile accessed successfully",
    user: req.user,
  });
};

const getAdminDashboard = (req, res) => {
  res.status(200).json({
    success: true,
    message: "Welcome to the admin dashboard",
    user: req.user,
  });
};

module.exports = {
  getProfile,
  getAdminDashboard,
};