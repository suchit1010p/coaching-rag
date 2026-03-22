import { asyncHandler } from "../utils/asyncHandler.js";
import { User } from "../models/user.model.js";
import jwt from "jsonwebtoken";
import { ApiResponse } from "../utils/ApiResponse.js"
import { ApiError } from "../utils/ApiError.js";
import { generateAccessAndRefereshTokens } from "../utils/GenerateToken.js";
import { Student } from "../models/student.model.js";
import { Batch } from "../models/batch.model.js";
import { Subject } from "../models/subject.model.js";
import { StudentSubject } from "../models/studentSubject.model.js";
import { AttendanceEntry } from "../models/attendanceEntry.model.js";
import { Unit } from "../models/unit.model.js";
import { Material } from "../models/material.model.js";
import { sendVerificationEmail, sendTeacherRegistrationEmail } from "../utils/mail.js";
import { uploadVerificationFile, deleteFromS3 } from "../utils/s3.js";
import { Attendance } from "../models/attendance.model.js";

const getCookieMaxAges = () => {
    const accessTokenCookieDays = Number(process.env.ACCESS_TOKEN_COOKIE_DAYS || 1);
    const refreshTokenCookieDays = Number(process.env.REFRESH_TOKEN_COOKIE_DAYS || 90);

    return {
        accessTokenMaxAge: accessTokenCookieDays * 24 * 60 * 60 * 1000,
        refreshTokenMaxAge: refreshTokenCookieDays * 24 * 60 * 60 * 1000
    };
};

const sendStudentVerificationMail = async ({ studentId, email, name, batchName, mobile, password }) => {
    const presignedUrl = await uploadVerificationFile(studentId, email);
    const verificationUrl = `${process.env.BACKEND_URL || 'http://localhost:8000'}/api/v1/students/verify-email?token=${encodeURIComponent(presignedUrl)}`;

    await sendVerificationEmail(email, name, verificationUrl, batchName, mobile, password);
};

const getCookieOptions = () => {
    const isProduction = process.env.NODE_ENV === "production";
    const { accessTokenMaxAge, refreshTokenMaxAge } = getCookieMaxAges();

    return {
        access: {
            httpOnly: true,
            secure: isProduction,
            sameSite: isProduction ? "none" : "lax",
            maxAge: accessTokenMaxAge
        },
        refresh: {
            httpOnly: true,
            secure: isProduction,
            sameSite: isProduction ? "none" : "lax",
            maxAge: refreshTokenMaxAge
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


// register user
const registerUser = asyncHandler(async (req, res) => {
    const { name, email, mobile, password } = req.body

    if (
        [name, email, mobile, password].some((field) => field?.trim() === "")
    ) {
        throw new ApiError(400, "All fields are required")
    }

    const existedUser = await User.findOne({ $or: [{ email }, { mobile }] })

    if (existedUser) throw new ApiError(409, "User with email or mobile exists")

    const user = await User.create({
        name,
        email,
        mobile,
        password
    })

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    const { accessToken, refreshToken } = await generateAccessAndRefereshTokens(user._id)

    const options = getCookieOptions();

    if (!createdUser) {
        throw new ApiError(500, "Something went wrong while registering the user")
    }

    await sendTeacherRegistrationEmail(email, name, mobile, password);

    return res
        .status(201)
        .cookie("accessToken", accessToken, options.access)
        .cookie("refreshToken", refreshToken, options.refresh)
        .json(
            new ApiResponse(201, createdUser, "User registered Successfully")
        )
});

// login user
const loginUser = asyncHandler(async (req, res) => {
    const { mobile, password } = req.body

    if (!mobile) throw new ApiError(400, "mobile is required")
    if (!password) throw new ApiError(400, "password is required")

    const normalizedMobile = mobile.trim();
    const user = await User.findOne({ mobile: normalizedMobile })

    if (!user) {
        throw new ApiError(404, "user does not exist, Please register!!")
    }

    const isPasswordCorrect = await user.isPasswordCorrect(password)

    if (!isPasswordCorrect) {
        throw new ApiError(401, "Invalid user credentials")
    }

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

    const { accessToken, refreshToken } = await generateAccessAndRefereshTokens(user._id)

    const options = getCookieOptions();

    return res
        .status(200)
        .cookie("accessToken", accessToken, options.access)
        .cookie("refreshToken", refreshToken, options.refresh)
        .json(
            new ApiResponse(
                200,
                {
                    user: loggedInUser, accessToken, refreshToken
                },
                "User logged In Successfully"
            )
        )
})

// logout user
const logoutUser = asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                refreshToken: null
            }
        },
        {
            new: true
        }
    )

    const options = getClearCookieOptions();

    return res
        .status(200)
        .clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)
        .json(
            new ApiResponse(200, {}, "User logged out Successfully")
        )
})

const refreshAccessToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken;

    if (!incomingRefreshToken) {
        throw new ApiError(401, "Unauthorized request");
    }

    try {
        const decodedToken = jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET
        );

        const user = await User.findById(decodedToken?._id).select("+refreshToken");

        if (!user) {
            throw new ApiError(401, "Invalid refresh token");
        }

        if (incomingRefreshToken !== user.refreshToken) {
            throw new ApiError(401, "Refresh token is expired or used");
        }

        const { accessToken, refreshToken: newRefreshToken } = await generateAccessAndRefereshTokens(user._id);
        const safeUser = await User.findById(user._id).select("-password -refreshToken");

        const options = getCookieOptions();

        return res
            .status(200)
            .cookie("accessToken", accessToken, options.access)
            .cookie("refreshToken", newRefreshToken, options.refresh)
            .json(
                new ApiResponse(
                    200,
                    { accessToken, refreshToken: newRefreshToken, user: safeUser },
                    "Access token refreshed successfully"
                )
            );
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid refresh token");
    }
});

