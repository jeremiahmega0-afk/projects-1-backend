const mongoose = require("mongoose");
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

    const hashedOtp = hashOtp(otp);

    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await Verification.findOneAndUpdate(
      { email },
      {
        email,
        otp: hashedOtp,
        purpose: "register",
        attempts: 0,
        expiresAt,
      },
      {
        upsert: true,
        returnDocument: "after",
        runValidators: true,
      }
    );

    try {
      await sendEmail({
        to: user.email,
        subject: "Jerry Blog Platform - Verify Your Email",
        text: `Welcome to Jerry Blog Platform! Your email verification code is ${otp}. It expires in 10 minutes. Never share this code with anyone.`,
        html: `
    <!DOCTYPE html>
    <html lang="en">
    <body style="margin:0;padding:30px;background:#f3f4f6;font-family:Arial,sans-serif;">
      <div style="max-width:500px;margin:auto;background:#ffffff;padding:30px;border-radius:12px;text-align:center;">
        <h1 style="color:#4f46e5;">Jerry Blog Platform</h1>

        <h2>Verify your email address</h2>

        <p>Welcome! Thank you for creating an account.</p>

        <p>Use the verification code below to activate your account:</p>

        <h1 style="color:#4338ca;letter-spacing:10px;background:#eef2ff;padding:20px;border-radius:8px;">
          ${otp}
        </h1>

        <p>This code expires in <strong>10 minutes</strong>.</p>

        <p style="color:#dc2626;">
          Never share this code with anyone.
        </p>

        <p style="font-size:12px;color:#9ca3af;">
          &copy; ${new Date().getFullYear()} Jerry Blog Platform.
          All rights reserved.
        </p>
      </div>
    </body>
    </html>
  `,
      });
    } catch (emailError) {
      await Verification.deleteOne({
        email,
        purpose: "register",
        otp: hashedOtp,
      });

      throw emailError;
    }

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

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "An account with this email or username already exists",
      });
    }

    res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};


const login = async (req, res) => {
  let session;

  try {
    // 1. Validate login information
    const validation = loginSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: validation.error.issues[0].message,
      });
    }

    const email = validation.data.email.trim().toLowerCase();
    const password = validation.data.password;

    // 2. Find user
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // 3. Check account lock
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

    // 4. Reset expired lock
    if (user.lockUntil && user.lockUntil <= now) {
      user.failedLoginAttempts = 0;
      user.lockUntil = null;
    }

    // 5. Check password
    const isPasswordCorrect = await bcrypt.compare(
      password,
      user.password
    );

    if (!isPasswordCorrect) {
      const updatedUser = await User.findOneAndUpdate(
        { _id: user._id },
        { $inc: { failedLoginAttempts: 1 } },
        { returnDocument: "after" }
      );

      if (updatedUser.failedLoginAttempts >= 5) {
        const lockUntil = new Date(
          Date.now() + 15 * 60 * 1000
        );

        await User.updateOne(
          {
            _id: user._id,
            failedLoginAttempts: { $gte: 5 },
            $or: [
              { lockUntil: null },
              { lockUntil: { $lte: new Date() } },
            ],
          },
          { $set: { lockUntil } }
        );

        return res.status(423).json({
          success: false,
          message: "Too many failed attempts. Account locked for 15 minutes.",
        });
      }

      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
        remainingAttempts: 5 - updatedUser.failedLoginAttempts,
      });
    }

    // 6. Reset failed attempts
    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          failedLoginAttempts: 0,
          lockUntil: null,
        },
      }
    );

    // 7. Check 2FA
    if (user.twoFactorEnabled) {
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

      return res.status(200).json({
        success: true,
        twoFactorRequired: true,
        message: "Enter your six-digit authentication code",
        challengeToken,
      });
    }

    // 8. Generate tokens
    const token = generateToken(user);
    const refreshToken = generateRefreshToken(user);
    const deviceInfo = getDeviceInfo(req);

    const expiresAt = new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000
    );

    // 9. Save refresh token in a transaction
    session = await mongoose.startSession();

    await session.withTransaction(async () => {
      await RefreshToken.create(
        [
          {
            token: hashToken(refreshToken),
            user: user._id,
            expiresAt,
            device: deviceInfo.device,
            browser: deviceInfo.browser,
            ipAddress: deviceInfo.ipAddress,
            lastUsedAt: new Date(),
          },
        ],
        { session }
      );
    });

    // 10. Set cookie only after successful database save
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: "/",
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
    console.error("Login error:", error);

    if (
      error.name === "MongoServerSelectionError" ||
      error.name === "MongoNetworkError"
    ) {
      return res.status(503).json({
        success: false,
        message: "Database temporarily unavailable. Please try again shortly.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Something went wrong",
    });

  } finally {
    if (session) {
      await session.endSession();
    }
  }
};

