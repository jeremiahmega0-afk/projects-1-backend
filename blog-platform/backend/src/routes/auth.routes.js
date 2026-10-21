const express = require("express");
const authLimiter = require("../middleware/auth-rate-limit.middleware");

const {
  register,
  login,
  verifyAccount,
  resendOtp,
  forgotPassword,
  resetPassword,
  refreshAccessToken,
   logout,
} = require("../controllers/auth.controller");

const router = express.Router();


router.post("/register", authLimiter, register);
router.post("/login", authLimiter, login);
router.post("/verify", authLimiter, verifyAccount);
router.post("/resend-otp", authLimiter, resendOtp);
router.post("/forgot-password", authLimiter, forgotPassword);
router.post("/reset-password", authLimiter, resetPassword);
router.post("/refresh", authLimiter, refreshAccessToken);
router.post("/logout", authLimiter, logout);


module.exports = router;