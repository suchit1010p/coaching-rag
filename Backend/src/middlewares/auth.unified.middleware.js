import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import jwt from "jsonwebtoken";
import { User } from "../models/user.model.js";
import { Student } from "../models/student.model.js";

export const verifyUserOrStudent = asyncHandler(async (req, _, next) => {
    try {
        const studentAccessSecret =
            process.env.STUDENT_ACCESS_TOKEN_SECRET || process.env.ACCESS_TOKEN_SECRET;

        // 1. Try to find and verify User Token
        const userToken = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ", "");

        if (userToken) {
            try {
                const decodedUser = jwt.verify(userToken, process.env.ACCESS_TOKEN_SECRET);
                const user = await User.findById(decodedUser?._id).select("-password -refreshToken");

                if (user) {
                    req.user = user;
                    return next(); // Authenticated as User
                }
            } catch (ignore) {
                // Token exists but verify failed or user not found. 
                // Proceed to check for Student token in case they are sharing the header (unlikely but possible)
                // or if the "userToken" was actually a student token passed in Authorization header.
            }
        }

        // 2. Try to find and verify Student Token
        // Check specific student cookie, or fallback to Authorization header again (if it wasn't a valid user token)
        const studentToken = req.cookies?.studentAccessToken || req.header("Authorization")?.replace("Bearer ", "");

        if (studentToken) {
            try {
                const decodedStudent = jwt.verify(studentToken, studentAccessSecret);
                const student = await Student.findById(decodedStudent?._id)
                    .select("-password")
                    .populate('batch', 'name');

                if (student) {
                    req.student = student;
                    return next(); // Authenticated as Student
                }
            } catch (ignore) {
                // Verify failed
            }
        }

        throw new ApiError(401, "Unauthorized request - Invalid or missing token");

    } catch (error) {
        throw new ApiError(401, error?.message || "Unauthorized request");
    }
});
