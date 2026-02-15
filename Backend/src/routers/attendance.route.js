import { Router } from "express";
import {
    createAttendance,
    markAttendance,
    getAttendanceById,
    getAllAttendance,
    updateAttendanceEntry,
    deleteAttendance,
    getAttendanceReport
} from "../controllers/attendance.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

// All attendance routes require authentication
router.use(verifyJWT);

// Create new attendance session
router.route("/create").post(createAttendance);

// Mark attendance for students
router.route("/mark").post(markAttendance);

// Get attendance by ID
router.route("/attendance").get(getAttendanceById);

// Get all attendance sessions (with optional filters)
router.route("/list").get(getAllAttendance);

// Update single attendance entry
router.route("/update-entry").patch(updateAttendanceEntry);

// Delete attendance session
router.route("/delete").delete(deleteAttendance);

// Get attendance report
router.route("/report").get(getAttendanceReport);

export default router;
