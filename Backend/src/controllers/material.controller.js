import { Material } from "../models/material.model.js";
import { Unit } from "../models/unit.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { generatePresignedUrl, deleteFromS3, generatePresignedGetUrl } from "../utils/s3.js";

const MIME_BY_EXTENSION = {
    pdf: "application/pdf",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ppt: "application/vnd.ms-powerpoint",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    txt: "text/plain",
    csv: "text/csv",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    gif: "image/gif",
    mp4: "video/mp4",
    mp3: "audio/mpeg",
    zip: "application/zip"
};

const inferMimeTypeFromFileName = (fileName) => {
    const extension = String(fileName || "").split(".").pop()?.toLowerCase();
    return MIME_BY_EXTENSION[extension] || "application/octet-stream";
};

const sanitizeFileName = (fileName) => {
    return String(fileName || "file")
        .trim()
        .replace(/\s+/g, "-")
        .replace(/[^a-zA-Z0-9._-]/g, "");
};

// Get Presigned URL for Upload
const generateUploadUrl = asyncHandler(async (req, res) => {
    const { fileName, unitId } = req.body;

    if (!fileName || !unitId) {
        throw new ApiError(400, "All fields (fileName, unitId) are required");
    }

    const unit = await Unit.findById(unitId);
    if (!unit) {
        throw new ApiError(404, "Unit not found");
    }

    const safeFileName = sanitizeFileName(fileName);
    const fileType = inferMimeTypeFromFileName(safeFileName);
    const key = `materials/${unitId}/${Date.now()}-${safeFileName}`;

    try {
        const url = await generatePresignedUrl(key, fileType);

        return res.status(200).json(
            new ApiResponse(200, { url, key, fileType }, "Presigned URL generated successfully")
        );
    } catch (error) {
        throw new ApiError(500, "Error generating upload URL");
    }
});

// Create Material Record (after successful S3 upload)
const createMaterial = asyncHandler(async (req, res) => {
    const { title, unitId, fileKey, fileType } = req.body;

    if (!title || !unitId || !fileKey) {
        throw new ApiError(400, "title, unitId and fileKey are required");
    }

    const unit = await Unit.findById(unitId);
    if (!unit) {
        throw new ApiError(404, "Unit not found");
    }

    if (!String(fileKey).startsWith(`materials/${unitId}/`)) {
        throw new ApiError(400, "Invalid file key for this unit");
    }

    const resolvedFileType = fileType || inferMimeTypeFromFileName(fileKey);

    const material = await Material.create({
        title: title.trim(),
        unit: unitId,
        fileUrl: fileKey,
        fileType: resolvedFileType,
        uploadedBy: req.user?._id
    });

    return res.status(201).json(
        new ApiResponse(201, material, "Material created successfully")
    );
});

// Get Materials for a Unit
const getMaterialsByUnit = asyncHandler(async (req, res) => {
    const { unitId } = req.params;
    if (!unitId) {
        throw new ApiError(400, "Unit ID is required");
    }

    const unit = await Unit.findById(unitId);
    if (!unit) {
        throw new ApiError(404, "Unit not found");
    }

    const materials = await Material.find({ unit: unitId })
        .sort({ createdAt: 1 })
        .populate("uploadedBy", "name email");

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
    await deleteFromS3(material.fileUrl);

    // Delete from DB
    await Material.findByIdAndDelete(id);

    return res.status(200).json(
        new ApiResponse(200, {}, "Material deleted successfully")
    );
});

// Download Material
const downloadMaterial = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const material = await Material.findById(id);
    if (!material) {
        throw new ApiError(404, "Material not found");
    }

    const url = await generatePresignedGetUrl(material.fileUrl);

    if (!url) {
        throw new ApiError(500, "Error generating download URL");
    }

    return res.status(200).json(
        new ApiResponse(200, { url }, "Download URL generated successfully")
    );
});

export {
    generateUploadUrl,
    createMaterial,
    getMaterialsByUnit,
    deleteMaterial,
    downloadMaterial
};
