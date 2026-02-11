import { Material } from "../models/material.model.js";
import { Unit } from "../models/unit.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { generatePresignedUrl, deleteFromS3, generatePresignedGetUrl } from "../utils/s3.js";

// Get Presigned URL for Upload
const generateUploadUrl = asyncHandler(async (req, res) => {
    const { fileName, fileType, unitId } = req.body;

    if (!fileName || !fileType || !unitId) {
        throw new ApiError(400, "All fields (fileName, fileType, unitId) are required");
    }

    const unit = await Unit.findById(unitId);
    if (!unit) {
        throw new ApiError(404, "Unit not found");
    }

    // Generate a unique file name to avoid collisions
    // Structure: materials/unitId/timestamp-filename
    const key = `materials/${unitId}/${Date.now()}-${fileName}`;

    try {
        const url = await generatePresignedUrl(key, fileType);

        return res.status(200).json(
            new ApiResponse(200, { url, key }, "Presigned URL generated successfully")
        );
    } catch (error) {
        throw new ApiError(500, "Error generating upload URL");
    }
});

// Create Material Record (after successful S3 upload)
const createMaterial = asyncHandler(async (req, res) => {
    const { title, unitId, fileKey, fileType } = req.body;

    if (!title || !unitId || !fileKey || !fileType) {
        throw new ApiError(400, "All fields are required");
    }

    const unit = await Unit.findById(unitId);
    if (!unit) {
        throw new ApiError(404, "Unit not found");
    }

    const material = await Material.create({
        title,
        unit: unitId,
        fileUrl: fileKey, // Storing info as 'fileUrl' but it is the S3 Key
        fileType,
        uploadedBy: req.user?._id
    });

    return res.status(201).json(
        new ApiResponse(201, material, "Material created successfully")
    );
});

// Get Materials for a Unit
const getMaterialsByUnit = asyncHandler(async (req, res) => {
    const { unitId } = req.params;

    const materials = await Material.find({ unit: unitId }).populate("uploadedBy", "fullName email");

    // Generate Signed URLs for each material to allow access
    const materialsWithUrls = await Promise.all(materials.map(async (mat) => {
        const signedUrl = await generatePresignedGetUrl(mat.fileUrl);
        return {
            ...mat.toObject(),
            accessUrl: signedUrl
        };
    }));

    return res.status(200).json(
        new ApiResponse(200, materialsWithUrls, "Materials fetched successfully")
    );
});

// Delete Material
const deleteMaterial = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const material = await Material.findById(id);
    if (!material) {
        throw new ApiError(404, "Material not found");
    }

    // Delete from S3
    await deleteFromS3(material.fileUrl); // fileUrl stores the Key

    // Delete from DB
    await Material.findByIdAndDelete(id);

    return res.status(200).json(
        new ApiResponse(200, {}, "Material deleted successfully")
    );
});

export {
    generateUploadUrl,
    createMaterial,
    getMaterialsByUnit,
    deleteMaterial
};
