
const crypto = require("crypto");

const getEncryptionKey = () => {
  const key = process.env.TWO_FACTOR_ENCRYPTION_KEY;

  if (!key || !/^[a-fA-F0-9]{64}$/.test(key)) {
    throw new Error(
      "TWO_FACTOR_ENCRYPTION_KEY must be a valid 64-character hexadecimal key"
    );
  }

  return Buffer.from(key, "hex");
};

// Encrypt a 2FA secret before saving it
const encryptTwoFactorSecret = (secret) => {
  const key = getEncryptionKey();

  const iv = crypto.randomBytes(12);

  const cipher = crypto.createCipheriv(
    "aes-256-gcm",
    key,
    iv
  );

  let encrypted = cipher.update(secret, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag();

  return [
    iv.toString("hex"),
    authTag.toString("hex"),
    encrypted,
  ].join(":");
};

// Decrypt the secret when we need to verify a 2FA code
const decryptTwoFactorSecret = (encryptedData) => {
  const key = getEncryptionKey();

  const [ivHex, authTagHex, encrypted] = encryptedData.split(":");

  if (!ivHex || !authTagHex || !encrypted) {
    throw new Error("Invalid encrypted 2FA secret");
  }

  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(ivHex, "hex")
  );

  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));

  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
};

module.exports = {
  encryptTwoFactorSecret,
  decryptTwoFactorSecret,
};