const verifyTwoFactorLogin = async (req, res) => {
  let session;

  try {
    const { token, recoveryCode } = req.body;

    const challengeToken =
      req.body.challengeToken ||
      req.cookies?.twoFactorChallenge;

    const hasToken = Boolean(token);
    const hasRecoveryCode = Boolean(recoveryCode);

    if (!challengeToken || hasToken === hasRecoveryCode) {
      return res.status(400).json({
        success: false,
        message:
          "Provide a challenge token and either an authenticator code or recovery code",
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

    // Verify the temporary login challenge
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

    // Find the user
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

    // Verify the authentication method
    let verified = false;
    let hashedRecoveryCode = null;

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

    // Prepare tokens and device information
    const accessToken = generateToken(user);
    const refreshToken = generateRefreshToken(user);
    const deviceInfo = getDeviceInfo(req);

    const expiresAt = new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000
    );

    // Start MongoDB transaction
    session = await mongoose.startSession();

    await session.withTransaction(async () => {
      // Consume challenge
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
            session,
          }
        );

      if (!consumedChallenge) {
        throw new Error("LOGIN_CHALLENGE_INVALID");
      }

      // Consume recovery code if used
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
            session,
          }
        );

        if (!updatedUser) {
          throw new Error("RECOVERY_CODE_INVALID");
        }
      }

      // Save refresh token
      await RefreshToken.create(
        [
          {
            token: hashToken(refreshToken),
            user: user._id,
            expiresAt,
            device: deviceInfo.device,
            browser: deviceInfo.browser,
            ipAddress: deviceInfo.ipAddress,
            lastUsedAt: new Date(),
          },
        ],
        { session }
      );
    });

    // Send cookies only after transaction succeeds
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
    if (
      error.message === "LOGIN_CHALLENGE_INVALID" ||
      error.message === "RECOVERY_CODE_INVALID"
    ) {
      return res.status(401).json({
        success: false,
        message:
          error.message === "LOGIN_CHALLENGE_INVALID"
            ? "Login challenge has already been used or expired"
            : "Recovery code has already been used or is invalid",
      });
    }

    console.error("2FA login error:", error);

    return res.status(500).json({
      success: false,
      message: "Could not complete login",
    });
  } finally {
    if (session) {
      await session.endSession();
    }
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


    // 6. Disable 2FA and clear recovery codes
    user.twoFactorEnabled = false;
    user.twoFactorSecret = null;
    user.twoFactorTempSecret = null;
    user.twoFactorRecoveryCodes = [];

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
    const verification = await Verification.findOne({
      email,
      purpose: "register",
    });
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
    // Check maximum attempts
    if (verification.attempts >= 5) {
      await Verification.deleteOne({
        _id: verification._id,
      });

      return res.status(429).json({
        success: false,
        message: "Too many incorrect attempts. Request a new verification code.",
      });
    }

    // Check OTP
    if (verification.otp !== hashOtp(otp)) {
      const updatedVerification = await Verification.findOneAndUpdate(
        {
          _id: verification._id,
          purpose: "register",
          attempts: { $lt: 5 },
        },
        {
          $inc: { attempts: 1 },
        },
        {
          returnDocument: "after",
        }
      );

      if (updatedVerification && updatedVerification.attempts >= 5) {
        await Verification.deleteOne({
          _id: verification._id,
        });

        return res.status(429).json({
          success: false,
          message: "Too many incorrect attempts. Request a new verification code.",
        });
      }

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

    // Atomically consume the OTP
    const consumedOtp = await Verification.findOneAndDelete({
      _id: verification._id,
      email,
      purpose: "register",
      otp: hashOtp(otp),
      attempts: { $lt: 5 },
      expiresAt: { $gt: new Date() },
    });

    // Stop if another request already consumed the OTP
    if (!consumedOtp) {
      return res.status(400).json({
        success: false,
        message: "Verification code is no longer valid or has already been used",
      });
    }

    // Verify account
    user.isVerified = true;
    await user.save();

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

    if (!user || user.isVerified) {
      return res.status(200).json({
        success: true,
        message:
          "If an unverified account exists with this email, a verification code will be sent.",
      });
    }

    const otp = generateOtp();

    const hashedOtp = hashOtp(otp);

    const expiresAt = new Date(
      Date.now() + 10 * 60 * 1000
    );

    await Verification.findOneAndUpdate(
      { email },
      {
        email,
        otp: hashedOtp,
        purpose: "register",
        attempts: 0,
        expiresAt,
      },
      {
        upsert: true,
        returnDocument: "after",
        runValidators: true,
      }
    );
    try {
      await sendEmail({
        to: user.email,
        subject: "Jerry Blog Platform - New Verification Code",
        text: `Your new email verification code is ${otp}. It expires in 10 minutes. Never share this code with anyone.`,
        html: `
    <!DOCTYPE html>
    <html lang="en">
    <body style="margin:0;padding:30px;background:#f3f4f6;font-family:Arial,sans-serif;">
      <div style="max-width:500px;margin:auto;background:#ffffff;padding:30px;border-radius:12px;text-align:center;">
        <h1 style="color:#4f46e5;">Jerry Blog Platform</h1>
        <h2>New verification code</h2>
        <p>Use this code to verify your email address:</p>
        <h1 style="color:#4338ca;letter-spacing:10px;background:#eef2ff;padding:20px;border-radius:8px;">
          ${otp}
        </h1>
        <p>This code expires in <strong>10 minutes</strong>.</p>
        <p style="color:#dc2626;">Never share this code with anyone.</p>
        <p style="font-size:12px;color:#9ca3af;">
          &copy; ${new Date().getFullYear()} Jerry Blog Platform.
        </p>
      </div>
    </body>
    </html>
  `,
      });
    } catch (emailError) {
      await Verification.deleteOne({
        email,
        purpose: "register",
        otp: hashedOtp,
      });

      throw emailError;
    }


    res.status(200).json({
      success: true,
      message:
        "If an unverified account exists with this email, a verification code will be sent.",
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
        purpose: "password-reset",
        attempts: 0,
        expiresAt,
      },
      {
        upsert: true,
        returnDocument: "after",
        runValidators: true,
      }
    );

    // Send OTP through Gmail
    try {
      await sendEmail({
        to: user.email,
        subject: "Jerry Blog Platform - Password Reset",
        text: `Your password reset code is ${otp}. It expires in 10 minutes. If you did not request this, ignore this email.`,
        html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light only" />
  <title>Password Reset</title>
</head>
<body style="margin:0; padding:0; background-color:#f3f4f6; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">

  <!-- Preheader (inbox preview text) -->
  <div style="display:none; max-height:0; overflow:hidden; opacity:0; color:#f3f4f6;">
    Your Jerry Blog Platform verification code is ${otp}. It expires in 10 minutes.
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f3f4f6; padding:32px 16px;">
    <tr>
      <td align="center">

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px; background-color:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,0.06);">

          <!-- Header -->
          <tr>
            <td align="center" style="background-color:#4f46e5; padding:28px 24px;">
              <h1 style="margin:0; font-size:22px; font-weight:700; color:#ffffff; letter-spacing:0.5px;">
                Jerry Blog Platform
              </h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 32px 12px 32px; color:#374151;">
              <h2 style="margin:0 0 12px 0; font-size:20px; color:#111827;">Reset your password</h2>
              <p style="margin:0 0 8px 0; font-size:15px; line-height:1.6; color:#4b5563;">
                We received a request to reset your password. Use the verification code below to continue:
              </p>
            </td>
          </tr>

          <!-- OTP box -->
          <tr>
            <td align="center" style="padding:16px 32px;">
              <div style="display:inline-block; background-color:#eef2ff; border:2px dashed #818cf8; border-radius:10px; padding:18px 32px;">
                <span style="font-family:'Courier New', Courier, monospace; font-size:34px; font-weight:700; letter-spacing:10px; color:#4338ca; padding-left:10px;">
                  ${otp}
                </span>
              </div>
            </td>
          </tr>

          <!-- Expiry note -->
          <tr>
            <td align="center" style="padding:4px 32px 24px 32px;">
              <p style="margin:0; font-size:14px; color:#6b7280;">
                This code expires in <strong style="color:#111827;">10 minutes</strong>.
              </p>
            </td>
          </tr>

          <!-- Security note -->
          <tr>
            <td style="padding:0 32px 32px 32px;">
              <div style="background-color:#fef9c3; border-left:4px solid #eab308; border-radius:6px; padding:12px 16px;">
                <p style="margin:0; font-size:13px; line-height:1.5; color:#713f12;">
                  If you didn't request this, you can safely ignore this email. Never share this code with anyone.
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="background-color:#f9fafb; padding:20px 32px; border-top:1px solid #e5e7eb;">
              <p style="margin:0; font-size:12px; color:#9ca3af; line-height:1.5;">
                &copy; ${new Date().getFullYear()} Jerry Blog Platform. All rights reserved.<br />
                This is an automated message, please do not reply.
              </p>
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>
</body>
</html>
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
  let session;

  try {
    const validation = resetPasswordSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: validation.error.issues[0].message,
      });
    }

    const { email, otp, newPassword } = validation.data;
    const submittedOtpHash = hashOtp(otp);

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    session = await mongoose.startSession();

    let result = null;

    await session.withTransaction(async () => {
      const verification = await Verification.findOne({
        email,
        purpose: "password-reset",
      }).session(session);

      if (!verification) {
        result = {
          status: 400,
          message: "Reset code not found",
        };
        return;
      }

      if (verification.expiresAt <= new Date()) {
        await Verification.deleteOne(
          { _id: verification._id },
          { session }
        );

        result = {
          status: 400,
          message: "Reset code has expired",
        };
        return;
      }

      if (verification.attempts >= 5) {
        await Verification.deleteOne(
          { _id: verification._id },
          { session }
        );

        result = {
          status: 429,
          message: "Too many incorrect attempts. Request a new reset code.",
        };
        return;
      }

      if (verification.otp !== submittedOtpHash) {
        const updatedVerification = await Verification.findOneAndUpdate(
          {
            _id: verification._id,
            purpose: "password-reset",
            attempts: { $lt: 5 },
            expiresAt: { $gt: new Date() },
          },
          {
            $inc: { attempts: 1 },
          },
          {
            returnDocument: "after",
            session,
          }
        );

        if (!updatedVerification) {
          result = {
            status: 400,
            message: "Reset code is invalid, expired, or already used",
          };
          return;
        }

        if (updatedVerification.attempts >= 5) {
          await Verification.deleteOne(
            { _id: verification._id },
            { session }
          );

          result = {
            status: 429,
            message: "Too many incorrect attempts. Request a new reset code.",
          };
          return;
        }

        result = {
          status: 400,
          message: "Invalid reset code",
        };
        return;
      }

      const user = await User.findOne({ email }).session(session);

      if (!user) {
        result = {
          status: 404,
          message: "User not found",
        };
        return;
      }

      // Consume the OTP exactly once
      const consumedVerification = await Verification.findOneAndDelete(
        {
          _id: verification._id,
          email,
          purpose: "password-reset",
          otp: submittedOtpHash,
          attempts: { $lt: 5 },
          expiresAt: { $gt: new Date() },
        },
        { session }
      );

      if (!consumedVerification) {
        result = {
          status: 400,
          message: "Reset code is invalid, expired, or already used",
        };
        return;
      }

      // Save the new password
      user.password = hashedPassword;
      await user.save({ session });

      // Revoke all active refresh tokens
      await RefreshToken.updateMany(
        {
          user: user._id,
          revoked: false,
        },
        {
          $set: { revoked: true },
        },
        { session }
      );

      result = {
        status: 200,
        success: true,
        message: "Password reset successfully",
      };
    });

    if (!result) {
      return res.status(500).json({
        success: false,
        message: "Password reset could not be completed",
      });
    }

    return res.status(result.status).json({
      success: result.success || false,
      message: result.message,
    });

  } catch (error) {
    console.error("Password reset error:", error);

    return res.status(500).json({
      success: false,
      message: "Something went wrong",
    });

  } finally {
    if (session) {
      await session.endSession();
    }
  }
};



