import { asyncHandler } from "../utils/asyncHandler.js";
import { Student } from "../models/student.model.js";
import { StudentSubject } from "../models/studentSubject.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Batch } from "../models/batch.model.js";
import { Subject } from "../models/subject.model.js";
import { Unit } from "../models/unit.model.js";
import { Material } from "../models/material.model.js";
import { Attendance } from "../models/attendance.model.js";
import { AttendanceEntry } from "../models/attendanceEntry.model.js";
import jwt from "jsonwebtoken";
import { deleteVerificationFile } from "../utils/s3.js";

const getCookieOptions = () => {
    const isProduction = process.env.NODE_ENV === "production";
    const accessTokenCookieDays = Number(process.env.STUDENT_ACCESS_TOKEN_COOKIE_DAYS || process.env.ACCESS_TOKEN_COOKIE_DAYS || 1);
    const refreshTokenCookieDays = Number(process.env.STUDENT_REFRESH_TOKEN_COOKIE_DAYS || process.env.REFRESH_TOKEN_COOKIE_DAYS || 90);

    return {
        access: {
            httpOnly: true,
            secure: isProduction,
            sameSite: isProduction ? "none" : "lax",
            maxAge: accessTokenCookieDays * 24 * 60 * 60 * 1000
        },
        refresh: {
            httpOnly: true,
            secure: isProduction,
            sameSite: isProduction ? "none" : "lax",
            maxAge: refreshTokenCookieDays * 24 * 60 * 60 * 1000
        }
    };
};

const getClearCookieOptions = () => {
    const isProduction = process.env.NODE_ENV === "production";

    return {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? "none" : "lax"
    };
};

// Helper function to generate student tokens
const generateStudentTokens = async (studentId) => {
    try {
        const student = await Student.findById(studentId);
        if (!student) {
            throw new ApiError(404, "Student not found");
        }
        const accessToken = student.generateAccessToken();
        const refreshToken = student.generateRefreshToken();

        student.refreshToken = refreshToken;
        await student.save({ validateBeforeSave: false });

        return { accessToken, refreshToken };
    } catch (error) {
        if (error instanceof ApiError) {
            throw error;
        }
        throw new ApiError(500, "Token generation failed");
    }
};

// Student Login
const loginStudent = asyncHandler(async (req, res) => {
    const { mobile, password } = req.body;

    if (!mobile) throw new ApiError(400, "Mobile number is required");
    if (!password) throw new ApiError(400, "Password is required");

    const normalizedMobile = mobile.trim();
    const student = await Student.findOne({ mobile: normalizedMobile }).populate('batch', 'name');

    if (!student) {
        throw new ApiError(404, "Student does not exist");
    }

    const isPasswordCorrect = await student.isPasswordCorrect(password);

    if (!isPasswordCorrect) {
        throw new ApiError(401, "Invalid credentials");
    }

    if (!student.isVerified) {
        throw new ApiError(403, "Please verify your email before logging in");
    }

    const loggedInStudent = await Student.findById(student._id)
        .select("-password -refreshToken")
        .populate('batch', 'name');

    const { accessToken, refreshToken } = await generateStudentTokens(student._id);

    const options = getCookieOptions();

    return res
        .status(200)
        .cookie("studentAccessToken", accessToken, options.access)
        .cookie("studentRefreshToken", refreshToken, options.refresh)
        .json(
            new ApiResponse(
                200,
                {
                    student: loggedInStudent,
                    accessToken,
                    refreshToken
                },
                "Student logged in successfully"
            )
        );
});

// Student Logout
const logoutStudent = asyncHandler(async (req, res) => {
    await Student.findByIdAndUpdate(
        req.student._id,
        {
            $set: {
                refreshToken: null
            }
        },
        {
            new: true
        }
    );

    const options = getClearCookieOptions();

    return res
        .status(200)
        .clearCookie("studentAccessToken", options)
        .clearCookie("studentRefreshToken", options)
        .json(new ApiResponse(200, {}, "Student logged out successfully"));
});

const refreshStudentAccessToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken = req.cookies.studentRefreshToken || req.body.refreshToken;
    const studentRefreshSecret =
        process.env.STUDENT_REFRESH_TOKEN_SECRET || process.env.REFRESH_TOKEN_SECRET;

    if (!incomingRefreshToken) {
        throw new ApiError(401, "Unauthorized request");
    }

    try {
        const decodedToken = jwt.verify(incomingRefreshToken, studentRefreshSecret);
        const student = await Student.findById(decodedToken?._id).select("+refreshToken");

        if (!student) {
            throw new ApiError(401, "Invalid refresh token");
        }

        if (incomingRefreshToken !== student.refreshToken) {
            throw new ApiError(401, "Refresh token is expired or used");
        }

        const { accessToken, refreshToken } = await generateStudentTokens(student._id);
        const safeStudent = await Student.findById(student._id)
            .select("-password -refreshToken")
            .populate("batch", "name");

        const options = getCookieOptions();

        return res
            .status(200)
            .cookie("studentAccessToken", accessToken, options.access)
            .cookie("studentRefreshToken", refreshToken, options.refresh)
            .json(
                new ApiResponse(
                    200,
                    { student: safeStudent, accessToken, refreshToken },
                    "Student access token refreshed successfully"
                )
            );
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid refresh token");
    }
});

// Get Student Profile
const getStudentProfile = asyncHandler(async (req, res) => {
    const student = await Student.findById(req.student._id)
        .select("-password -refreshToken")
        .populate('batch', 'name');

    if (!student) {
        throw new ApiError(404, "Student not found");
    }

    return res
        .status(200)
        .json(new ApiResponse(200, student, "Student profile fetched successfully"));
});

// Get Student's Batch
const getStudentBatch = asyncHandler(async (req, res) => {
    const batch = await Batch.findById(req.student.batch);

    if (!batch) {
        throw new ApiError(404, "Batch not found");
    }

    return res
        .status(200)
        .json(new ApiResponse(200, batch, "Batch fetched successfully"));
});

// Get Student's Subjects (only enrolled subjects)
const getStudentSubjects = asyncHandler(async (req, res) => {
    const studentSubjects = await StudentSubject.find({
        student: req.student._id
    }).populate({
        path: 'subject',
        select: 'name batch createdAt',
        populate: {
            path: 'batch',
            select: 'name'
        }
    });

    const subjects = studentSubjects.map(ss => ss.subject);

    return res
        .status(200)
        .json(
            new ApiResponse(200, subjects, "Student subjects fetched successfully")
        );
});

// Get Units of a Subject (User or Student)
const getSubjectUnits = asyncHandler(async (req, res) => {
    const { subjectId } = req.body;

    if (!subjectId || subjectId.trim() === "") {
        throw new ApiError(400, "Subject ID is required");
    }

    // Checking Enrollment Only if it is a Student
    if (req.student) {
        // Verify student is enrolled in this subject
        const enrollment = await StudentSubject.findOne({
            student: req.student._id,
            subject: subjectId
        });

        if (!enrollment) {
            throw new ApiError(403, "You are not enrolled in this subject");
        }
    }
    // If req.user exists (Teacher/Admin), we skip enrollment check and proceed.

    const units = await Unit.find({ subject: subjectId })
        .select('title createdAt')
        .sort({ createdAt: 1 });

    return res
        .status(200)
        .json(new ApiResponse(200, units, "Units fetched successfully"));
});

// Get Materials of a Unit (User or Student)
const getUnitMaterials = asyncHandler(async (req, res) => {
    const { unitId } = req.body;

    if (!unitId || unitId.trim() === "") {
        throw new ApiError(400, "Unit ID is required");
    }

    // Get the unit and verify it exists
    const unit = await Unit.findById(unitId).populate('subject');

    if (!unit) {
        throw new ApiError(404, "Unit not found");
    }

    // Checking Enrollment Only if it is a Student
    if (req.student) {
        // Verify student is enrolled in the subject this unit belongs to
        const enrollment = await StudentSubject.findOne({
            student: req.student._id,
            subject: unit.subject._id
        });

        if (!enrollment) {
            throw new ApiError(403, "You are not enrolled in this subject");
        }
    }
    // If req.user exists, skip check.

    const materials = await Material.find({ unit: unitId })
        .select('title fileUrl createdAt')
        .populate('uploadedBy', 'name')
        .sort({ createdAt: -1 });

    return res
        .status(200)
        .json(new ApiResponse(200, materials, "Materials fetched successfully"));
});

