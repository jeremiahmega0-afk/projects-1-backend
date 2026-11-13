
const mongoose = require("mongoose");

const videoViewSchema = new mongoose.Schema(
    {
        video: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Video",
            required: true,
        },

        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },
    },
    {
        timestamps: true,
    }
);

// A logged-in user can count only once per video.
// Anonymous visits are allowed to create multiple records.
videoViewSchema.index(
    { video: 1, user: 1 },
    {
        unique: true,
        partialFilterExpression: {
            user: { $type: "objectId" },
        },
        name: "video_1_user_1",
    }
);

const VideoView = mongoose.model("VideoView", videoViewSchema);

module.exports = VideoView;
