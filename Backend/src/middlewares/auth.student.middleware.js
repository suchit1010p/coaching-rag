import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import jwt from "jsonwebtoken";
import { Student } from "../models/student.model.js";

// Verify student JWT token
export const verifyStudentJWT = asyncHandler(async (req, _, next) => {
    try {
        const token = req.cookies?.studentAccessToken ||
            req.header("Authorization")?.replace("Bearer ", "");
        const studentAccessSecret =
            process.env.STUDENT_ACCESS_TOKEN_SECRET || process.env.ACCESS_TOKEN_SECRET;

        if (!token) {
            throw new ApiError(401, "Unauthorized request - No token provided");
        }

        const decodedToken = jwt.verify(token, studentAccessSecret);

        const student = await Student.findById(decodedToken?._id)
            .select("-password")
            .populate('batch', 'name');

        if (!student) {
            throw new ApiError(401, "Invalid Access Token");
        }

        req.student = student;
        next();
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid access token");
    }
});

// Verify student can access specific batch
export const verifyStudentBatchAccess = asyncHandler(async (req, _, next) => {
    const { batchId } = req.params || req.body;

    if (!req.student) {
        throw new ApiError(401, "Student authentication required");
    }

    if (req.student.batch.toString() !== batchId) {
        throw new ApiError(403, "Forbidden: You can only access your own batch");
    }

    next();
});

// Verify student can access specific subject
export const verifyStudentSubjectAccess = asyncHandler(async (req, _, next) => {
    const { subjectId } = req.params || req.body;

    if (!req.student) {
        throw new ApiError(401, "Student authentication required");
    }

    const { StudentSubject } = await import("../models/studentSubject.model.js");

    const enrollment = await StudentSubject.findOne({
        student: req.student._id,
        subject: subjectId
    });

    if (!enrollment) {
        throw new ApiError(403, "Forbidden: You are not enrolled in this subject");
    }

    next();
});
