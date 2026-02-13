import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

const studentSchema = new mongoose.Schema(
    {
        rollNumber: {
            type: Number,
            unique: true,
            trim: true
        },
        name: {
            type: String,
            required: true
        },
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true
        },
        mobile: {
            type: String,
            required: true,
            unique: true,
            trim: true
        },
        password: {
            type: String,
            required: true,
        },
        parentName: {
            type: String,
            required: true
        },
        parentMobile: {
            type: String,
            required: true,
            trim: true
        },
        batch: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Batch",
            required: true
        },
        verificationToken: {
            type: String
        },
        isVerified: {
            type: Boolean,
            default: false
        }
    },
    { timestamps: true }
);

// Hash password before saving
studentSchema.pre("save", async function () {
    if (!this.isModified("password")) return

    this.password = await bcrypt.hash(this.password, 10);
});

// Method to compare password
studentSchema.methods.isPasswordCorrect = async function (password) {
    return await bcrypt.compare(password, this.password);
};

// Generate Access Token
studentSchema.methods.generateAccessToken = function () {
    return jwt.sign(
        {
            _id: this._id,
            rollNumber: this.rollNumber,
        },
        process.env.STUDENT_ACCESS_TOKEN_SECRET || process.env.ACCESS_TOKEN_SECRET,
        {
            expiresIn: process.env.STUDENT_ACCESS_TOKEN_EXPIRY || process.env.ACCESS_TOKEN_EXPIRY || "1d"
        }
    );
};

// Generate Refresh Token
studentSchema.methods.generateRefreshToken = function () {
    return jwt.sign(
        {
            _id: this._id,
        },
        process.env.STUDENT_REFRESH_TOKEN_SECRET || process.env.REFRESH_TOKEN_SECRET,
        {
            expiresIn: process.env.STUDENT_REFRESH_TOKEN_EXPIRY || process.env.REFRESH_TOKEN_EXPIRY || "7d"
        }
    );
};

export const Student = mongoose.model("Student", studentSchema);