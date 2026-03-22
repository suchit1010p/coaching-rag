import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Attendance } from "../models/attendance.model.js";
import { AttendanceEntry } from "../models/attendanceEntry.model.js";
import { Student } from "../models/student.model.js";
import { Subject } from "../models/subject.model.js";
import { Batch } from "../models/batch.model.js";
import { StudentSubject } from "../models/studentSubject.model.js";
import { sendAbsenceEmail } from "../utils/mail.js";

const getEnrolledStudentCount = async (subjectId) => {
    return StudentSubject.countDocuments({ subject: subjectId });
};

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
        takenBy: req.user._id
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
    if (!Array.isArray(attendanceEntries)) {
        throw new ApiError(400, "Attendance entries must be an array");
    }

    // Verify attendance exists
    const attendance = await Attendance.findById(attendanceId);
    if (!attendance) {
        throw new ApiError(404, "Attendance session not found");
    }

    const results = [];
    const errors = [];
    const validatedAbsentStudents = [];

    // Validate each submitted entry before replacing stored absences.
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

        if (status === "ABSENT") {
            validatedAbsentStudents.push({
                studentId: student._id,
                student: {
                    _id: student._id,
                    name: student.name,
                    rollNumber: student.rollNumber,
                    mobile: student.mobile
                }
            });
        }
    }

    await AttendanceEntry.deleteMany({ attendance: attendanceId });

    for (const entry of validatedAbsentStudents) {
        try {
            const attendanceEntry = await AttendanceEntry.findOneAndUpdate(
                {
                    attendance: attendanceId,
                    student: entry.studentId
                },
                {
                    status: "ABSENT"
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
                errors.push({ studentId: entry.studentId, error: "Duplicate attendance entry" });
            } else {
                errors.push({ studentId: entry.studentId, error: error.message });
            }
        }
    }

    // Send absence emails asynchronously (fire-and-forget)
    if (results.length > 0) {
        const populatedAttendance = await Attendance.findById(attendanceId)
            .populate('batch', 'name')
            .populate('subject', 'name');

        const subjectName = populatedAttendance?.subject?.name || "Unknown Subject";
        const batchName = populatedAttendance?.batch?.name || "Unknown Batch";
        const attendanceDate = populatedAttendance?.date;

        for (const entry of results) {
            const studentId = entry.student?._id || entry.student;
            Student.findById(studentId).select('email name').then((student) => {
                if (student?.email) {
                    sendAbsenceEmail(student.email, student.name, subjectName, batchName, attendanceDate)
                        .catch(err => console.error('Failed to send absence email:', err));
                }
            }).catch(err => console.error('Failed to fetch student for absence email:', err));
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
 * Get attendance details by ID
 * GET /api/v1/attendance/:attendanceId
 */
const getAttendanceById = asyncHandler(async (req, res) => {
    const attendanceId = req.query?.attendanceId || req.body?.attendanceId;

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

    const subjectId = attendance.subject?._id || attendance.subject;

    const [absentEntries, enrolledStudents] = await Promise.all([
        AttendanceEntry.find({ attendance: attendanceId, status: "ABSENT" })
            .populate('student', 'name rollNumber mobile parentName fatherMobile motherMobile')
            .lean(),
        StudentSubject.find({ subject: subjectId })
            .populate('student', 'name rollNumber mobile parentName fatherMobile motherMobile')
            .lean()
    ]);

    const entryMap = new Map();

    enrolledStudents.forEach((enrollment) => {
        const student = enrollment.student;

        if (!student?._id) {
            return;
        }

        entryMap.set(student._id.toString(), {
            _id: student._id.toString(),
            attendance: attendance._id,
            student,
            status: "PRESENT",
            createdAt: attendance.createdAt,
            updatedAt: attendance.updatedAt
        });
    });

    absentEntries.forEach((entry) => {
        const student = entry.student;

        if (!student?._id) {
            return;
        }

        entryMap.set(student._id.toString(), {
            _id: entry._id.toString(),
            attendance: entry.attendance,
            student,
            status: "ABSENT",
            createdAt: entry.createdAt,
            updatedAt: entry.updatedAt
        });
    });

    const entries = Array.from(entryMap.values()).sort((a, b) => {
        const rollA = Number.isFinite(a.student?.rollNumber) ? a.student.rollNumber : Number.MAX_SAFE_INTEGER;
        const rollB = Number.isFinite(b.student?.rollNumber) ? b.student.rollNumber : Number.MAX_SAFE_INTEGER;

        if (rollA !== rollB) {
            return rollA - rollB;
        }

        return String(a.student?.name || "").localeCompare(String(b.student?.name || ""));
    });

    // Calculate statistics
    const totalStudents = entries.length;
    const absentCount = entries.filter((entry) => entry.status === "ABSENT").length;
    const presentCount = Math.max(totalStudents - absentCount, 0);
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
 * Query params: batchId, subjectId, startDate, endDate
 */
const getAllAttendance = asyncHandler(async (req, res) => {
    const { batchId, subjectId, startDate, endDate } = req.query;

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

    const attendanceSessions = await Attendance.find(filter)
        .populate('batch', 'name')
        .populate('subject', 'name')
        .populate('takenBy', 'name email')
        .sort({ date: -1, createdAt: -1 });

    // Get entry counts for each session
    const sessionsWithCounts = await Promise.all(
        attendanceSessions.map(async (session) => {
            const [totalStudents, absentCount] = await Promise.all([
                getEnrolledStudentCount(session.subject?._id || session.subject),
                AttendanceEntry.countDocuments({ attendance: session._id, status: "ABSENT" })
            ]);
            const presentCount = Math.max(totalStudents - absentCount, 0);

            return {
                ...session.toObject(),
                statistics: {
                    totalStudents,
                    present: presentCount,
                    absent: absentCount,
                    attendancePercentage: totalStudents > 0
                        ? ((presentCount / totalStudents) * 100).toFixed(2)
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

    let entry;

    if (status === "ABSENT") {
        entry = await AttendanceEntry.findOneAndUpdate(
            { attendance: attendanceId, student: studentId },
            { status: "ABSENT" },
            { new: true, upsert: true, runValidators: true }
        ).populate('student', 'name rollNumber');
    } else {
        await AttendanceEntry.deleteOne({ attendance: attendanceId, student: studentId });
        entry = {
            attendance: attendanceId,
            student: studentId,
            status: "PRESENT"
        };
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
    const effectiveBatchId = batchId || sessions[0]?.batch;
    const students = effectiveBatchId
        ? await Student.find({ batch: effectiveBatchId }).select('name rollNumber').sort({ rollNumber: 1 })
        : [];

    // Build student-wise report
    const studentReports = await Promise.all(
        students.map(async (student) => {
            const absentCount = await AttendanceEntry.countDocuments({
                student: student._id,
                attendance: { $in: sessions.map(s => s._id) },
                status: "ABSENT"
            });

            const totalClasses = sessions.length;
            const presentCount = Math.max(totalClasses - absentCount, 0);
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
    getAttendanceById,
    getAllAttendance,
    updateAttendanceEntry,
    deleteAttendance,
    getAttendanceReport
};
