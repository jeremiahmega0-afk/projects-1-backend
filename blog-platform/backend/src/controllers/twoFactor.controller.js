
const speakeasy = require("speakeasy");
const QRCode = require("qrcode");
const User = require("../models/user.model");

const {
  encryptTwoFactorSecret,
} = require("../utils/twoFactor.utils");

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

module.exports = {
  setupTwoFactor,
  verifyAndEnableTwoFactor,
};