const changePassword = async (req, res) => {
  let session;

  try {
    const validation = changePasswordSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: validation.error.issues[0].message,
      });
    }

    const { currentPassword, newPassword } = validation.data;

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    session = await mongoose.startSession();

    let result = null;

    await session.withTransaction(async () => {
      // Find the user inside the transaction
      const user = await User.findById(req.user.id).session(session);

      if (!user) {
        result = {
          status: 404,
          message: "User not found",
        };
        return;
      }

      // Verify current password
      const isPasswordCorrect = await bcrypt.compare(
        currentPassword,
        user.password
      );

      if (!isPasswordCorrect) {
        result = {
          status: 401,
          message: "Current password is incorrect",
        };
        return;
      }

      // Prevent reusing the same password
      const isSamePassword = await bcrypt.compare(
        newPassword,
        user.password
      );

      if (isSamePassword) {
        result = {
          status: 400,
          message: "New password must be different",
        };
        return;
      }

      // Save the new password
      user.password = hashedPassword;
      await user.save({ session });

      // Revoke all active refresh tokens
      await RefreshToken.updateMany(
        {
          user: user._id,
          revoked: false,
        },
        {
          $set: { revoked: true },
        },
        { session }
      );

      result = {
        status: 200,
        success: true,
        message: "Password changed successfully. Please log in again.",
      };
    });

    if (!result) {
      return res.status(500).json({
        success: false,
        message: "Password change could not be completed",
      });
    }

    if (result.success) {
      res.clearCookie("refreshToken", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
      });
    }

    return res.status(result.status).json({
      success: result.success || false,
      message: result.message,
    });

  } catch (error) {
    console.error("Change password error:", error);

    return res.status(500).json({
      success: false,
      message: "Something went wrong",
    });

  } finally {
    if (session) {
      await session.endSession();
    }
  }
};



