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
const TwoFactorChallenge = require("../models/TwoFactorChallenge.model");
const { hashOtp } = require("../utils/otp.utils");
const { sendEmail } = require("../utils/email.utils");
const { getDeviceInfo } = require("../utils/device.utils");
const {
  decryptTwoFactorSecret,
} = require("../utils/twoFactor.utils");
const {
  hashRecoveryCode,
} = require("../utils/recoveryCode.utils");
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
        returnDocument: "after",
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
      const challengeId = require("crypto").randomUUID();

      const challengeToken = jwt.sign(
        {
          id: user._id,
          purpose: "2fa-login",
          jti: challengeId,
        },
        process.env.JWT_SECRET,
        {
          expiresIn: "5m",
        }
      );

      // Save the challenge in MongoDB
      await TwoFactorChallenge.create({
        jti: challengeId,
        user: user._id,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      });

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

    // 10. Save hashed refresh token and device information
    const deviceInfo = getDeviceInfo(req);

    await RefreshToken.create({
      token: hashToken(refreshToken),
      user: user._id,
      expiresAt: new Date(
        Date.now() + 7 * 24 * 60 * 60 * 1000
      ),
      device: deviceInfo.device,
      browser: deviceInfo.browser,
      ipAddress: deviceInfo.ipAddress,
      lastUsedAt: new Date(),
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
    const { token, recoveryCode } = req.body;

    const challengeToken =
      req.body.challengeToken ||
      req.cookies?.twoFactorChallenge;

    // 1. The user must provide exactly one verification method
    const hasToken = Boolean(token);
    const hasRecoveryCode = Boolean(recoveryCode);

    if (
      !challengeToken ||
      hasToken === hasRecoveryCode
    ) {
      return res.status(400).json({
        success: false,
        message: "Provide a challenge token and either an authenticator code or recovery code",
      });
    }

    if (hasToken && !/^\d{6}$/.test(String(token))) {
      return res.status(400).json({
        success: false,
        message: "Authenticator code must contain six digits",
      });
    }

    if (
      hasRecoveryCode &&
      !/^[A-Fa-f0-9]{16}$/.test(String(recoveryCode).trim())
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid recovery code format",
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

    if (
      decoded.purpose !== "2fa-login" ||
      !decoded.id ||
      !decoded.jti
    ) {
      return res.status(401).json({
        success: false,
        message: "Invalid login challenge",
      });
    }

    // 3. Check whether the challenge is valid
    const challenge = await TwoFactorChallenge.findOne({
      jti: decoded.jti,
      user: decoded.id,
      used: false,
      expiresAt: { $gt: new Date() },
    });

    if (!challenge) {
      return res.status(401).json({
        success: false,
        message: "Login challenge has expired or has already been used",
      });
    }

    // 4. Find the user and explicitly load recovery-code hashes
    const user = await User.findById(decoded.id).select(
      "+twoFactorRecoveryCodes"
    );

    if (
      !user ||
      !user.twoFactorEnabled ||
      !user.twoFactorSecret
    ) {
      return res.status(401).json({
        success: false,
        message: "Two-factor authentication is not available",
      });
    }

    let verified = false;
    let hashedRecoveryCode = null;

    // 5. Verify using the authenticator app
    if (hasToken) {
      const secret = decryptTwoFactorSecret(
        user.twoFactorSecret
      );

      verified = speakeasy.totp.verify({
        secret,
        encoding: "base32",
        token: String(token),
        window: 1,
      });
    }

    // 6. Or check whether the recovery code exists
    if (hasRecoveryCode) {
      hashedRecoveryCode = hashRecoveryCode(
        String(recoveryCode).trim().toUpperCase()
      );

      verified = user.twoFactorRecoveryCodes.includes(
        hashedRecoveryCode
      );
    }

    if (!verified) {
      return res.status(401).json({
        success: false,
        message: "Invalid authentication or recovery code",
      });
    }

    // 7. Consume the login challenge atomically
    const consumedChallenge =
      await TwoFactorChallenge.findOneAndUpdate(
        {
          jti: decoded.jti,
          user: decoded.id,
          used: false,
          expiresAt: { $gt: new Date() },
        },
        {
          $set: { used: true },
        },
        {
          returnDocument: "after",
        }
      );

    if (!consumedChallenge) {
      return res.status(401).json({
        success: false,
        message: "Login challenge has already been used or expired",
      });
    }

    // 8. Remove the recovery code atomically so it cannot be reused
    if (hasRecoveryCode) {
      const updatedUser = await User.findOneAndUpdate(
        {
          _id: user._id,
          twoFactorEnabled: true,
          twoFactorRecoveryCodes: hashedRecoveryCode,
        },
        {
          $pull: {
            twoFactorRecoveryCodes: hashedRecoveryCode,
          },
        },
        {
          returnDocument: "after",
        }
      );

      if (!updatedUser) {
        return res.status(401).json({
          success: false,
          message: "Recovery code has already been used or is invalid",
        });
      }
    }

    // 9. Generate normal access and refresh tokens
    const accessToken = generateToken(user);
    const refreshToken = generateRefreshToken(user);

    // 10. Set the refresh token cookie
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.clearCookie("twoFactorChallenge", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/api/v1/auth/2fa",
    });

    // Save hashed refresh token and device information
    const deviceInfo = getDeviceInfo(req);

    await RefreshToken.create({
      token: hashToken(refreshToken),
      user: user._id,
      expiresAt: new Date(
        Date.now() + 7 * 24 * 60 * 60 * 1000
      ),
      device: deviceInfo.device,
      browser: deviceInfo.browser,
      ipAddress: deviceInfo.ipAddress,
      lastUsedAt: new Date(),
    });
    // 12. Return successful login
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


const disableTwoFactor = async (req, res) => {
  try {
    const { password, token } = req.body;

    // 1. Check the submitted information
    if (
      !password ||
      !/^\d{6}$/.test(String(token || ""))
    ) {
      return res.status(400).json({
        success: false,
        message: "Password and six-digit code are required",
      });
    }

    // 2. Find the logged-in user
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (!user.twoFactorEnabled || !user.twoFactorSecret) {
      return res.status(400).json({
        success: false,
        message: "Two-factor authentication is not enabled",
      });
    }

    // 3. Check the current password
    const isPasswordCorrect = await bcrypt.compare(
      password,
      user.password
    );

    if (!isPasswordCorrect) {
      return res.status(401).json({
        success: false,
        message: "Incorrect password",
      });
    }

    // 4. Decrypt the 2FA secret
    const secret = decryptTwoFactorSecret(
      user.twoFactorSecret
    );

    // 5. Verify the authenticator code
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

    // 6. Disable 2FA
    user.twoFactorEnabled = false;
    user.twoFactorSecret = null;
    user.twoFactorTempSecret = null;

    await user.save();

    return res.status(200).json({
      success: true,
      message: "Two-factor authentication disabled successfully",
    });

  } catch (error) {
    console.error("Disable 2FA error:", error);

    return res.status(500).json({
      success: false,
      message: "Could not disable two-factor authentication",
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
        returnDocument: "after",
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

    const successMessage =
      "If an account exists with this email, a reset code will be sent.";

    // Do not reveal whether the email exists
    if (!user) {
      return res.status(200).json({
        success: true,
        message: successMessage,
      });
    }

    // Generate OTP
    const otp = generateOtp();

    // Hash OTP before storing
    const hashedOtp = hashOtp(otp);

    const expiresAt = new Date(
      Date.now() + 10 * 60 * 1000
    );

    // Save hashed OTP in MongoDB
    await Verification.findOneAndUpdate(
      { email: user.email },
      {
        email: user.email,
        otp: hashedOtp,
        expiresAt,
      },
      {
        upsert: true,
        returnDocument: "after",
      }
    );

    // Send OTP through Gmail
    try {
      await sendEmail({
        to: user.email,
        subject: "Jerry Blog Platform - Password Reset",
        text: `Your password reset code is ${otp}. It expires in 10 minutes. If you did not request this, ignore this email.`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 500px; margin: auto;">
            <h2>Jerry Blog Platform</h2>
            <h3>Password Reset</h3>
            <p>You requested to reset your password.</p>
            <p>Your verification code is:</p>
            <h1 style="letter-spacing: 5px;">${otp}</h1>
            <p>This code expires in 10 minutes.</p>
            <p>If you did not request this, you can ignore this email.</p>
          </div>
        `,
      });
    } catch (emailError) {
      // Remove the unusable verification record
      await Verification.deleteOne({
        email: user.email,
        otp: hashedOtp,
      });

      console.error(
        "Password reset email delivery failed:",
        emailError.message
      );
    }

    return res.status(200).json({
      success: true,
      message: successMessage,
    });

  } catch (error) {
    console.error("Forgot password error:", error);

    return res.status(500).json({
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

    const submittedOtpHash = hashOtp(otp);

    if (verification.otp !== submittedOtpHash) {
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


    // Save the new refresh token and device information
    const deviceInfo = getDeviceInfo(req);

    await RefreshToken.create({
      token: hashToken(newRefreshToken),
      user: user._id,
      expiresAt: new Date(
        Date.now() + 7 * 24 * 60 * 60 * 1000
      ),
      device: deviceInfo.device,
      browser: deviceInfo.browser,
      ipAddress: deviceInfo.ipAddress,
      lastUsedAt: new Date(),
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


const getActiveSessions = async (req, res) => {
  try {
    const currentRefreshToken = req.cookies?.refreshToken;

    const currentSession = currentRefreshToken
      ? await RefreshToken.findOne({
        token: hashToken(currentRefreshToken),
        user: req.user.id,
        revoked: false,
      }).select("_id")
      : null;

    const sessions = await RefreshToken.find({
      user: req.user.id,
      revoked: false,
      expiresAt: { $gt: new Date() },
    }).select(
      "_id device browser ipAddress lastUsedAt createdAt expiresAt"
    );

    const sessionsWithCurrent = sessions.map((session) => ({
      ...session.toObject(),
      isCurrent: currentSession
        ? session._id.equals(currentSession._id)
        : false,
    }));

    return res.status(200).json({
      success: true,
      message: "Active sessions retrieved successfully",
      sessions: sessionsWithCurrent,
    });
  } catch (error) {
    console.error("Get active sessions error:", error);

    return res.status(500).json({
      success: false,
      message: "Could not retrieve active sessions",
    });
  }
};

const revokeSession = async (req, res) => {
  try {
    const session = await RefreshToken.findOneAndUpdate(
      {
        _id: req.params.sessionId,
        user: req.user.id,
        revoked: false,
        expiresAt: { $gt: new Date() },
      },
      {
        $set: { revoked: true },
      },
      {
        new: true,
      }
    );

    if (!session) {
      return res.status(404).json({
        success: false,
        message: "Active session not found",
      });
    }

    const currentRefreshToken = req.cookies?.refreshToken;

    if (
      currentRefreshToken &&
      session.token === hashToken(currentRefreshToken)
    ) {
      res.clearCookie("refreshToken");
    }

    return res.status(200).json({
      success: true,
      message: "Session revoked successfully",
    });
  } catch (error) {
    console.error("Revoke session error:", error);

    return res.status(500).json({
      success: false,
      message: "Could not revoke session",
    });
  }
};

const logoutOtherDevices = async (req, res) => {
  try {
    const currentRefreshToken = req.cookies?.refreshToken;

    if (!currentRefreshToken) {
      return res.status(401).json({
        success: false,
        message: "Current session not found",
      });
    }

    const currentHashedToken = hashToken(currentRefreshToken);

    const currentSession = await RefreshToken.findOne({
      token: currentHashedToken,
      user: req.user.id,
      revoked: false,
      expiresAt: { $gt: new Date() },
    });

    if (!currentSession) {
      return res.status(401).json({
        success: false,
        message: "Current session is invalid",
      });
    }

    const result = await RefreshToken.updateMany(
      {
        user: req.user.id,
        token: { $ne: currentHashedToken },
        revoked: false,
        expiresAt: { $gt: new Date() },
      },
      {
        $set: { revoked: true },
      }
    );

    return res.status(200).json({
      success: true,
      message: "All other devices logged out successfully",
      sessionsRevoked: result.modifiedCount,
    });
  } catch (error) {
    console.error("Logout other devices error:", error);

    return res.status(500).json({
      success: false,
      message: "Could not log out other devices",
    });
  }
};

const createGoogleTwoFactorChallenge = async (req, res) => {
  try {
    const user = req.user;

    if (!user || !user.twoFactorEnabled) {
      return res.status(400).json({
        success: false,
        message: "Two-factor authentication is not enabled",
      });
    }

    const challengeId = require("crypto").randomUUID();

    const challengeToken = jwt.sign(
      {
        id: user._id,
        purpose: "2fa-login",
        jti: challengeId,
      },
      process.env.JWT_SECRET,
      { expiresIn: "5m" }
    );

    await TwoFactorChallenge.create({
      jti: challengeId,
      user: user._id,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    });

    res.cookie("twoFactorChallenge", challengeToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 5 * 60 * 1000,
      path: "/api/v1/auth/2fa",
    });

    return res.redirect(
      "http://localhost:5173/google-success?requires2FA=true"
    );
  } catch (error) {
    console.error("Google 2FA challenge error:", error);

    return res.redirect("http://localhost:5173/login");
  }
};

module.exports = {
  register,
  login,
  verifyTwoFactorLogin,
  disableTwoFactor,
  verifyAccount,
  resendOtp,
  refreshAccessToken,
  forgotPassword,
  resetPassword,
  changePassword,
  logout,
  logoutAllDevices,
  getActiveSessions,
  revokeSession,
  logoutOtherDevices,
  createGoogleTwoFactorChallenge,
};
