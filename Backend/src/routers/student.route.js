import { Router } from "express";
import {
    loginStudent,
    logoutStudent,
    refreshStudentAccessToken,
    getStudentProfile,
    changeStudentPassword,
    getStudentBatch,
    getStudentSubjects,
    getSubjectUnits,
    getUnitMaterials,
    getStudentAttendanceHistory,
    verifyStudentEmail
} from "../controllers/student.controller.js";
import { verifyStudentJWT } from "../middlewares/auth.student.middleware.js";
import { verifyUserOrStudent } from "../middlewares/auth.unified.middleware.js";

const router = Router();

// Public routes (no authentication required)
router.route("/login").post(loginStudent);
router.route("/refresh-token").post(refreshStudentAccessToken);
router.route("/verify-email").get(verifyStudentEmail);

// Protected routes (student must be logged in)
router.route("/logout").post(verifyStudentJWT, logoutStudent);
router.route("/profile").get(verifyStudentJWT, getStudentProfile);
router.route("/change-password").patch(verifyStudentJWT, changeStudentPassword);
router.route("/batch").get(verifyStudentJWT, getStudentBatch);
router.route("/subjects").get(verifyStudentJWT, getStudentSubjects);
router.route("/attendance").get(verifyStudentJWT, getStudentAttendanceHistory);

// Shared routes (User or Student)
router.route("/subjects").post(verifyUserOrStudent, getSubjectUnits);
router.route("/units").post(verifyUserOrStudent, getUnitMaterials);

export default router;