// register student
const registerStudent = asyncHandler(async (req, res) => {
    const { rollNumber, name, mobile, email, password, parentName, fatherMobile, motherMobile, batchId } = req.body

    if (
        rollNumber === undefined ||
        rollNumber === null ||
        !name ||
        !mobile ||
        !email ||
        !password ||
        !parentName ||
        !fatherMobile ||
        !motherMobile ||
        !batchId
    ) {
        throw new ApiError(400, "All fields are required")
    }

    // Validate batch exists
    const batch = await Batch.findById(batchId)
    if (!batch) {
        throw new ApiError(404, "Batch not found")
    }

    // Check if student with same mobile already exists
    const normalizedMobile = mobile.trim()
    const existingStudentvMobile = await Student.findOne({ mobile: normalizedMobile })

    if (existingStudentvMobile) {
        throw new ApiError(409, "Student with this mobile number already exists")
    }

    // Check if student with same email already exists
    const normalizedEmail = email.toLowerCase().trim();
    const existingStudentEmail = await Student.findOne({ email: normalizedEmail });

    if (existingStudentEmail) {
        throw new ApiError(409, "Student with this email already exists");
    }

    // Check if rollNumber already exists in the batch
    const normalizedRollNumber = Number(rollNumber)
    if (Number.isNaN(normalizedRollNumber)) {
        throw new ApiError(400, "Roll number must be a valid number")
    }

    const rollNumberExists = await Student.findOne({ rollNumber: normalizedRollNumber, batch: batchId })

    if (rollNumberExists) {
        throw new ApiError(409, "Roll number already exists in this batch")
    }

    // Create student entry
    const student = await Student.create({
        rollNumber: normalizedRollNumber,
        name: name.trim(),
        mobile: normalizedMobile,
        email: normalizedEmail,
        password,
        parentName: parentName.trim(),
        fatherMobile: fatherMobile.trim(),
        motherMobile: motherMobile.trim(),
        batch: batchId
    })

    // Get student without password and populate batch details
    const studentUser = await Student.findById(student._id).select("-password").populate("batch", "name")

    if (!studentUser) {
        throw new ApiError(500, "Error while creating student")
    }

    // Upload verification file to S3 and get presigned URL
    await sendStudentVerificationMail({
        studentId: student._id.toString(),
        email: normalizedEmail,
        name: studentUser.name,
        batchName: studentUser.batch.name,
        mobile: studentUser.mobile,
        password
    });

    return res
        .status(201)
        .json(
            new ApiResponse(201, studentUser, "Student created successfully. Verification email sent.")
        )
})

const normalizeBulkStudentField = (value) => {
    if (value === undefined || value === null) {
        return ""
    }

    return String(value).trim()
}

const BULK_STUDENT_FIELD_ALIASES = {
    name: ["name", "student name", "student"],
    mobile: ["mobile", "mobile number", "student mobile", "phone", "phone number"],
    email: ["email", "email address", "mail"],
    dateOfBirth: ["dateOfBirth", "Date-of-birth", "Date-of-Birth", "date-of-birth", "date of birth", "dob"],
    parentName: ["parentName", "parent name", "parentname"],
    fatherMobile: ["fatherMobile", "father mobile number", "father mobile", "father mobile no"],
    motherMobile: ["motherMobile", "mother mobile number", "mother mobile", "mother mobile no"]
}

const normalizeBulkStudentKey = (value) => {
    return normalizeBulkStudentField(value)
        .toLowerCase()
        .replace(/[_-]+/g, " ")
        .replace(/\s+/g, " ")
}

const buildBulkStudentLookup = (student) => {
    if (!student || typeof student !== "object" || Array.isArray(student)) {
        return {}
    }

    return Object.entries(student).reduce((lookup, [key, value]) => {
        lookup[normalizeBulkStudentKey(key)] = value
        return lookup
    }, {})
}

const getBulkStudentMappedField = (lookup, aliases) => {
    for (const alias of aliases) {
        const value = normalizeBulkStudentField(lookup[normalizeBulkStudentKey(alias)])

        if (value !== "") {
            return value
        }
    }

    return ""
}

