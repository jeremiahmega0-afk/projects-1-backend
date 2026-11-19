const speakeasy = require("speakeasy");
const QRCode = require("qrcode");
const User = require("../models/user.model");
const bcrypt = require("bcrypt");
const {
  decryptTwoFactorSecret,
} = require("../utils/twoFactor.utils");
const {
  encryptTwoFactorSecret,
} = require("../utils/twoFactor.utils");
const {
  generateRecoveryCodes,
} = require("../utils/recoveryCode.utils");

// Start setting up two-factor authentication
const setupTwoFactor = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.twoFactorEnabled) {
      return res.status(400).json({
        success: false,
        message: "Two-factor authentication is already enabled",
      });
    }

    // Generate a new secret
    const secret = speakeasy.generateSecret({
      name: `Jerry Blog (${user.email})`,
      issuer: "Jerry Blog Platform",
      length: 20,
    });

    // Save the temporary secret in encrypted form
    user.twoFactorTempSecret = encryptTwoFactorSecret(
      secret.base32
    );

    await user.save();

    // Convert the authenticator URL into a QR code
    const qrCode = await QRCode.toDataURL(secret.otpauth_url, {
      errorCorrectionLevel: "H",
      type: "image/png",
      width: 400,
      margin: 4,
    });

    return res.status(200).json({
      success: true,
      message: "Scan this QR code with your authenticator app",
      qrCode,
    });
  } catch (error) {
    console.error("2FA setup error:", error);

    return res.status(500).json({
      success: false,
      message: "Could not set up two-factor authentication",
    });
  }
};

const verifyAndEnableTwoFactor = async (req, res) => {
  try {
    const { token } = req.body;

    if (!/^\d{6}$/.test(String(token || ""))) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid six-digit code",
      });
    }

    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.twoFactorEnabled) {
      return res.status(400).json({
        success: false,
        message: "Two-factor authentication is already enabled",
      });
    }

    if (!user.twoFactorTempSecret) {
      return res.status(400).json({
        success: false,
        message: "Please set up two-factor authentication first",
      });
    }

    const secret = require("../utils/twoFactor.utils")
      .decryptTwoFactorSecret(user.twoFactorTempSecret);

    const verified = speakeasy.totp.verify({
      secret,
      encoding: "base32",
      token: String(token),
      window: 1,
    });

    if (!verified) {
      return res.status(400).json({
        success: false,
        message: "Invalid authentication code",
      });
    }

    user.twoFactorSecret = user.twoFactorTempSecret;
    user.twoFactorTempSecret = null;
    user.twoFactorEnabled = true;

    await user.save();

    return res.status(200).json({
      success: true,
      message: "Two-factor authentication enabled successfully",
    });
  } catch (error) {
    console.error("2FA verification error:", error);

    return res.status(500).json({
      success: false,
      message: "Could not verify two-factor authentication",
    });
  }
};



const generateUserRecoveryCodes = async (req, res) => {
  try {
    const { password, token } = req.body;

    // 1. Check submitted information
    if (!password || !/^\d{6}$/.test(String(token || ""))) {
      return res.status(400).json({
        success: false,
        message: "Password and six-digit code are required",
      });
    }

    // 2. Find the user
    const user = await User.findById(req.user.id).select(
      "+twoFactorRecoveryCodes"
    );

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

    // 3. Verify password
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

    // 4. Decrypt 2FA secret
    const secret = decryptTwoFactorSecret(
      user.twoFactorSecret
    );

    // 5. Verify authenticator code
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

    // 6. Generate new recovery codes
    const { codes, hashedCodes } = generateRecoveryCodes();

    user.twoFactorRecoveryCodes = hashedCodes;

    await user.save();

    return res.status(200).json({
      success: true,
      message: "Recovery codes generated successfully. Save them somewhere safe.",
      recoveryCodes: codes,
    });

  } catch (error) {
    console.error("Recovery code generation error:", error);

    return res.status(500).json({
      success: false,
      message: "Could not generate recovery codes",
    });
  }
};



module.exports = {
  setupTwoFactor,
  verifyAndEnableTwoFactor,
  generateUserRecoveryCodes,
};