// Get Student's Attendance History
const getStudentAttendanceHistory = asyncHandler(async (req, res) => {
    const { subjectId } = req.query;

    // If subjectId provided, verify enrollment and filter by subject
    if (subjectId) {
        const enrollment = await StudentSubject.findOne({
            student: req.student._id,
            subject: subjectId
        });

        if (!enrollment) {
            throw new ApiError(403, "You are not enrolled in this subject");
        }
    }

    const enrolledSubjects = await StudentSubject.find({ student: req.student._id }).select('subject');
    const enrolledSubjectIds = enrolledSubjects.map((entry) => entry.subject);
    const attendanceFilter = subjectId
        ? { subject: subjectId }
        : { subject: { $in: enrolledSubjectIds } };

    const attendanceSessions = await Attendance.find(attendanceFilter)
        .populate({
            path: 'subject',
            select: 'name'
        })
        .populate({
            path: 'batch',
            select: 'name'
        })
        .sort({ date: -1, createdAt: -1 });

    const absentEntries = await AttendanceEntry.find({
        student: req.student._id,
        attendance: { $in: attendanceSessions.map((session) => session._id) },
        status: 'ABSENT'
    }).lean();

    const absentEntriesByAttendanceId = new Map(
        absentEntries.map((entry) => [entry.attendance.toString(), entry])
    );

    const attendanceEntries = attendanceSessions.map((session) => {
        const absentEntry = absentEntriesByAttendanceId.get(session._id.toString());

        return {
            _id: absentEntry?._id?.toString() || session._id.toString(),
            attendance: session,
            student: req.student._id,
            status: absentEntry ? 'ABSENT' : 'PRESENT',
            createdAt: absentEntry?.createdAt || session.createdAt,
            updatedAt: absentEntry?.updatedAt || session.updatedAt
        };
    });

    // Calculate statistics
    const totalClasses = attendanceSessions.length;
    const absentCount = absentEntries.length;
    const presentCount = Math.max(totalClasses - absentCount, 0);
    const attendancePercentage = totalClasses > 0
        ? ((presentCount / totalClasses) * 100).toFixed(2)
        : 0;

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                {
                    attendanceEntries,
                    statistics: {
                        totalClasses,
                        present: presentCount,
                        absent: absentCount,
                        attendancePercentage: parseFloat(attendancePercentage)
                    }
                },
                "Attendance history fetched successfully"
            )
        );
});

// Verify Student Email using AWS S3 Presigned URL
const verifyStudentEmail = asyncHandler(async (req, res) => {
    const { token } = req.query;

    if (!token) {
        throw new ApiError(400, "Verification token is required");
    }

    // Fetch the verification file from S3 using the presigned URL
    let verificationData;
    try {
        const response = await fetch(token);

        if (!response.ok) {
            throw new Error("S3 fetch failed");
        }

        verificationData = await response.json();
    } catch (error) {
        throw new ApiError(400, "Verification link is expired or invalid. Please contact your teacher to resend the verification email.");
    }

    const { studentId } = verificationData;

    if (!studentId) {
        throw new ApiError(400, "Invalid verification data");
    }

    const student = await Student.findById(studentId);

    if (!student) {
        throw new ApiError(404, "Student not found");
    }

    if (student.isVerified) {
        return res.status(200).json(
            new ApiResponse(200, {}, "Email is already verified. You can login.")
        );
    }

    student.isVerified = true;
    await student.save();

    // Clean up the verification file from S3
    await deleteVerificationFile(studentId);

    return res.status(200).json(
        new ApiResponse(200, {}, "Email verified successfully. You can now login.")
    );
});

export {
    verifyStudentEmail,
    loginStudent,
    logoutStudent,
    refreshStudentAccessToken,
    getStudentProfile,
    getStudentBatch,
    getStudentSubjects,
    getSubjectUnits,
    getUnitMaterials,
    getStudentAttendanceHistory
};
