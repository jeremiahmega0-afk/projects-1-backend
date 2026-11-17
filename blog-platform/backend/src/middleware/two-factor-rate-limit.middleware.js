
const rateLimit = require("express-rate-limit");

const twoFactorLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes

  max: 5, // Maximum 5 attempts

  standardHeaders: true,

  legacyHeaders: false,

  message: {
    success: false,
    message: "Too many 2FA attempts. Please try again after 5 minutes.",
  },
});

module.exports = twoFactorLimiter;
