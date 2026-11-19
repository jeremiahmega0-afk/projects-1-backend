
const rateLimit = require("express-rate-limit");

const securityLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,

  limit: 10,

  standardHeaders: "draft-8",

  legacyHeaders: false,

  identifier: "security-operations",

  message: {
    success: false,
    message:
      "Too many security requests. Please try again after 15 minutes.",
  },
});

module.exports = securityLimiter;
