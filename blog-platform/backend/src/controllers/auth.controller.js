const User = require("../models/user.model");
const bcrypt = require("bcrypt");
const RefreshToken = require("../models/refreshToken.model");
const jwt = require("jsonwebtoken");
const generateToken = require("../utils/generateToken");
const Verification = require("../models/verification.model");
const generateOtp = require("../utils/generateOtp");
const generateRefreshToken = require("../utils/generateRefreshToken");
const {
  registerSchema,
  loginSchema,
  emailSchema,
  resetPasswordSchema,
  verifyAccountSchema,
} = require("../validations/auth.validation");

const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const validation = registerSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: validation.error.issues[0].message,
      });
    }
    // Check if email already exists
    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "Email already exists",
      });
    }
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create the user
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
    });
    const otp = generateOtp();

    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await Verification.findOneAndUpdate(
      { email },
      {
        email,
        otp,
        expiresAt,
      },
      {
        upsert: true,
        new: true,
      }
    );
    console.log(`Verification OTP for ${email}: ${otp}`);

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const validation = loginSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: validation.error.issues[0].message,
      });
    }

    // Find user
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // Compare password
    const isPasswordCorrect = await bcrypt.compare(
      password,
      user.password
    );

    if (!isPasswordCorrect) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }
    const token = generateToken(user);
    const refreshToken = generateRefreshToken(user);
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    await RefreshToken.create({
      token: refreshToken,
      user: user._id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
    // Login successful
    res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};
const verifyAccount = async (req, res) => {
  try {
    const validation = verifyAccountSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: validation.error.issues[0].message,
      });
    }

    const { email, otp } = validation.data;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: "Email and OTP are required",
      });
    }

    // Find verification record
    const verification = await Verification.findOne({ email });

    if (!verification) {
      return res.status(400).json({
        success: false,
        message: "Verification code not found",
      });
    }

    // Check expiration
    if (verification.expiresAt < new Date()) {
      await Verification.deleteOne({ email });

      return res.status(400).json({
        success: false,
        message: "Verification code has expired",
      });
    }

    // Check OTP
    if (verification.otp !== otp) {
      return res.status(400).json({
        success: false,
        message: "Invalid verification code",
      });
    }

    // Find user
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Verify account
    user.isVerified = true;
    await user.save();

    // Delete OTP after successful verification
    await Verification.deleteOne({ email });

    res.status(200).json({
      success: true,
      message: "Account verified successfully",
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};
const resendOtp = async (req, res) => {
  try {
    const validation = emailSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: validation.error.issues[0].message,
      });
    }

    const { email } = validation.data;

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.isVerified) {
      return res.status(400).json({
        success: false,
        message: "Account is already verified",
      });
    }

    const otp = generateOtp();

    const expiresAt = new Date(
      Date.now() + 10 * 60 * 1000
    );

    await Verification.findOneAndUpdate(
      { email },
      {
        email,
        otp,
        expiresAt,
      },
      {
        upsert: true,
        new: true,
      }
    );

    console.log(`New verification OTP for ${email}: ${otp}`);

    res.status(200).json({
      success: true,
      message: "New verification code sent successfully",
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};
const forgotPassword = async (req, res) => {
  try {
    const validation = emailSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: validation.error.issues[0].message,
      });
    }

    const { email } = validation.data;

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const otp = generateOtp();

    const expiresAt = new Date(
      Date.now() + 10 * 60 * 1000
    );

    await Verification.findOneAndUpdate(
      { email },
      {
        email,
        otp,
        expiresAt,
      },
      {
        upsert: true,
        new: true,
      }
    );

    console.log(`Password reset OTP for ${email}: ${otp}`);

    res.status(200).json({
      success: true,
      message: "Password reset code sent successfully",
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};
const resetPassword = async (req, res) => {
  try {
    const validation = resetPasswordSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: validation.error.issues[0].message,
      });
    }

    const {
      email,
      otp,
      newPassword,
    } = validation.data;

    const verification = await Verification.findOne({ email });

    if (!verification) {
      return res.status(400).json({
        success: false,
        message: "Reset code not found",
      });
    }

    if (verification.expiresAt < new Date()) {
      await Verification.deleteOne({ email });

      return res.status(400).json({
        success: false,
        message: "Reset code has expired",
      });
    }

    if (verification.otp !== otp) {
      return res.status(400).json({
        success: false,
        message: "Invalid reset code",
      });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const hashedPassword = await bcrypt.hash(
      newPassword,
      12
    );

    user.password = hashedPassword;

    await user.save();

    await Verification.deleteOne({ email });

    res.status(200).json({
      success: true,
      message: "Password reset successfully",
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};
const refreshAccessToken = async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: "Refresh token is required",
      });
    }

    // 1. Verify the JWT
    const decoded = jwt.verify(
      refreshToken,
      process.env.JWT_REFRESH_SECRET
    );

    // 2. Check if this refresh token exists in MongoDB
    const storedToken = await RefreshToken.findOne({
      token: refreshToken,
    });

    if (!storedToken) {
      return res.status(401).json({
        success: false,
        message: "Refresh token not found",
      });
    }

    // 3. Check if token has been revoked
    if (storedToken.revoked) {
      return res.status(401).json({
        success: false,
        message: "Refresh token has been revoked",
      });
    }

    // 4. Check if token has expired in the database
    if (storedToken.expiresAt < new Date()) {
      return res.status(401).json({
        success: false,
        message: "Refresh token has expired",
      });
    }

    // 5. Find the user
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User no longer exists",
      });
    }

    // Revoke the old refresh token
    storedToken.revoked = true;
    await storedToken.save();

    const newRefreshToken = generateRefreshToken(user);

    await RefreshToken.create({
      token: newRefreshToken,
      user: user._id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
    res.cookie("refreshToken", newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    // 6. Generate a new access token
    const newAccessToken = generateToken(user);

    return res.status(200).json({
      success: true,
      message: "Access token refreshed successfully",
      token: newAccessToken,
    });
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired refresh token",
    });
  }
};
const logout = async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;

    if (refreshToken) {
      const storedToken = await RefreshToken.findOne({
        token: refreshToken,
      });

      if (storedToken) {
        storedToken.revoked = true;
        await storedToken.save();
      }
    }

    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    });

    return res.status(200).json({
      success: true,
      message: "Logout successful",
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Logout failed",
    });
  }
};
module.exports = {
  register,
  login,
  verifyAccount,
  resendOtp,
  refreshAccessToken,
  forgotPassword,
  resetPassword,
   logout,
};
