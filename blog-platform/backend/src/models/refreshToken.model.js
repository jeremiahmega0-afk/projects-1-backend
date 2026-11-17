const mongoose = require("mongoose");

const refreshTokenSchema = new mongoose.Schema(
  {
    token: {
      type: String,
      required: true,
      unique: true,
    },

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    expiresAt: {
      type: Date,
      required: true,
    },

    revoked: {
      type: Boolean,
      default: false,
    },


    device: {
      type: String,
      default: "Unknown device",
    },

    browser: {
      type: String,
      default: "Unknown browser",
    },

    ipAddress: {
      type: String,
      default: "Unknown",
    },

    lastUsedAt: {
      type: Date,
      default: Date.now,
    },

  },
  {
    timestamps: true,
  }
);
refreshTokenSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0 }
);
const RefreshToken = mongoose.model(
  "RefreshToken",
  refreshTokenSchema
);


module.exports = RefreshToken;