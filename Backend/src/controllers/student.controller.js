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

// Helper function to generate student tokens
const generateStudentTokens = async (studentId) => {
    try {
        const student = await Student.findById(studentId);
        const accessToken = student.generateAccessToken();
        const refreshToken = student.generateRefreshToken();

        // Note: Students don't store refresh tokens in DB for now
        // You can add refreshToken field to student model if needed

        return { accessToken, refreshToken };
    } catch (error) {
        throw new ApiError(500, "Token generation failed");
    }
};

// Student Login
const loginStudent = asyncHandler(async (req, res) => {
    const { mobile, password } = req.body;

    if (!mobile) throw new ApiError(400, "Mobile number is required");
    if (!password) throw new ApiError(400, "Password is required");

    const student = await Student.findOne({ mobile }).populate('batch', 'name');

    if (!student) {
        throw new ApiError(404, "Student does not exist");
    }

    const isPasswordCorrect = await student.isPasswordCorrect(password);

    if (!isPasswordCorrect) {
        throw new ApiError(401, "Invalid credentials");
    }

    const loggedInStudent = await Student.findById(student._id)
        .select("-password")
        .populate('batch', 'name');

    const { accessToken, refreshToken } = await generateStudentTokens(student._id);

    const options = {
        httpOnly: true,
        secure: true,
        sameSite: "none"
    };

    return res
        .status(200)
        .cookie("studentAccessToken", accessToken, options)
        .cookie("studentRefreshToken", refreshToken, options)
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
    const options = {
        httpOnly: true,
        secure: true,
        sameSite: "none"
    };

    return res
        .status(200)
        .clearCookie("studentAccessToken", options)
        .clearCookie("studentRefreshToken", options)
        .json(new ApiResponse(200, {}, "Student logged out successfully"));
});

// Get Student Profile
const getStudentProfile = asyncHandler(async (req, res) => {
    const student = await Student.findById(req.student._id)
        .select("-password")
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

    let filter = { student: req.student._id };

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

    const attendanceEntries = await AttendanceEntry.find(filter)
        .populate({
            path: 'attendance',
            select: 'date subject batch isFinal',
            match: subjectId ? { subject: subjectId } : {},
            populate: [
                { path: 'subject', select: 'name' },
                { path: 'batch', select: 'name' }
            ]
        })
        .sort({ createdAt: -1 });

    // Filter out entries where attendance is null (doesn't match subject filter)
    const validEntries = attendanceEntries.filter(entry => entry.attendance !== null);

    // Calculate statistics
    const totalClasses = validEntries.length;
    const presentCount = validEntries.filter(e => e.status === 'PRESENT').length;
    const absentCount = validEntries.filter(e => e.status === 'ABSENT').length;
    const attendancePercentage = totalClasses > 0
        ? ((presentCount / totalClasses) * 100).toFixed(2)
        : 0;

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                {
                    attendanceEntries: validEntries,
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

export {
    loginStudent,
    logoutStudent,
    getStudentProfile,
    getStudentBatch,
    getStudentSubjects,
    getSubjectUnits,
    getUnitMaterials,
    getStudentAttendanceHistory
};