const bulkStudentsRegistration = asyncHandler(async (req, res) => {
    const { studentsData, batchId, subjects } = req.body

    if (!Array.isArray(studentsData) || studentsData.length === 0) {
        throw new ApiError(400, "studentsData must be a non-empty array")
    }

    if (!batchId || batchId.trim() === "") {
        throw new ApiError(400, "Batch ID is required")
    }

    const batch = await Batch.findById(batchId)
    if (!batch) {
        throw new ApiError(404, "Batch not found")
    }

    if (!subjects || !Array.isArray(subjects) || subjects.length === 0) {
        throw new ApiError(400, "Subjects are required and must be a non-empty array")
    }

    const normalizedSubjectIds = [...new Set(subjects.map((subjectId) => normalizeBulkStudentField(subjectId)))]

    if (normalizedSubjectIds.some((subjectId) => subjectId === "")) {
        throw new ApiError(400, "All subject IDs must be valid non-empty values")
    }

    const validSubjects = await Subject.find({ _id: { $in: normalizedSubjectIds }, batch: batch._id })

    if (validSubjects.length !== normalizedSubjectIds.length) {
        throw new ApiError(400, "One or more selected subjects do not belong to the selected batch")
    }

    const studentErrors = []
    const createdStudents = []
    const mailsData = []

    for (let i = 0; i < studentsData.length; i++) {
        const rawStudent = studentsData[i]
        const rowNumber = Number(rawStudent?.sourceRowNumber) || i + 1

        if (!rawStudent || typeof rawStudent !== "object" || Array.isArray(rawStudent)) {
            studentErrors.push(`Row ${rowNumber}: Invalid student data`)
            continue
        }

        const bulkStudentLookup = buildBulkStudentLookup(rawStudent)
        const name = getBulkStudentMappedField(bulkStudentLookup, BULK_STUDENT_FIELD_ALIASES.name)
        const mobile = getBulkStudentMappedField(bulkStudentLookup, BULK_STUDENT_FIELD_ALIASES.mobile)
        const email = getBulkStudentMappedField(bulkStudentLookup, BULK_STUDENT_FIELD_ALIASES.email).toLowerCase()
        const password = getBulkStudentMappedField(bulkStudentLookup, BULK_STUDENT_FIELD_ALIASES.dateOfBirth)
        const parentName = getBulkStudentMappedField(bulkStudentLookup, BULK_STUDENT_FIELD_ALIASES.parentName)
        const fatherMobile = getBulkStudentMappedField(bulkStudentLookup, BULK_STUDENT_FIELD_ALIASES.fatherMobile)
        const motherMobile = getBulkStudentMappedField(bulkStudentLookup, BULK_STUDENT_FIELD_ALIASES.motherMobile)
        const rollNumber = i + 1

        if (!name || !mobile || !email || !password || !parentName || !fatherMobile || !motherMobile) {
            studentErrors.push(`Row ${rowNumber}: All fields are required`)
            continue
        }

        const normalizedRollNumber = Number(rollNumber)

        if (Number.isNaN(normalizedRollNumber)) {
            studentErrors.push(`Row ${rowNumber}: Roll number must be a valid number`)
            continue
        }

        const existingStudentMobile = await Student.findOne({ mobile })
        if (existingStudentMobile) {
            studentErrors.push(`Row ${rowNumber}: Student with this mobile number already exists`)
            continue
        }

        const existingStudentEmail = await Student.findOne({ email })
        if (existingStudentEmail) {
            studentErrors.push(`Row ${rowNumber}: Student with this email already exists`)
            continue
        }

        const rollNumberExists = await Student.findOne({ rollNumber: normalizedRollNumber, batch: batchId })
        if (rollNumberExists) {
            studentErrors.push(`Row ${rowNumber}: Roll number already exists in this batch`)
            continue
        }

        let student = null

        try {
            student = await Student.create({
                rollNumber: normalizedRollNumber,
                name,
                mobile,
                email,
                password,
                parentName,
                fatherMobile,
                motherMobile,
                batch: batchId
            })

            await StudentSubject.insertMany(
                normalizedSubjectIds.map((subjectId) => ({ student: student._id, subject: subjectId }))
            )

            const studentUser = await Student.findById(student._id).select("-password").populate("batch", "name")

            if (!studentUser) {
                await StudentSubject.deleteMany({ student: student._id })
                await Student.findByIdAndDelete(student._id)
                studentErrors.push(`Row ${rowNumber}: Error while fetching created student`)
                continue
            }

            createdStudents.push(studentUser)
            mailsData.push({
                id: student._id.toString(),
                email,
                name,
                batchName: batch.name,
                mobile,
                password
            })
        } catch (error) {
            if (student?._id) {
                await StudentSubject.deleteMany({ student: student._id })
                await Student.findByIdAndDelete(student._id)
            }

            studentErrors.push(`Row ${rowNumber}: ${error?.message || "Failed to register student"}`)
        }
    }

    const emailErrors = await sendVerificationEmailInBulk(mailsData)
    const statusCode = createdStudents.length > 0 ? 201 : 400
    const allErrors = [...studentErrors, ...emailErrors]

    return res
        .status(statusCode)
        .json(
            new ApiResponse(
                statusCode,
                {
                    createdStudents,
                    createdCount: createdStudents.length,
                    failedCount: studentErrors.length,
                    emailFailedCount: emailErrors.length,
                    errors: allErrors
                },
                "Bulk student registration completed"
            )
        )
})

const sendVerificationEmailInBulk = async (mailsData) => {
    if (!Array.isArray(mailsData) || mailsData.length === 0) {
        return []
    }

    const results = await Promise.allSettled(
        mailsData.map(async (mailData) => {
            await sendStudentVerificationMail({
                studentId: mailData.id,
                email: mailData.email,
                name: mailData.name,
                batchName: mailData.batchName,
                mobile: mailData.mobile,
                password: mailData.password
            });
        })
    )

    return results.reduce((errors, result, index) => {
        if (result.status === "rejected") {
            errors.push(`Verification email failed for ${mailsData[index].email}: ${result.reason?.message || "Unknown error"}`)
        }

        return errors
    }, [])
}


// get all students
const getAllStudents = asyncHandler(async (req, res) => {
    const students = await Student.find().select("-password").populate('batch', 'name')
    
    return res
        .status(200)
        .json(
            new ApiResponse(200, students, "All students fetched successfully")
        )
})

