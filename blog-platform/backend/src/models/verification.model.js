
const mongoose = require("mongoose");

const verificationSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    otp: {
      type: String,
      required: true,
    },

    purpose: {
      type: String,
      enum: ["register", "password-reset"],
      default: "register",
      required: true,
    },

    attempts: {
      type: Number,
      default: 0,
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

verificationSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0 }
);

const Verification = mongoose.model(
  "Verification",
  verificationSchema
);

module.exports = Verification;
