
const crypto = require("crypto");

// Generate one random recovery code
const generateRecoveryCode = () => {
  return crypto.randomBytes(8).toString("hex").toUpperCase();
};

// Hash a recovery code before storing it
const hashRecoveryCode = (code) => {
  return crypto
    .createHash("sha256")
    .update(code)
    .digest("hex");
};

// Generate 10 recovery codes
const generateRecoveryCodes = () => {
  const codes = Array.from(
    { length: 10 },
    () => generateRecoveryCode()
  );

  const hashedCodes = codes.map(hashRecoveryCode);

  return {
    codes,
    hashedCodes,
  };
};

module.exports = {
  generateRecoveryCode,
  hashRecoveryCode,
  generateRecoveryCodes,
};
