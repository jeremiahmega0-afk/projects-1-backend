const express = require("express");
const authLimiter = require("../middleware/auth-rate-limit.middleware");
const protect = require("../middleware/auth.middleware");
const twoFactorLimiter = require("../middleware/two-factor-rate-limit.middleware");
const {
  otpLimiter,
  resendOtpLimiter,
} = require("../middleware/otp-rate-limit.middleware");
const securityLimiter = require("../middleware/security-rate-limit.middleware");
const {
  startGoogleAuth,
  googleCallback,
} = require("../controllers/google.controller");

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
} = require("../controllers/auth.controller");

const {
  setupTwoFactor,
  verifyAndEnableTwoFactor,
  generateUserRecoveryCodes,
} = require("../controllers/twoFactor.controller");

const router = express.Router();


router.post("/register", authLimiter, register);
router.post("/login", authLimiter, login);
router.post("/verify", otpLimiter, verifyAccount);
router.post("/resend-otp", resendOtpLimiter, resendOtp);
router.post("/forgot-password", otpLimiter, forgotPassword);
router.post("/reset-password", otpLimiter, resetPassword);
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
router.get("/google", startGoogleAuth);

// Handle Google's callback
router.get("/google/callback", googleCallback);


router.post(
  "/2fa/login",
  twoFactorLimiter,
  verifyTwoFactorLogin
);


router.post("/2fa/setup", protect, securityLimiter, setupTwoFactor);

router.post(
  "/2fa/verify",
  protect,
  securityLimiter,
  verifyAndEnableTwoFactor
);

router.post("/2fa/disable", protect, securityLimiter, disableTwoFactor);

router.post(
  "/2fa/recovery-codes",
  protect,
  securityLimiter,
  generateUserRecoveryCodes
);

// Session management
router.delete(
  "/sessions/others",
  protect,
  securityLimiter,
  logoutOtherDevices
);

router.delete(
  "/sessions/:sessionId",
  protect,
  securityLimiter,
  revokeSession
);

module.exports = router;