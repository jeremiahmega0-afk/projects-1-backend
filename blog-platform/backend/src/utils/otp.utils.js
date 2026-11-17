
const crypto = require("crypto");

// Convert an OTP into a SHA-256 hash
const hashOtp = (otp) => {
  return crypto
    .createHash("sha256")
    .update(String(otp))
    .digest("hex");
};

module.exports = {
  hashOtp,
};