const getStudentAttendanceHistoryForUser = asyncHandler(async (req, res) => {
    const studentId = req.query?.studentId || req.body?.studentId
    const subjectId = req.query?.subjectId || req.body?.subjectId

    if (!studentId || studentId.trim() === "") {
        throw new ApiError(400, "Student ID is required")
    }

    const student = await Student.findById(studentId).select("_id")

    if (!student) {
        throw new ApiError(404, "Student not found")
    }

    const enrollments = await StudentSubject.find({ student: student._id })
        .populate({
            path: "subject",
            select: "name"
        })
        .lean()

    const subjects = enrollments
        .map((enrollment) => enrollment.subject)
        .filter((subject) => subject?._id)
        .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")))

    if (subjectId) {
        const isEnrolledInSubject = subjects.some(
            (subject) => subject._id.toString() === subjectId
        )

        if (!isEnrolledInSubject) {
            throw new ApiError(403, "Student is not enrolled in this subject")
        }
    }

    const selectedSubjectId = subjectId || subjects[0]?._id?.toString() || null

    if (!selectedSubjectId) {
        return res
            .status(200)
            .json(
                new ApiResponse(
                    200,
                    {
                        subjects: [],
                        selectedSubjectId: null,
                        attendanceEntries: [],
                        statistics: null
                    },
                    "Student attendance history fetched successfully"
                )
            )
    }

    const attendanceSessions = await Attendance.find({ subject: selectedSubjectId })
        .populate({
            path: "subject",
            select: "name"
        })
        .populate({
            path: "batch",
            select: "name"
        })
        .sort({ date: -1, createdAt: -1 })

    const absentEntries = await AttendanceEntry.find({
        student: student._id,
        attendance: { $in: attendanceSessions.map((session) => session._id) },
        status: "ABSENT"
    }).lean()

    const absentEntriesByAttendanceId = new Map(
        absentEntries.map((entry) => [entry.attendance.toString(), entry])
    )

    const attendanceEntries = attendanceSessions.map((session) => {
        const absentEntry = absentEntriesByAttendanceId.get(session._id.toString())

        return {
            _id: absentEntry?._id?.toString() || session._id.toString(),
            attendance: session,
            student: student._id,
            status: absentEntry ? "ABSENT" : "PRESENT",
            createdAt: absentEntry?.createdAt || session.createdAt,
            updatedAt: absentEntry?.updatedAt || session.updatedAt
        }
    })

    const totalClasses = attendanceSessions.length
    const absentCount = absentEntries.length
    const presentCount = Math.max(totalClasses - absentCount, 0)
    const attendancePercentage = totalClasses > 0
        ? ((presentCount / totalClasses) * 100).toFixed(2)
        : 0

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                {
                    subjects,
                    selectedSubjectId,
                    attendanceEntries,
                    statistics: {
                        totalClasses,
                        present: presentCount,
                        absent: absentCount,
                        attendancePercentage: parseFloat(attendancePercentage)
                    }
                },
                "Student attendance history fetched successfully"
            )
        )
})

const getCurrentUser = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user?._id).select("-password -refreshToken");

    if (!user) {
        throw new ApiError(404, "User not found");
    }

    return res
        .status(200)
        .json(new ApiResponse(200, user, "User profile fetched successfully"));
})

const changeCurrentUserPassword = asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    if (
        typeof currentPassword !== "string" ||
        typeof newPassword !== "string" ||
        currentPassword.trim() === "" ||
        newPassword.trim() === ""
    ) {
        throw new ApiError(400, "Current password and new password are required");
    }

    const user = await User.findById(req.user?._id);

    if (!user) {
        throw new ApiError(404, "User not found");
    }

    const isPasswordCorrect = await user.isPasswordCorrect(currentPassword);

    if (!isPasswordCorrect) {
        throw new ApiError(401, "Current password is incorrect");
    }

    const isSamePassword = await user.isPasswordCorrect(newPassword);

    if (isSamePassword) {
        throw new ApiError(400, "New password must be different from current password");
    }

    user.password = newPassword;
    user.refreshToken = null;
    await user.save();

    const options = getClearCookieOptions();

    return res
        .status(200)
        .clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)
        .json(new ApiResponse(200, {}, "Password changed successfully. Please login again."));
})

// delete student
const deleteStudent = asyncHandler(async (req, res) => {
    const { studentId } = req.body
    if (!studentId || studentId.trim() === "") {
        throw new ApiError(400, "Student ID is required")
    }
    const student = await Student.findById(studentId)

    if (!student) {
        throw new ApiError(404, "Student not found")
    }

    await Promise.all([
        Student.findByIdAndDelete(studentId),
        StudentSubject.deleteMany({ student: student._id }),
        AttendanceEntry.deleteMany({ student: student._id })
    ])

    return res
        .status(200)
        .json(
            new ApiResponse(200, {}, "Student and related records deleted successfully")
        )
})