const refreshAccessToken = async (req, res) => {
  let session;

  try {
    const refreshToken = req.cookies?.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: "Refresh token is required",
      });
    }

    // 1. Verify the refresh-token JWT
    const decoded = jwt.verify(
      refreshToken,
      process.env.JWT_REFRESH_SECRET
    );

    if (!decoded.id) {
      return res.status(401).json({
        success: false,
        message: "Invalid refresh token",
      });
    }

    // 2. Find the hashed refresh token in MongoDB
    const storedToken = await RefreshToken.findOne({
      token: hashToken(refreshToken),
    });

    if (!storedToken) {
      return res.status(401).json({
        success: false,
        message: "Refresh token not found",
      });
    }

    // 3. Check token ownership
    if (storedToken.user.toString() !== decoded.id) {
      return res.status(401).json({
        success: false,
        message: "Invalid refresh token",
      });
    }

    // 4. Check whether it was revoked
    if (storedToken.revoked) {
      return res.status(401).json({
        success: false,
        message: "Refresh token has been revoked",
      });
    }

    // 5. Check expiration
    if (storedToken.expiresAt <= new Date()) {
      return res.status(401).json({
        success: false,
        message: "Refresh token has expired",
      });
    }

    // 6. Find the user
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User no longer exists",
      });
    }

    // 7. Generate replacement tokens
    const newRefreshToken = generateRefreshToken(user);
    const newAccessToken = generateToken(user);

    const deviceInfo = getDeviceInfo(req);

    const expiresAt = new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000
    );

    // 8. Start transaction
    session = await mongoose.startSession();

    await session.withTransaction(async () => {
      // Revoke old token atomically
      const revokedToken = await RefreshToken.findOneAndUpdate(
        {
          _id: storedToken._id,
          user: user._id,
          revoked: false,
          expiresAt: { $gt: new Date() },
        },
        {
          $set: { revoked: true },
        },
        {
          returnDocument: "before",
          session,
        }
      );

      if (!revokedToken) {
        throw new Error("REFRESH_TOKEN_ALREADY_USED");
      }

      // Save replacement token
      await RefreshToken.create(
        [
          {
            token: hashToken(newRefreshToken),
            user: user._id,
            expiresAt,
            device: deviceInfo.device,
            browser: deviceInfo.browser,
            ipAddress: deviceInfo.ipAddress,
            lastUsedAt: new Date(),
          },
        ],
        { session }
      );
    });

    // 9. Send new cookie only after transaction succeeds
    res.cookie("refreshToken", newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: "/",
    });

    return res.status(200).json({
      success: true,
      message: "Access token refreshed successfully",
      token: newAccessToken,
    });

  } catch (error) {
    if (error.message === "REFRESH_TOKEN_ALREADY_USED") {
      return res.status(401).json({
        success: false,
        message: "Refresh token has already been used or expired",
      });
    }

    if (
      error.name === "JsonWebTokenError" ||
      error.name === "TokenExpiredError" ||
      error.name === "NotBeforeError"
    ) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired refresh token",
      });
    }

    console.error("Refresh token error:", error);

    return res.status(500).json({
      success: false,
      message: "Could not refresh your session. Please try again.",
    });

  } finally {
    if (session) {
      await session.endSession();
    }
  }
};

