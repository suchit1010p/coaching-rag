import { Router } from "express";
import {
    generateUploadUrl,
    createMaterial,
    getMaterialsByUnit,
    deleteMaterial
} from "../controllers/material.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

router.use(verifyJWT); // Apply authentication to all material routes

router.post("/upload-url", generateUploadUrl);
router.post("/", createMaterial);
router.get("/unit/:unitId", getMaterialsByUnit);
router.delete("/:id", deleteMaterial);

export default router;
