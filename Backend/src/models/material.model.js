import mongoose from "mongoose";

const materialSchema = new mongoose.Schema(
    {
        unit: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Unit",
            required: true
        },
        title: {
            type: String,
            required: true
        },
        fileUrl: {
            type: String,
            required: true
        },
        fileType: {
            type: String,
            required: true
        },
        uploadedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        },
        aiEmbeddingStatus: {
            type: String,
            enum: ["pending", "processing", "completed", "failed"],
            default: "pending"
        },
        aiEmbeddingChunkCount: {
            type: Number,
            default: 0
        },
        aiEmbeddedAt: {
            type: Date
        },
        aiEmbeddingError: {
            type: String,
            default: null
        }
    },
    { timestamps: true }
);

export const Material = mongoose.model("Material", materialSchema);