const updateStudentDetails = asyncHandler(async (req, res) => {
    const { studentId, rollNumber, name, email, mobile, parentName, fatherMobile, motherMobile } = req.body

    if (
        !studentId ||
        studentId.trim() === "" ||
        rollNumber === undefined ||
        rollNumber === null ||
        !name ||
        !email ||
        !mobile ||
        !parentName ||
        !fatherMobile ||
        !motherMobile
    ) {
        throw new ApiError(400, "All fields are required")
    }

    const student = await Student.findById(studentId)

    if (!student) {
        throw new ApiError(404, "Student not found")
    }

    const normalizedRollNumber = Number(rollNumber)
    if (Number.isNaN(normalizedRollNumber)) {
        throw new ApiError(400, "Roll number must be a valid number")
    }

    const normalizedName = name.trim()
    const normalizedEmail = email.toLowerCase().trim()
    const normalizedMobile = mobile.trim()
    const normalizedParentName = parentName.trim()
    const normalizedFatherMobile = fatherMobile.trim()
    const normalizedMotherMobile = motherMobile.trim()

    const mobileExists = await Student.findOne({
        mobile: normalizedMobile,
        _id: { $ne: student._id }
    })

    if (mobileExists) {
        throw new ApiError(409, "Student with this mobile number already exists")
    }

    const emailExists = await Student.findOne({
        email: normalizedEmail,
        _id: { $ne: student._id }
    })

    if (emailExists) {
        throw new ApiError(409, "Student with this email already exists")
    }

    const rollNumberExists = await Student.findOne({
        rollNumber: normalizedRollNumber,
        batch: student.batch,
        _id: { $ne: student._id }
    })

    if (rollNumberExists) {
        throw new ApiError(409, "Roll number already exists in this batch")
    }

    student.rollNumber = normalizedRollNumber
    student.name = normalizedName
    student.email = normalizedEmail
    student.mobile = normalizedMobile
    student.parentName = normalizedParentName
    student.fatherMobile = normalizedFatherMobile
    student.motherMobile = normalizedMotherMobile
    student.isVerified = false
    student.refreshToken = null
    await student.save()

    const updatedStudent = await Student.findById(student._id)
        .select("-password -refreshToken")
        .populate("batch", "name")

    if (!updatedStudent) {
        throw new ApiError(500, "Failed to fetch updated student")
    }

    await sendStudentVerificationMail({
        studentId: student._id.toString(),
        email: updatedStudent.email,
        name: updatedStudent.name,
        batchName: updatedStudent.batch?.name || "",
        mobile: updatedStudent.mobile,
        password: "Your current password (unchanged)"
    })

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                updatedStudent,
                "Student details updated successfully. Verification email sent again."
            )
        )
})

// create batch
const createBatch = asyncHandler(async (req, res) => {
    const { name } = req.body

    if (!name || name.trim() === "") {
        throw new ApiError(400, "Enter batch name")
    }

    const normalizedName = name.trim()

    const checkbatch = await Batch.findOne({ name: normalizedName })
    if (checkbatch) {
        throw new ApiError(409, "Batch Already Exists!!")
    }

    let batch
    try {
        batch = await Batch.create({ name: normalizedName })
    } catch (error) {
        if (error?.code === 11000) {
            throw new ApiError(409, "Batch Already Exists!!")
        }
        throw error
    }

    const Batchcreated = await Batch.findById(batch._id)

    if (!Batchcreated) {
        throw new ApiError(400, "Error while creating Batch")
    }

    return res
        .status(201)
        .json(
            new ApiResponse(201, Batchcreated, "Batch was created Successfully!!")
        )
})

// get all batches
const getAllBatches = asyncHandler(async (req, res) => {
    const batches = await Batch.find()

    return res
        .status(200)
        .json(
            new ApiResponse(200, batches, "All batches fetched successfully")
        )
})


// get all students of batch
const getAllStudentsOfBatch = asyncHandler(async (req, res) => {
    const batchId = req.query?.batchId || req.body?.batchId

    if (!batchId || batchId.trim() === "") {
        throw new ApiError(400, "Batch ID is required")
    }

    const batch = await Batch.findById(batchId)

    if (!batch) {
        throw new ApiError(404, "Batch not found")
    }

    const students = await Student.aggregate([
        { $match: { batch: batch._id } },
        { $project: { password: 0 } }
    ])

    return res
        .status(200)
        .json(
            new ApiResponse(200, students, "Students of batch fetched successfully")
        )
})


// delete batch and all that batch student  
const deleteBatch = asyncHandler(async (req, res) => {
    const { batchId } = req.body

    if (!batchId || batchId.trim() === "") {
        throw new ApiError(400, "Batch ID is required")
    }

    const batch = await Batch.findById(batchId)

    if (!batch) {
        throw new ApiError(404, "Batch not found")
    }

    // deleting all students, subjects and student subject entries, attendance and attendance entries, material, units of subjects of the batch and then deleting the batch

    await StudentSubject.deleteMany({ student: { $in: (await Student.find({ batch: batch._id })).map(student => student._id) } })

    await AttendanceEntry.deleteMany({ student: { $in: (await Student.find({ batch: batch._id })).map(student => student._id) } })
    await Attendance.deleteMany({ batch: batch._id })

    // delete material files from s3 and db
    const subjects = await Subject.find({ batch: batch._id })
    const subjectIds = subjects.map(s => s._id)
    const units = await Unit.find({ subject: { $in: subjectIds } })
    const unitIds = units.map(u => u._id)
    const materials = await Material.find({ unit: { $in: unitIds } })
    await Promise.all(materials.map(m => deleteFromS3(m.fileUrl)))
    await Material.deleteMany({ unit: { $in: unitIds } })

    await Unit.deleteMany({ subject: { $in: subjectIds } })

    await Student.deleteMany({ batch: batch._id })

    await Subject.deleteMany({ batch: batch._id })
    await Batch.findByIdAndDelete(batchId)

    return res
        .status(200)
        .json(
            new ApiResponse(200, {}, "Batch and associated students and subjects deleted successfully")
        )
})

