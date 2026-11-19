const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const User = require("../models/user.model");
const crypto = require("crypto");
const bcrypt = require("bcrypt");

passport.use(
    new GoogleStrategy(
      {
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL,

    tokenURL: "https://oauth2.googleapis.com/token",
    userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo",
},
        async (accessToken, refreshToken, profile, done) => {
            try {
                // Get Google's verified email
                const emailData = profile.emails?.[0];

                const email = emailData?.value
                    ?.trim()
                    .toLowerCase();

                const emailVerified =
                    profile._json?.email_verified === true;

                // Reject accounts without a verified email
                if (!email || !emailVerified) {
                    return done(null, false);
                }

                // Find user using Google's unique ID
                let user = await User.findOne({
                    googleId: profile.id,
                });

                // Existing Google user
                if (user) {
                    return done(null, user);
                }

                // Check whether this email already belongs to an account
                const existingUser = await User.findOne({ email });

                if (existingUser) {
                    // Do not automatically connect existing accounts
                    return done(null, false);
                }

                // Create a secure random password
                const randomPassword = crypto.randomBytes(32).toString("hex");

                // Hash the password before saving
                const hashedPassword = await bcrypt.hash(randomPassword, 12);

                // Create a new Google account
                user = await User.create({
                    name: profile.displayName || "Google User",
                    email,
                    googleId: profile.id,
                    password: hashedPassword,
                    isVerified: true,
                });
                return done(null, user);
            } catch (error) {
                return done(error, null);
            }
        }
    )
);

module.exports = passport;
