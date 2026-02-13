import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Attendance } from "../models/attendance.model.js";
import { AttendanceEntry } from "../models/attendanceEntry.model.js";
import { AttendanceEntry } from "../models/attendanceEntry.model.js";
import { Student } from "../models/student.model.js";
import { Subject } from "../models/subject.model.js";
import { Batch } from "../models/batch.model.js";
import { StudentSubject } from "../models/studentSubject.model.js";

/**
 * Create new attendance session for a subject
 * POST /api/v1/attendance/create
 * Body: { subjectId, batchId, date }
 */
const createAttendance = asyncHandler(async (req, res) => {
    const { subjectId, batchId, date } = req.body;

    // Validation
    if (!subjectId || subjectId.trim() === "") {
        throw new ApiError(400, "Subject ID is required");
    }
    if (!batchId || batchId.trim() === "") {
        throw new ApiError(400, "Batch ID is required");
    }
    if (!date) {
        throw new ApiError(400, "Date is required");
    }

    // Verify subject and batch exist
    const subject = await Subject.findById(subjectId);
    if (!subject) {
        throw new ApiError(404, "Subject not found");
    }

    const batch = await Batch.findById(batchId);
    if (!batch) {
        throw new ApiError(404, "Batch not found");
    }

    // Verify subject belongs to the batch
    if (subject.batch.toString() !== batchId) {
        throw new ApiError(400, "Subject does not belong to this batch");
    }

    // Parse and normalize date (start of day)
    const attendanceDate = new Date(date);
    attendanceDate.setHours(0, 0, 0, 0);

    // Check if attendance already exists for this date
    const existingAttendance = await Attendance.findOne({
        batch: batchId,
        subject: subjectId,
        date: attendanceDate
    });

    if (existingAttendance) {
        throw new ApiError(409, "Attendance already exists for this date and subject");
    }

    // Create attendance session
    const attendance = await Attendance.create({
        batch: batchId,
        subject: subjectId,
        date: attendanceDate,
        takenBy: req.user._id,
        isFinal: false
    });

    // Populate details
    const populatedAttendance = await Attendance.findById(attendance._id)
        .populate('batch', 'name')
        .populate('subject', 'name')
        .populate('takenBy', 'name email');

    return res.status(201).json(
        new ApiResponse(201, populatedAttendance, "Attendance session created successfully")
    );
});

/**
 * Mark attendance for students
 * POST /api/v1/attendance/mark
 * Body: { attendanceId, attendanceEntries: [{ studentId, status }] }
 */
const markAttendance = asyncHandler(async (req, res) => {
    const { attendanceId, attendanceEntries } = req.body;

    // Validation
    if (!attendanceId || attendanceId.trim() === "") {
        throw new ApiError(400, "Attendance ID is required");
    }
    if (!attendanceEntries || !Array.isArray(attendanceEntries) || attendanceEntries.length === 0) {
        throw new ApiError(400, "Attendance entries are required");
    }

    // Verify attendance exists
    const attendance = await Attendance.findById(attendanceId);
    if (!attendance) {
        throw new ApiError(404, "Attendance session not found");
    }

    // Check if attendance is already finalized
    if (attendance.isFinal) {
        throw new ApiError(400, "Cannot modify finalized attendance");
    }

    const results = [];
    const errors = [];

    // Process each attendance entry
    for (const entry of attendanceEntries) {
        const { studentId, status } = entry;

        // Validate entry
        if (!studentId || !status) {
            errors.push({ studentId, error: "Student ID and status are required" });
            continue;
        }

        if (!["PRESENT", "ABSENT"].includes(status)) {
            errors.push({ studentId, error: "Status must be PRESENT or ABSENT" });
            continue;
        }

        // Verify student exists
        const student = await Student.findById(studentId);
        if (!student) {
            errors.push({ studentId, error: "Student not found" });
            continue;
        }

        // Verify student belongs to the batch
        if (student.batch.toString() !== attendance.batch.toString()) {
            errors.push({ studentId, error: "Student does not belong to this batch" });
            continue;
        }

        // Verify student is enrolled in the subject
        const enrollment = await StudentSubject.findOne({
            student: studentId,
            subject: attendance.subject
        });

        if (!enrollment) {
            errors.push({ studentId, error: "Student is not enrolled in this subject" });
            continue;
        }

        try {
            // Update or create attendance entry
            const attendanceEntry = await AttendanceEntry.findOneAndUpdate(
                {
                    attendance: attendanceId,
                    student: studentId
                },
                {
                    status: status
                },
                {
                    new: true,
                    upsert: true,
                    runValidators: true
                }
            ).populate('student', 'name rollNumber mobile');

            results.push(attendanceEntry);
        } catch (error) {
            if (error.code === 11000) {
                errors.push({ studentId, error: "Duplicate attendance entry" });
            } else {
                errors.push({ studentId, error: error.message });
            }
        }
    }

    return res.status(200).json(
        new ApiResponse(200, {
            success: results,
            errors: errors,
            totalProcessed: attendanceEntries.length,
            successCount: results.length,
            errorCount: errors.length
        }, "Attendance marked successfully")
    );
});

