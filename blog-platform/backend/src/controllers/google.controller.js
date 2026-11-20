const mongoose = require("mongoose");
const crypto = require("crypto");
const bcrypt = require("bcrypt");

const googleClient = require("../config/google-oauth");
const User = require("../models/user.model");
const RefreshToken = require("../models/refreshToken.model");

const generateRefreshToken = require("../utils/generateRefreshToken");
const hashToken = require("../utils/hashToken");
const { getDeviceInfo } = require("../utils/device.utils");
const frontendUrl = process.env.FRONTEND_URL;
const {
  createGoogleTwoFactorChallenge,
} = require("./auth.controller");

// Start Google authentication
const startGoogleAuth = (req, res) => {
  try {
    // Generate a random security state
    const state = crypto.randomBytes(32).toString("hex");

    // Store state in a secure cookie
    res.cookie("googleOAuthState", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 10 * 60 * 1000,
      path: "/api/v1/auth/google",
    });

    // Generate Google's login URL
    const authUrl = googleClient.generateAuthUrl({
      access_type: "online",
      prompt: "select_account",
      scope: ["openid", "email", "profile"],
      state,
    });

    return res.redirect(authUrl);
  } catch (error) {
    console.error("Google login start error:", error);

    return res.redirect(`${frontendUrl}/login`);
  }
};

// Handle Google's callback
const googleCallback = async (req, res) => {
  let session;
  try {
    const { code, state } = req.query;
    const savedState = req.cookies?.googleOAuthState;

    // Clear the state cookie
    res.clearCookie("googleOAuthState", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/api/v1/auth/google",
    });

    // Validate OAuth state
    if (
      typeof state !== "string" ||
      typeof savedState !== "string" ||
      state.length !== savedState.length ||
      !crypto.timingSafeEqual(
        Buffer.from(state),
        Buffer.from(savedState)
      )
    ) {
      return res.status(403).send("Invalid Google authentication state");
    }

    if (typeof code !== "string") {
      return res.redirect(`${frontendUrl}/login`);
    }

    // Exchange Google's authorization code for tokens
    const { tokens } = await googleClient.getToken(code);

    if (!tokens.id_token) {
      return res.redirect(`${frontendUrl}/login`);
    }

    // Verify Google's ID token
    const ticket = await googleClient.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    if (
      !payload ||
      !payload.sub ||
      !payload.email ||
      payload.email_verified !== true
    ) {
      return res.redirect(`${frontendUrl}/login`);
    }

    const googleId = payload.sub;
    const email = payload.email.trim().toLowerCase();

    // Find existing Google account
    let user = await User.findOne({ googleId });

    // If no Google account exists, check the email
    if (!user) {
      const existingUser = await User.findOne({ email });

      // Do not automatically link existing accounts
      if (existingUser) {
        return res.redirect(`${frontendUrl}/login`);
      }

      // Generate a random password
      const randomPassword = crypto
        .randomBytes(32)
        .toString("hex");

      const hashedPassword = await bcrypt.hash(
        randomPassword,
        12
      );

      // Create Google user
      user = await User.create({
        name: payload.name || "Google User",
        email,
        googleId,
        password: hashedPassword,
        isVerified: true,
      });
    }

    // Require 2FA if enabled
    if (user.twoFactorEnabled) {
      req.user = user;
      return createGoogleTwoFactorChallenge(req, res);
    }

    // Generate our application's refresh token
    const refreshToken = generateRefreshToken(user);

    // Detect device information
    const deviceInfo = getDeviceInfo(req);

    // Save the refresh token
    // Save the refresh token
session = await mongoose.startSession();

await session.withTransaction(async () => {
  await RefreshToken.create(
    [
      {
        token: hashToken(refreshToken),
        user: user._id,
        expiresAt: new Date(
          Date.now() + 7 * 24 * 60 * 60 * 1000
        ),
        device: deviceInfo.device,
        browser: deviceInfo.browser,
        ipAddress: deviceInfo.ipAddress,
        lastUsedAt: new Date(),
      },
    ],
    { session }
  );
});


    // Send refresh token using HTTP-only cookie
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: "/",
    });

    return res.redirect(`${frontendUrl}/google-success`);
  }catch (error) {
  console.error("Google authentication error:", {
    message: error.message,
    code: error.code,
    status: error.status,
  });

  return res.redirect(`${frontendUrl}/login`);
}
  finally {
  if (session) {
    await session.endSession();
  }
}
};

module.exports = {
  startGoogleAuth,
  googleCallback,
};
