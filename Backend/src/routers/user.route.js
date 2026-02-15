import { Router } from "express";
import {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    getCurrentUser,
    registerStudent,
    deleteStudent,
    createBatch,
    deleteBatch,
    changeStudentBatch,
    changeAllStudentsBatch,
    createSubject,
    changeSubjectName,
    addStudentToSubject,
    deleteSubjectFromBatch,
    addUnit,
    changeUnitName,
    deleteUnitFromSubject,
    getAllStudents,
    getAllBatches,
    getAllStudentsOfBatch,
    getAllSubjectsOfBatch,
    getAllStudentsOfSubject,
    getAllUnitsOfSubject,
} from "../controllers/user.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router()

// User routes
router.route("/register").post(registerUser) //
router.route("/login").post(loginUser) 
router.route("/logout").post(verifyJWT, logoutUser)
router.route("/refreshToken").post(refreshAccessToken)
router.route("/refresh-token").post(refreshAccessToken)
router.route("/profile").get(verifyJWT, getCurrentUser)

// Student routes
router.route("/registerStudent").post(verifyJWT, registerStudent)
router.route("/deleteStudent").delete(verifyJWT, deleteStudent)

// Batch routes
router.route("/create/batch").post(verifyJWT, createBatch)
router.route("/delete/batch").delete(verifyJWT, deleteBatch) //
router.route("/change/student/changeBatch").patch(verifyJWT, changeStudentBatch)
router.route("/change/all/students/changeBatch").patch(verifyJWT, changeAllStudentsBatch) 

// Subject routes
router.route("/create/subject").post(verifyJWT, createSubject)
router.route("/change/subject/changeName").patch(verifyJWT, changeSubjectName)
router.route("/add/student/to/subject").post(verifyJWT, addStudentToSubject)
router.route("/delete/subject").delete(verifyJWT, deleteSubjectFromBatch)

// Unit routes
router.route("/add/unit").post(verifyJWT, addUnit)
router.route("/change/unit/changeName").patch(verifyJWT, changeUnitName)
router.route("/delete/unit").delete(verifyJWT, deleteUnitFromSubject)

// Get routes
router.route("/get/all/students").get(verifyJWT, getAllStudents)
router.route("/get/all/batches").get(verifyJWT, getAllBatches)
router.route("/get/all/students/of/batch").get(verifyJWT, getAllStudentsOfBatch)
router.route("/get/all/subjects/of/batch").get(verifyJWT, getAllSubjectsOfBatch)
router.route("/get/all/students/of/subject").get(verifyJWT, getAllStudentsOfSubject)
router.route("/get/all/units/of/subject").get(verifyJWT, getAllUnitsOfSubject)

export default router