/**
 * Finalize attendance and send WhatsApp notifications to parents of absent students
 * POST /api/v1/attendance/finalize
 * Body: { attendanceId }
 */
const finalizeAttendance = asyncHandler(async (req, res) => {
    const { attendanceId } = req.body;

    if (!attendanceId || attendanceId.trim() === "") {
        throw new ApiError(400, "Attendance ID is required");
    }

    const attendance = await Attendance.findById(attendanceId)
        .populate('batch', 'name')
        .populate('subject', 'name');

    if (!attendance) {
        throw new ApiError(404, "Attendance session not found");
    }

    if (attendance.isFinal) {
        throw new ApiError(400, "Attendance is already finalized");
    }

    // Get all absent students
    const absentEntries = await AttendanceEntry.find({
        attendance: attendanceId,
        status: "ABSENT"
    }).populate('student', 'name rollNumber parentName parentMobile');

    // Mark as final
    attendance.isFinal = true;
    await attendance.save();

    return res.status(200).json(
        new ApiResponse(200, {
            attendance,
            absentCount: absentEntries.length,
        }, "Attendance finalized successfully")
    );
});


/**
 * Get attendance details by ID
 * GET /api/v1/attendance/:attendanceId
 */
const getAttendanceById = asyncHandler(async (req, res) => {
    const { attendanceId } = req.body;

    if (!attendanceId || attendanceId.trim() === "") {
        throw new ApiError(400, "Attendance ID is required");
    }

    const attendance = await Attendance.findById(attendanceId)
        .populate('batch', 'name')
        .populate('subject', 'name')
        .populate('takenBy', 'name email');

    if (!attendance) {
        throw new ApiError(404, "Attendance not found");
    }

    // Get all attendance entries
    const entries = await AttendanceEntry.find({ attendance: attendanceId })
        .populate('student', 'name rollNumber mobile parentName parentMobile')
        .sort({ 'student.rollNumber': 1 });

    // Calculate statistics
    const totalStudents = entries.length;
    const presentCount = entries.filter(e => e.status === "PRESENT").length;
    const absentCount = entries.filter(e => e.status === "ABSENT").length;
    const attendancePercentage = totalStudents > 0
        ? ((presentCount / totalStudents) * 100).toFixed(2)
        : 0;

    return res.status(200).json(
        new ApiResponse(200, {
            attendance,
            entries,
            statistics: {
                totalStudents,
                present: presentCount,
                absent: absentCount,
                attendancePercentage: parseFloat(attendancePercentage)
            }
        }, "Attendance details fetched successfully")
    );
});

/**
 * Get all attendance sessions (with filters)
 * GET /api/v1/attendance/list
 * Query params: batchId, subjectId, startDate, endDate, isFinal
 */
const getAllAttendance = asyncHandler(async (req, res) => {
    const { batchId, subjectId, startDate, endDate, isFinal } = req.query;

    const filter = {};

    if (batchId) filter.batch = batchId;
    if (subjectId) filter.subject = subjectId;
    if (isFinal !== undefined) filter.isFinal = isFinal === 'true';

    if (startDate || endDate) {
        filter.date = {};
        if (startDate) {
            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0);
            filter.date.$gte = start;
        }
        if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            filter.date.$lte = end;
        }
    }

    const attendanceSessions = await Attendance.find(filter)
        .populate('batch', 'name')
        .populate('subject', 'name')
        .populate('takenBy', 'name email')
        .sort({ date: -1, createdAt: -1 });

    // Get entry counts for each session
    const sessionsWithCounts = await Promise.all(
        attendanceSessions.map(async (session) => {
            const entries = await AttendanceEntry.find({ attendance: session._id });
            const presentCount = entries.filter(e => e.status === "PRESENT").length;
            const absentCount = entries.filter(e => e.status === "ABSENT").length;

            return {
                ...session.toObject(),
                statistics: {
                    totalStudents: entries.length,
                    present: presentCount,
                    absent: absentCount,
                    attendancePercentage: entries.length > 0
                        ? ((presentCount / entries.length) * 100).toFixed(2)
                        : 0
                }
            };
        })
    );

    return res.status(200).json(
        new ApiResponse(200, sessionsWithCounts, "Attendance sessions fetched successfully")
    );
});

/**
 * Update attendance entry
 * PATCH /api/v1/attendance/update-entry
 * Body: { attendanceId, studentId, status }
 */
const updateAttendanceEntry = asyncHandler(async (req, res) => {
    const { attendanceId, studentId, status } = req.body;

    if (!attendanceId || !studentId || !status) {
        throw new ApiError(400, "Attendance ID, Student ID, and status are required");
    }

    if (!["PRESENT", "ABSENT"].includes(status)) {
        throw new ApiError(400, "Status must be PRESENT or ABSENT");
    }

    const attendance = await Attendance.findById(attendanceId);
    if (!attendance) {
        throw new ApiError(404, "Attendance session not found");
    }

    if (attendance.isFinal) {
        throw new ApiError(400, "Cannot modify finalized attendance");
    }

    const entry = await AttendanceEntry.findOneAndUpdate(
        { attendance: attendanceId, student: studentId },
        { status },
        { new: true, runValidators: true }
    ).populate('student', 'name rollNumber');

    if (!entry) {
        throw new ApiError(404, "Attendance entry not found");
    }

    return res.status(200).json(
        new ApiResponse(200, entry, "Attendance entry updated successfully")
    );
});