// change student batch
const changeStudentBatch = asyncHandler(async (req, res) => {
    const { studentId, newBatchId, newSubjectIds } = req.body

    if (!studentId || studentId.trim() === "") {
        throw new ApiError(400, "Student ID is required")
    }
    if (!newBatchId || newBatchId.trim() === "") {
        throw new ApiError(400, "New Batch ID is required")
    }
    if (!Array.isArray(newSubjectIds) || newSubjectIds.length === 0) {
        throw new ApiError(400, "At least one subject must be selected")
    }

    const student = await Student.findById(studentId)

    if (!student) {
        throw new ApiError(404, "Student not found")
    }
    const newBatch = await Batch.findById(newBatchId)

    if (!newBatch) {
        throw new ApiError(404, "New Batch not found")
    }

    const checkExistingRollNumber = await Student.findOne({ rollNumber: student.rollNumber, batch: newBatch._id })

    if (checkExistingRollNumber) {
        throw new ApiError(409, "Another student with the same roll number exists in the new batch")
    }

    const subjects = await Subject.find({ _id: { $in: newSubjectIds }, batch: newBatch._id })

    if (subjects.length !== newSubjectIds.length) {
        throw new ApiError(400, "One or more selected subjects do not belong to the selected batch")
    }

    student.batch = newBatch._id
    await student.save()
    await StudentSubject.deleteMany({ student: student._id })
    await StudentSubject.insertMany(
        newSubjectIds.map((subjectId) => ({ student: student._id, subject: subjectId }))
    )

    await AttendanceEntry.deleteMany({ student: student._id })

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                { student, subjects },
                "Student batch and subjects updated successfully"
            )
        )
})

// chnange all student batch from one batch to another batch
const changeAllStudentsBatch = asyncHandler(async (req, res) => {
    const { oldBatchId, newBatchId, newsubjects } = req.body

    // checking------------

    if (!oldBatchId || oldBatchId.trim() === "") {
        throw new ApiError(400, "Old Batch ID is required")
    }

    if (!newBatchId || newBatchId.trim() === "") {
        throw new ApiError(400, "New Batch ID is required")
    }
    const oldBatch = await Batch.findById(oldBatchId)

    if (!oldBatch) {
        throw new ApiError(404, "Old Batch not found")
    }
    const newBatch = await Batch.findById(newBatchId)

    if (!newBatch) {
        throw new ApiError(404, "New Batch not found")
    }

    if (!Array.isArray(newsubjects) || newsubjects.length === 0) {
        throw new ApiError(400, "At least one subject must be selected")
    }

    // main logic------------

    // delete old batch attendace entries and attendance records

    try {
        await AttendanceEntry.deleteMany({ student: { $in: (await Student.find({ batch: oldBatch._id })).map(student => student._id) } })
        await Attendance.deleteMany({ batch: oldBatch._id })
    } catch (error) {
        throw new ApiError(500, "Error deleting old batch attendance records")
    }

    // deleting old student subject entries

    try {
        await StudentSubject.deleteMany({ student: { $in: (await Student.find({ batch: oldBatch._id })).map(student => student._id) } })
    } catch (error) {
        throw new ApiError(500, "Error deleting students from batch")
    }

    // enrolling all students of new batch to new subjects
    const students = await Student.find({ batch: oldBatch._id })

    const studentSubjectInserts = []

    students.forEach(student => {
        newsubjects.forEach(subjectId => {
            studentSubjectInserts.push({ student: student._id, subject: subjectId })
        })
    })

    try {
        await StudentSubject.insertMany(studentSubjectInserts)
    } catch (error) {
        throw new ApiError(500, "Error enrolling students to new subjects")
    }

    // updating batch for all students of old batch to new batch
    const result = await Student.updateMany(
        { batch: oldBatch._id },
        { $set: { batch: newBatch._id } }
    )

    // responce------------
    return res
        .status(200)
        .json(
            new ApiResponse(200, { result, students: studentSubjectInserts.length }, "All students batch updated successfully with new subjects")
        )
})

// create subject
const createSubject = asyncHandler(async (req, res) => {
    const { name, batchId } = req.body

    // checking----------------


    if (!name || name.trim() === "") {
        throw new ApiError(400, "Subject name is required")
    }
    if (!batchId || batchId.trim() === "") {
        throw new ApiError(400, "Batch ID is required")
    }

    const batch = await Batch.findById(batchId)

    if (!batch) {
        throw new ApiError(404, "Batch not found")
    }

    const normalizedName = name.trim()

    const existingSubject = await Subject.findOne({ name: normalizedName, batch: batch._id })

    if (existingSubject) {
        throw new ApiError(409, "Subject with the same name already exists in this batch")
    }



    // main logic------------------

    const subject = await Subject.create({ name: normalizedName, batch: batch._id })

    if (!subject) {
        throw new ApiError(500, "Something went wrong while creating the subject")
    }

    // responce------------------
    return res
        .status(201)
        .json(
            new ApiResponse(201, subject, "Subject created successfully")
        )
})

// get all subjects of batch
const getAllSubjectsOfBatch = asyncHandler(async (req, res) => {
    const batchId = req.query?.batchId || req.body?.batchId

    // checking----------------
    if (!batchId || batchId.trim() === "") {
        throw new ApiError(400, "Batch ID is required")
    }
    const batch = await Batch.findById(batchId)

    if (!batch) {
        throw new ApiError(404, "Batch not found")
    }
    const subjects = await Subject.find({ batch: batch._id })

    // responce------------------
    return res
        .status(200)
        .json(
            new ApiResponse(200, subjects, "Subjects of batch fetched successfully")
        )
})

