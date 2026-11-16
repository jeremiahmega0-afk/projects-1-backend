const User = require("../models/user.model");
const bcrypt = require("bcrypt");
const RefreshToken = require("../models/refreshToken.model");
const jwt = require("jsonwebtoken");
const generateToken = require("../utils/generateToken");
const Verification = require("../models/verification.model");
const generateOtp = require("../utils/generateOtp");
const generateRefreshToken = require("../utils/generateRefreshToken");
const hashToken = require("../utils/hashToken");
const speakeasy = require("speakeasy");

const {
  decryptTwoFactorSecret,
} = require("../utils/twoFactor.utils");
const {
  registerSchema,
  loginSchema,
  emailSchema,
  resetPasswordSchema,
  verifyAccountSchema,
   changePasswordSchema,
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
    // 1. Validate the login information
    const validation = loginSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: validation.error.issues[0].message,
      });
    }

    const email = validation.data.email.trim().toLowerCase();
    const password = validation.data.password;

    // 2. Find the user
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // 3. Check whether the account is locked
    const now = new Date();

    if (user.lockUntil && user.lockUntil > now) {
      const remainingMinutes = Math.ceil(
        (user.lockUntil - now) / (60 * 1000)
      );

      return res.status(423).json({
        success: false,
        message: `Account temporarily locked. Try again in ${remainingMinutes} minute(s).`,
      });
    }

    // 4. Reset expired lockout
    if (user.lockUntil && user.lockUntil <= now) {
      user.failedLoginAttempts = 0;
      user.lockUntil = null;
    }

    // 5. Compare the password
    const isPasswordCorrect = await bcrypt.compare(
      password,
      user.password
    );

    // 6. Handle incorrect password
    if (!isPasswordCorrect) {
      user.failedLoginAttempts += 1;

      // Lock account after 5 failed attempts
      if (user.failedLoginAttempts >= 5) {
        user.lockUntil = new Date(
          Date.now() + 15 * 60 * 1000
        );

        await user.save();

        return res.status(423).json({
          success: false,
          message: "Too many failed attempts. Account locked for 15 minutes.",
        });
      }

      await user.save();

      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
        remainingAttempts: 5 - user.failedLoginAttempts,
      });
    }

    // 7. Reset failed attempts after successful login
    user.failedLoginAttempts = 0;
    user.lockUntil = null;
    await user.save();


    // 7A. Check whether the user has enabled 2FA
    if (user.twoFactorEnabled) {
      const challengeToken = jwt.sign(
        {
          id: user._id,
          purpose: "2fa-login",
        },
        process.env.JWT_SECRET,
        {
          expiresIn: "5m",
        }
      );

      return res.status(200).json({
        success: true,
        twoFactorRequired: true,
        message: "Enter your six-digit authentication code",
        challengeToken,
      });
    }


    // 8. Generate access and refresh tokens
    const token = generateToken(user);
    const refreshToken = generateRefreshToken(user);

    // 9. Set refresh token cookie
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    // 10. Save hashed refresh token
    await RefreshToken.create({
      token: hashToken(refreshToken),
      user: user._id,
      expiresAt: new Date(
        Date.now() + 7 * 24 * 60 * 60 * 1000
      ),
    });

    // 11. Return successful login
    return res.status(200).json({
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

    return res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};


const verifyTwoFactorLogin = async (req, res) => {
  try {
    const { challengeToken, token } = req.body;

    // 1. Check the submitted information
    if (
      !challengeToken ||
      !/^\d{6}$/.test(String(token || ""))
    ) {
      return res.status(400).json({
        success: false,
        message: "Challenge token and six-digit code are required",
      });
    }

    // 2. Verify the temporary login challenge
    let decoded;

    try {
      decoded = jwt.verify(
        challengeToken,
        process.env.JWT_SECRET
      );
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired login challenge",
      });
    }

    if (decoded.purpose !== "2fa-login" || !decoded.id) {
      return res.status(401).json({
        success: false,
        message: "Invalid login challenge",
      });
    }

    // 3. Find the user
    const user = await User.findById(decoded.id);

    if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
      return res.status(401).json({
        success: false,
        message: "Two-factor authentication is not available",
      });
    }

    // 4. Decrypt the user's 2FA secret
    const secret = decryptTwoFactorSecret(
      user.twoFactorSecret
    );

    // 5. Verify the six-digit code
    const verified = speakeasy.totp.verify({
      secret,
      encoding: "base32",
      token: String(token),
      window: 1,
    });

    if (!verified) {
      return res.status(401).json({
        success: false,
        message: "Invalid authentication code",
      });
    }

    // 6. Generate normal access and refresh tokens
    const accessToken = generateToken(user);
    const refreshToken = generateRefreshToken(user);

    // 7. Set the refresh token cookie
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    // 8. Save the hashed refresh token
    await RefreshToken.create({
      token: hashToken(refreshToken),
      user: user._id,
      expiresAt: new Date(
        Date.now() + 7 * 24 * 60 * 60 * 1000
      ),
    });

    // 9. Return successful login
    return res.status(200).json({
      success: true,
      message: "Login successful",
      token: accessToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });

  } catch (error) {
    console.error("2FA login error:", error);

    return res.status(500).json({
      success: false,
      message: "Could not complete login",
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

// Revoke all refresh tokens for this user
await RefreshToken.updateMany(
  {
    user: user._id,
    revoked: false,
  },
  {
    $set: { revoked: true },
  }
);

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

const changePassword = async (req, res) => {
  try {
    const validation = changePasswordSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: validation.error.issues[0].message,
      });
    }

    const { currentPassword, newPassword } = validation.data;

    // Find the logged-in user
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Verify the current password
    const isPasswordCorrect = await bcrypt.compare(
      currentPassword,
      user.password
    );

    if (!isPasswordCorrect) {
      return res.status(401).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    // Prevent changing to the same password
    const isSamePassword = await bcrypt.compare(
      newPassword,
      user.password
    );

    if (isSamePassword) {
      return res.status(400).json({
        success: false,
        message: "New password must be different",
      });
    }

    // Hash and save the new password
    user.password = await bcrypt.hash(newPassword, 12);
    await user.save();

    // Revoke all active refresh tokens for this user
    await RefreshToken.updateMany(
      {
        user: user._id,
        revoked: false,
      },
      {
        $set: { revoked: true },
      }
    );

    // Clear this browser's refresh-token cookie
    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    });

    return res.status(200).json({
      success: true,
      message: "Password changed successfully. Please log in again.",
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
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

    const storedToken = await RefreshToken.findOne({
  token: hashToken(refreshToken),
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

   const revokedToken = await RefreshToken.findOneAndUpdate(
  {
    _id: storedToken._id,
    revoked: false,
    expiresAt: { $gt: new Date() },
  },
  {
    $set: { revoked: true },
  },
  {
      returnDocument: "before",
  }
);

if (!revokedToken) {
  return res.status(401).json({
    success: false,
    message: "Refresh token has already been used or expired",
  });
}

    const newRefreshToken = generateRefreshToken(user);

   
await RefreshToken.create({
  token: hashToken(newRefreshToken),
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

    
await RefreshToken.findOneAndUpdate(
  {
    token: hashToken(refreshToken),
    revoked: false,
  },
  {
    $set: { revoked: true },
  }
);


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


const logoutAllDevices = async (req, res) => {
  try {
    // Find the logged-in user
    const userId = req.user.id;

    // Revoke every active refresh token belonging to this user
    const result = await RefreshToken.updateMany(
      {
        user: userId,
        revoked: false,
      },
      {
        $set: { revoked: true },
      }
    );

    // Clear the current device's refresh-token cookie
    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    });

    return res.status(200).json({
      success: true,
      message: "Logged out from all devices successfully",
      sessionsRevoked: result.modifiedCount,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Failed to log out from all devices",
    });
  }
};


module.exports = {
  register,
  login,
   verifyTwoFactorLogin,
  verifyAccount,
  resendOtp,
  refreshAccessToken,
  forgotPassword,
  resetPassword,
  changePassword,
   logout,
   logoutAllDevices,
};