/**
 * Delete attendance session
 * DELETE /api/v1/attendance/delete
 * Body: { attendanceId }
 */
const deleteAttendance = asyncHandler(async (req, res) => {
    const { attendanceId } = req.body;

    if (!attendanceId || attendanceId.trim() === "") {
        throw new ApiError(400, "Attendance ID is required");
    }

    const attendance = await Attendance.findById(attendanceId);
    if (!attendance) {
        throw new ApiError(404, "Attendance session not found");
    }

    if (attendance.isFinal) {
        throw new ApiError(400, "Cannot delete finalized attendance. Unfinalize it first.");
    }

    // Delete all attendance entries
    await AttendanceEntry.deleteMany({ attendance: attendanceId });

    // Delete WhatsApp logs

    // Delete attendance session
    await attendance.deleteOne();

    return res.status(200).json(
        new ApiResponse(200, {}, "Attendance session deleted successfully")
    );
});

/**
 * Unfinalize attendance (allow modifications again)
 * PATCH /api/v1/attendance/unfinalize
 * Body: { attendanceId }
 */
const unfinalizeAttendance = asyncHandler(async (req, res) => {
    const { attendanceId } = req.body;

    if (!attendanceId || attendanceId.trim() === "") {
        throw new ApiError(400, "Attendance ID is required");
    }

    const attendance = await Attendance.findById(attendanceId);
    if (!attendance) {
        throw new ApiError(404, "Attendance session not found");
    }

    if (!attendance.isFinal) {
        throw new ApiError(400, "Attendance is not finalized");
    }

    attendance.isFinal = false;
    await attendance.save();

    return res.status(200).json(
        new ApiResponse(200, attendance, "Attendance unfinalized successfully")
    );
});

/**
 * Get attendance report for a batch/subject
 * GET /api/v1/attendance/report
 * Query: batchId, subjectId, startDate, endDate
 */
const getAttendanceReport = asyncHandler(async (req, res) => {
    const { batchId, subjectId, startDate, endDate } = req.query;

    if (!batchId && !subjectId) {
        throw new ApiError(400, "Either Batch ID or Subject ID is required");
    }

    const filter = {};
    if (batchId) filter.batch = batchId;
    if (subjectId) filter.subject = subjectId;

    if (startDate || endDate) {
        filter.date = {};
        if (startDate) {
            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0);
            filter.date.$gte = start;
        }
        if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            filter.date.$lte = end;
        }
    }

    // Get all attendance sessions
    const sessions = await Attendance.find(filter)
        .populate('subject', 'name')
        .sort({ date: 1 });

    if (sessions.length === 0) {
        return res.status(200).json(
            new ApiResponse(200, {
                sessions: [],
                studentReports: [],
                overallStatistics: {
                    totalSessions: 0,
                    totalStudents: 0,
                    averageAttendance: 0
                }
            }, "No attendance data found")
        );
    }

    // Get all students
    const students = await Student.find({ batch: batchId }).select('name rollNumber').sort({ rollNumber: 1 });

    // Build student-wise report
    const studentReports = await Promise.all(
        students.map(async (student) => {
            const entries = await AttendanceEntry.find({
                student: student._id,
                attendance: { $in: sessions.map(s => s._id) }
            });

            const totalClasses = entries.length;
            const presentCount = entries.filter(e => e.status === "PRESENT").length;
            const absentCount = entries.filter(e => e.status === "ABSENT").length;
            const percentage = totalClasses > 0
                ? ((presentCount / totalClasses) * 100).toFixed(2)
                : 0;

            return {
                student: {
                    _id: student._id,
                    name: student.name,
                    rollNumber: student.rollNumber
                },
                totalClasses,
                present: presentCount,
                absent: absentCount,
                attendancePercentage: parseFloat(percentage)
            };
        })
    );

    // Overall statistics
    const totalSessions = sessions.length;
    const totalStudents = students.length;
    const averageAttendance = studentReports.length > 0
        ? (studentReports.reduce((sum, s) => sum + s.attendancePercentage, 0) / studentReports.length).toFixed(2)
        : 0;

    return res.status(200).json(
        new ApiResponse(200, {
            sessions,
            studentReports,
            overallStatistics: {
                totalSessions,
                totalStudents,
                averageAttendance: parseFloat(averageAttendance)
            }
        }, "Attendance report generated successfully")
    );
});

export {
    createAttendance,
    markAttendance,
    finalizeAttendance,
    getAttendanceById,
    getAllAttendance,
    updateAttendanceEntry,
    deleteAttendance,
    unfinalizeAttendance,
    getAttendanceReport
};