const mongoose = require("mongoose");

const verificationSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
    },

    otp: {
      type: String,
      required: true,
    },

    expiresAt: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const Verification = mongoose.model(
  "Verification",
  verificationSchema
);

module.exports = Verification;