// get all students of subject
const getAllStudentsOfSubject = asyncHandler(async (req, res) => {
    const subjectId = req.query?.subjectId || req.body?.subjectId

    // checking----------------
    if (!subjectId || subjectId.trim() === "") {
        throw new ApiError(400, "Subject ID is required")
    }

    const subject = await Subject.findById(subjectId)

    if (!subject) {
        throw new ApiError(404, "Subject not found")
    }

    // main logic------------------
    const studentSubjects = await StudentSubject.aggregate([
        { $match: { subject: subject._id } },
        {
            $lookup: {
                from: "students",
                localField: "student",
                foreignField: "_id",
                as: "studentDetails"
            }
        },
        { $unwind: "$studentDetails" },
        { $project: { "studentDetails.password": 0 } }
    ])

    // responce------------------
    return res
        .status(200)
        .json(
            new ApiResponse(200, studentSubjects, "Students of subject fetched successfully")
        )
})

// change subject name3
const changeSubjectName = asyncHandler(async (req, res) => {
    const { subjectId, newName } = req.body

    // checking----------------
    if (!subjectId || subjectId.trim() === "") {
        throw new ApiError(400, "Subject ID is required")
    }
    if (!newName || newName.trim() === "") {
        throw new ApiError(400, "New Subject name is required")
    }

    const subject = await Subject.findById(subjectId)

    if (!subject) {
        throw new ApiError(404, "Subject not found")
    }

    const normalizedNewName = newName.trim()

    const existingSubject = await Subject.findOne({ name: normalizedNewName, batch: subject.batch })

    if (existingSubject) {
        throw new ApiError(409, "Another subject with the same name already exists in this batch")
    }

    // main logic------------------

    subject.name = normalizedNewName
    await subject.save()

    // responce------------------
    return res
        .status(200)
        .json(
            new ApiResponse(200, subject, "Subject name updated successfully")
        )
})

// add student to subject
const addStudentToSubject = asyncHandler(async (req, res) => {
    const { subjectId, studentId } = req.body

    // checking----------------
    if (!subjectId || subjectId.trim() === "") {
        throw new ApiError(400, "Subject ID is required")
    }
    if (!studentId || studentId.trim() === "") {
        throw new ApiError(400, "Student ID is required")
    }

    const subject = await Subject.findById(subjectId)

    if (!subject) {
        throw new ApiError(404, "Subject not found")
    }
    const student = await Student.findById(studentId)

    if (!student) {
        throw new ApiError(404, "Student not found")
    }

    // main logic------------------

    // check if student already enrolled
    const isEnrolled = await StudentSubject.findOne({ student: student._id, subject: subject._id })
    if (isEnrolled) {
        throw new ApiError(409, "Student is already enrolled in this subject")
    }

    const newStudentSubject = await StudentSubject.create({ student: student._id, subject: subject._id })

    // responce------------------
    return res
        .status(200)
        .json(
            new ApiResponse(200, newStudentSubject, "Student added to subject successfully")
        )
})

// delete subject from batch
const deleteSubjectFromBatch = asyncHandler(async (req, res) => {
    const { subjectId } = req.body

    // checking----------------
    if (!subjectId || subjectId.trim() === "") {
        throw new ApiError(400, "Subject ID is required")
    }

    const subject = await Subject.findById(subjectId)

    if (!subject) {
        throw new ApiError(404, "Subject not found")
    }

    // main logic------------------
    // deleting all units, materials and student subject entries of the subject and then deleting the subject

    const units = await Unit.find({ subject: subject._id })

    const unitIds = units.map(unit => unit._id)

    try {
        const materials = await Material.find({ unit: { $in: unitIds } })
        await Promise.all(materials.map(m => deleteFromS3(m.fileUrl)))
        await Material.deleteMany({ unit: { $in: unitIds } })
        await Unit.deleteMany({ subject: subject._id })
    } catch (error) {
        throw new ApiError(500, "Error deleting subject units and materials")
    }

    try {
        await AttendanceEntry.deleteMany({ subject: subject._id })
        await Attendance.deleteMany({ subject: subject._id })
    } catch (error) {
        throw new ApiError(500, "Error while deleting attendance records of subject students")
    }
    
    await StudentSubject.deleteMany({ subject: subject._id })
    await subject.deleteOne()

    // responce------------------
    return res
        .status(200)
        .json(
            new ApiResponse(200, {}, "Subject deleted from batch successfully")
        )
})

// Add unit to subject
const addUnit = asyncHandler(async (req, res) => {
    const { subjectId, unitName } = req.body

    // checking----------------
    if (!subjectId || subjectId.trim() === "") {
        throw new ApiError(400, "Subject ID is required")
    }
    if (!unitName || unitName.trim() === "") {
        throw new ApiError(400, "Unit name is required")
    }

    const subject = await Subject.findById(subjectId)

    if (!subject) {
        throw new ApiError(404, "Subject not found")
    }

    // main logic------------------
    const normalizedUnitName = unitName.trim()

    const existingUnit = await Unit.findOne({ subject: subject._id, title: normalizedUnitName })

    if (existingUnit) {
        throw new ApiError(409, "Another unit with the same name already exists in this subject")
    }

    const newUnit = await Unit.create({ subject: subject._id, title: normalizedUnitName })

    // responce------------------
    return res
        .status(200)
        .json(
            new ApiResponse(200, newUnit, "Unit added to subject successfully")
        )
})

