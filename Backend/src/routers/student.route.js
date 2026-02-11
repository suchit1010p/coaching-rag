import { Router } from "express";
import {
    loginStudent,
    logoutStudent,
    getStudentProfile,
    getStudentBatch,
    getStudentSubjects,
    getSubjectUnits,
    getUnitMaterials,
    getStudentAttendanceHistory
} from "../controllers/student.controller.js";
import { verifyStudentJWT } from "../middlewares/auth.student.middleware.js";
import { verifyUserOrStudent } from "../middlewares/auth.unified.middleware.js";

const router = Router();

// Public routes (no authentication required)
router.route("/login").post(loginStudent);

// Protected routes (student must be logged in)
router.route("/logout").post(verifyStudentJWT, logoutStudent);
router.route("/profile").get(verifyStudentJWT, getStudentProfile);
router.route("/batch").get(verifyStudentJWT, getStudentBatch);
router.route("/subjects").get(verifyStudentJWT, getStudentSubjects);
router.route("/attendance").get(verifyStudentJWT, getStudentAttendanceHistory);

// Shared routes (User or Student)
router.route("/subjects").post(verifyUserOrStudent, getSubjectUnits);
router.route("/units").post(verifyUserOrStudent, getUnitMaterials);

export default router;