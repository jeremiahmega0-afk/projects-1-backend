
const User = require("../models/user.model");
const { updateProfileSchema } = require("../validations/profile.validation");

const getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select(
      "-password"
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Profile accessed successfully",
      user,
    });
  } catch (error) {
    next(error);
  }
};

const getAdminDashboard = (req, res) => {
  res.status(200).json({
    success: true,
    message: "Welcome to the admin dashboard",
    user: req.user,
  });
};

const updateProfile = async (req, res, next) => {
  try {
    // 1. Validate the information sent by the user
    const validation = updateProfileSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: validation.error.issues[0].message,
      });
    }

    // 2. Find the logged-in user in MongoDB
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // 3. Update only the permitted fields
    const { name, bio, avatar } = validation.data;

    if (name !== undefined) user.name = name;
    if (bio !== undefined) user.bio = bio;
    if (avatar !== undefined) user.avatar = avatar;

    // 4. Save the changes
    await user.save();

    // 5. Return the updated profile without the password
    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        bio: user.bio,
        role: user.role,
        isVerified: user.isVerified,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  } catch (error) {
    next(error);
  }
};


module.exports = {
  getProfile,
  getAdminDashboard,
  updateProfile,
};