// get all units of subject
const getAllUnitsOfSubject = asyncHandler(async (req, res) => {
    const subjectId = req.query?.subjectId || req.body?.subjectId

    // checking----------------
    if (!subjectId || subjectId.trim() === "") {
        throw new ApiError(400, "Subject ID is required")
    }

    const subject = await Subject.findById(subjectId)

    if (!subject) {
        throw new ApiError(404, "Subject not found")
    }

    const units = await Unit.find({ subject: subject._id }).sort({ createdAt: 1 })

    // responce------------------
    return res
        .status(200)
        .json(
            new ApiResponse(200, units, "Units of subject fetched successfully")
        )
})

// change unit name
const changeUnitName = asyncHandler(async (req, res) => {
    const { unitId, newName } = req.body

    // checking----------------
    if (!unitId || unitId.trim() === "") {
        throw new ApiError(400, "Unit ID is required")
    }
    if (!newName || newName.trim() === "") {
        throw new ApiError(400, "New Unit name is required")
    }

    const unit = await Unit.findById(unitId)

    if (!unit) {
        throw new ApiError(404, "Unit not found")
    }

    const normalizedNewName = newName.trim()

    const existingUnit = await Unit.findOne({ title: normalizedNewName, subject: unit.subject })

    if (existingUnit) {
        throw new ApiError(409, "Another unit with the same name already exists in this subject")
    }

    unit.title = normalizedNewName
    await unit.save()

    // responce------------------
    return res
        .status(200)
        .json(
            new ApiResponse(200, unit, "Unit name changed successfully")
        )
})

// delete unit from subject
const deleteUnitFromSubject = asyncHandler(async (req, res) => {
    const { unitId } = req.body

    // checking----------------
    if (!unitId || unitId.trim() === "") {
        throw new ApiError(400, "Unit ID is required")
    }

    const unit = await Unit.findById(unitId)

    if (!unit) {
        throw new ApiError(404, "Unit not found")
    }

    // delete material files from s3 and db
    const materials = await Material.find({ unit: unit._id })
    await Promise.all(materials.map(m => deleteFromS3(m.fileUrl)))
    await Material.deleteMany({ unit: unit._id })

    await unit.deleteOne()

    // responce------------------
    return res
        .status(200)
        .json(
            new ApiResponse(200, {}, "Unit deleted from subject successfully")
        )
})


// deleting all students from batch 
const deleteAllStudentsFromBatch = asyncHandler(async (req, res) => {

    const { batchId } = req.body
    if (!batchId || batchId.trim() === "") {
        throw new ApiError(400, "Batch ID is required")
    }

    const batch = await Batch.findById(batchId)

    if (!batch) {
        throw new ApiError(404, "Batch not found")
    }

    const subjects = await Subject.find({ batch: batch._id }).populate("_id")

    const subjectIds = subjects.map(subject => subject._id)

    try {
        for (const subjectId of subjectIds) {
            await StudentSubject.deleteMany({ subject: subjectId })
        }
    } catch (error) {
        throw new ApiError(500, "Error deleting students from batch")
    }

    const attendance = await Attendance.find({ batch: batch._id }).populate("_id")
    const attendanceIds = attendance.map(att => att._id)

    try {
        for (const attendanceId of attendanceIds) {
            await AttendanceEntry.deleteMany({ attendance: attendanceId })
        }
        await Attendance.deleteMany({ batch: batch._id })
    } catch (error) {
        throw new ApiError(500, "Error deleting attendance records of batch")
    }

    await Student.deleteMany({ batch: batch._id })


    return res
        .status(200)
        .json(
            new ApiResponse(200, {}, "All students of batch deleted successfully")
        )

})

const deleteAllAttendanceFromBatch = asyncHandler(async (req, res) => {
    const { batchId } = req.body

    if (!batchId || batchId.trim() === "") {
        throw new ApiError(400, "Batch ID is required")
    }

    const batch = await Batch.findById(batchId)

    if (!batch) {
        throw new ApiError(404, "Batch not found")
    }

    const attendanceIds = await Attendance.find({ batch: batch._id }).distinct("_id")

    if (attendanceIds.length > 0) {
        await AttendanceEntry.deleteMany({ attendance: { $in: attendanceIds } })
    }

    const deletedAttendance = await Attendance.deleteMany({ batch: batch._id })

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                {
                    deletedAttendanceCount: deletedAttendance.deletedCount || 0
                },
                "All attendance of batch deleted successfully"
            )
        )
})



export {
    // auth functions
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    getCurrentUser,
    changeCurrentUserPassword,

    // student functions
    registerStudent,
    bulkStudentsRegistration,
    deleteStudent,
    updateStudentDetails,

    // batch functions
    createBatch,
    deleteBatch,

    // student-batch functions
    changeStudentBatch,
    changeAllStudentsBatch,

    // subject functions
    createSubject,
    changeSubjectName,
    addStudentToSubject,
    deleteSubjectFromBatch,

    // unit functions
    addUnit,
    changeUnitName,
    deleteUnitFromSubject,

    // get functions
    getAllStudents,
    getStudentAttendanceHistoryForUser,
    getAllBatches,
    getAllStudentsOfBatch,
    getAllSubjectsOfBatch,
    getAllStudentsOfSubject,
    getAllUnitsOfSubject,


    // handle batch at year end
    deleteAllStudentsFromBatch,
    deleteAllAttendanceFromBatch
    
}
