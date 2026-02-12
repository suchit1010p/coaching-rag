import { Router } from "express";
import {
    generateUploadUrl,
    createMaterial,
    getMaterialsByUnit,
    deleteMaterial,
    downloadMaterial
} from "../controllers/material.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { verifyUserOrStudent } from "../middlewares/auth.unified.middleware.js";

const router = Router();

router.post("/upload-url", verifyJWT, generateUploadUrl);
router.post("/", verifyJWT, createMaterial);
router.get("/unit/:unitId", verifyUserOrStudent, getMaterialsByUnit);
router.get("/download/:id", verifyUserOrStudent, downloadMaterial);
router.delete("/:id", verifyJWT, deleteMaterial);

export default router;