const logout = async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
      res.clearCookie("refreshToken", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
      });

      return res.status(200).json({
        success: true,
        message: "Logout successful",
      });
    }

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
      path: "/",
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

    if (!mongoose.isValidObjectId(req.params.sessionId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid session ID",
      });
    }

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
        returnDocument: "after",
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


// Create a 2FA challenge after successful Google authentication
const createGoogleTwoFactorChallenge = async (req, res) => {
  try {
    const user = req.user;

    if (!user || !user.twoFactorEnabled) {
      return res.redirect(`${process.env.FRONTEND_URL}/login`);
    }

    // Generate a unique challenge ID
    const challengeId = require("crypto").randomUUID();

    // Create a temporary challenge token
    const challengeToken = jwt.sign(
      {
        id: user._id,
        purpose: "2fa-login",
        jti: challengeId,
      },
      process.env.JWT_SECRET,
      { expiresIn: "5m" }
    );

    // Save the challenge in MongoDB
    await TwoFactorChallenge.create({
      jti: challengeId,
      user: user._id,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    });

    // Store challenge in an HTTP-only cookie
    res.cookie("twoFactorChallenge", challengeToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 5 * 60 * 1000,
      path: "/api/v1/auth/2fa",
    });

    // Send the user to the frontend 2FA page
    return res.redirect(
      `${process.env.FRONTEND_URL}/two-factor`
    );

  } catch (error) {
    console.error("Google 2FA challenge error:", error);

    return res.redirect(`${process.env.FRONTEND_URL}/login`);
  }
};


module.exports = {
  register,
  login,
  verifyTwoFactorLogin,
  createGoogleTwoFactorChallenge,
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
};