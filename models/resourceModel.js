import mongoose from "mongoose";

const resourceSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: true
        },
        description: {
            type: String
        },
        link: {
            type: String,
        },
        type: {
            type: String,
            enum: ["blog", "tool", "video", "report", "news"],
            default: "blog"
        },
        image: {
            type: String
        }, // optional image/thumbnail URL
        creator: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
    },
    {
        timestamps: true,
    }
);

const Resource = mongoose.model("Resource", resourceSchema);
export default Resource;
