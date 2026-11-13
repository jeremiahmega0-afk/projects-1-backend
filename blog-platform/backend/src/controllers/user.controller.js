
const mongoose = require("mongoose");
const User = require("../models/user.model");
const { updateProfileSchema } = require("../validations/profile.validation");
const uploadMedia = require("../utils/uploadMedia");
const cloudinary = require("../config/cloudinary");
const optimizeImage = require("../utils/optimizeImage");

const getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select(
      "-password -failedLoginAttempts -lockUntil -__v"
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
const getPublicProfile = async (req, res, next) => {
  try {
    // 1. Get the user ID from the URL
    const { id } = req.params;

    // 2. Check whether the ID is valid
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
    }

    // 3. Find only verified users
    const user = await User.findOne({
      _id: id,
      isVerified: true,
    }).select("name username avatar bio createdAt");

    // 4. Check whether the user exists
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // 5. Return public information
    return res.status(200).json({
      success: true,
      message: "Public profile retrieved successfully",
      user,
    });
  } catch (error) {
    next(error);
  }
};
const getPublicProfileByUsername = async (req, res, next) => {
  try {
    const username = req.params.username.toLowerCase();

    const user = await User.findOne({
      username,
      isVerified: true,
    }).select("name username avatar bio createdAt");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Public profile retrieved successfully",
      user,
    });
  } catch (error) {
    next(error);
  }
};


const uploadProfilePicture = async (req, res, next) => {
  let uploadedMedia = null;

  try {
    // 1. Find the logged-in user
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // 2. Upload the new image to Cloudinary
    const media = await uploadMedia(
      req.file.buffer,
      "image",
      "blog-platform/profile-pictures"
    );

    uploadedMedia = media;

    // 3. Remember the old Cloudinary image ID
    const oldAvatarPublicId = user.avatarPublicId;

    // 4. Save the new image URL and public ID
    user.avatar = media.url;
    user.avatarPublicId = media.publicId;

    await user.save();

    // 5. Delete the previous image after the new one is saved
    if (oldAvatarPublicId) {
      try {
        await cloudinary.uploader.destroy(oldAvatarPublicId, {
          resource_type: "image",
          invalidate: true,
        });
      } catch (cleanupError) {
        console.error(
          "Old profile picture cleanup error:",
          cleanupError
        );
      }
    }

    // 6. Return the updated profile
    return res.status(200).json({
      success: true,
      message: "Profile picture uploaded successfully",
      user: {
        id: user._id,
        name: user.name,
        username: user.username,
        avatar: optimizeImage(user.avatarPublicId, {
          width: 400,
          height: 400,
          crop: "fill",
        }),
        bio: user.bio,
      },
    });
  } catch (error) {
    // 7. Delete the new Cloudinary image if saving failed
    if (uploadedMedia?.publicId) {
      try {
        await cloudinary.uploader.destroy(uploadedMedia.publicId, {
          resource_type: "image",
        });
      } catch (cleanupError) {
        console.error("New profile picture cleanup error:", cleanupError);
      }
    }

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
    const { name, bio, avatar, username } = validation.data;

    if (name !== undefined) user.name = name;
    if (bio !== undefined) user.bio = bio;
    if (avatar !== undefined) user.avatar = avatar;
    if (username !== undefined) user.username = username;

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
        username: user.username,
        avatar: user.avatar,
        bio: user.bio,
        role: user.role,
        isVerified: user.isVerified,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  } catch (error) {
    if (
      error.code === 11000 &&
      (error.keyPattern?.username || error.keyValue?.username)
    ) {
      return res.status(409).json({
        success: false,
        message: "Username is already taken",
      });
    }

    next(error);
  }
};

module.exports = {
  getProfile,
  getAdminDashboard,
  updateProfile,
  getPublicProfile,
  getPublicProfileByUsername,
  uploadProfilePicture,
};
