const express = require("express");
const authLimiter = require("../middleware/auth-rate-limit.middleware");
const protect = require("../middleware/auth.middleware");
const passport = require("../config/passport");
const twoFactorLimiter = require("../middleware/two-factor-rate-limit.middleware");

const RefreshToken = require("../models/refreshToken.model");
const generateRefreshToken = require("../utils/generateRefreshToken");
const hashToken = require("../utils/hashToken");
const { getDeviceInfo } = require("../utils/device.utils");

const {
  register,
  login,
  verifyTwoFactorLogin,
  disableTwoFactor,
  verifyAccount,
  resendOtp,
  forgotPassword,
  resetPassword,
  refreshAccessToken,
  changePassword,
  logout,
  logoutAllDevices,
  getActiveSessions,
  revokeSession,
  logoutOtherDevices,
  createGoogleTwoFactorChallenge,
} = require("../controllers/auth.controller");

const {
  setupTwoFactor,
  verifyAndEnableTwoFactor,
  generateUserRecoveryCodes,
} = require("../controllers/twoFactor.controller");

const router = express.Router();


router.post("/register", authLimiter, register);
router.post("/login", authLimiter, login);
router.post("/verify", authLimiter, verifyAccount);
router.post("/resend-otp", authLimiter, resendOtp);
router.post("/forgot-password", authLimiter, forgotPassword);
router.post("/reset-password", authLimiter, resetPassword);
router.post("/refresh", authLimiter, refreshAccessToken);
router.post(
  "/change-password",
  authLimiter,
  protect,
  changePassword
);
router.post("/logout", authLimiter, logout);
router.post("/logout-all", protect, authLimiter, logoutAllDevices);
router.get("/sessions", protect, getActiveSessions);

// Start Google authentication
router.get(
  "/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
    session: false,
  })
);

// Google authentication callback
router.get(
  "/google/callback",
  passport.authenticate("google", {
    session: false,
    failureRedirect: "http://localhost:5173/login",
  }),
  async (req, res) => {
    try {
      const user = req.user;

      // Require 2FA verification if enabled
      if (user.twoFactorEnabled) {
        return createGoogleTwoFactorChallenge(req, res);
      }

      const refreshToken = generateRefreshToken(user);

      // Get information about the device logging in
      const deviceInfo = getDeviceInfo(req);

      // Save refresh token and device information
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

      res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      return res.redirect(
        "http://localhost:5173/google-success"
      );
    } catch (error) {
      console.error("Google authentication error:", error);

      return res.redirect(
        "http://localhost:5173/login"
      );
    }
  }
);

router.post("/2fa/setup", protect, setupTwoFactor);

router.post("/2fa/verify", protect, verifyAndEnableTwoFactor);

router.post(
  "/2fa/login",
  twoFactorLimiter,
  verifyTwoFactorLogin
);

router.post("/2fa/disable", protect, disableTwoFactor);

router.post(
  "/2fa/recovery-codes",
  protect,
  generateUserRecoveryCodes
);

// Logout all other devices FIRST
router.delete("/sessions/others", protect, logoutOtherDevices);

// Revoke one specific session SECOND
router.delete("/sessions/:sessionId", protect, revokeSession);

module.exports = router;