
import { PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import s3 from "../db/aws.js"; // Importing the client the user created

const generatePresignedUrl = async (fileName, fileType) => {
    try {
        const command = new PutObjectCommand({
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: fileName,
            ContentType: fileType,
        });

        // Expires in 600 seconds (10 minutes)
        const url = await getSignedUrl(s3, command, { expiresIn: 600 });
        return url;
    } catch (error) {
        console.error("Error generating presigned URL:", error);
        throw new Error("Could not generate presigned URL");
    }
};

const deleteFromS3 = async (fileUrl) => {
    try {
        if (!fileUrl) return;
        if (!String(fileUrl).startsWith("http")) {
            const command = new DeleteObjectCommand({
                Bucket: process.env.AWS_BUCKET_NAME,
                Key: decodeURIComponent(String(fileUrl)),
            });
            await s3.send(command);
            return true;
        }

        // Extract Key from URL
        // URL Format: https://bucket-name.s3.region.amazonaws.com/key
        // OR: https://s3.region.amazonaws.com/bucket-name/key

        let key = "";

        // Simple extraction based on standard S3 URL formats
        const urlObj = new URL(fileUrl);
        const pathParts = urlObj.pathname.split('/');

        // If path starts with /, split gives empty string as first element
        // We need the part after the bucket name or the domain

        // Strategy: Use the filename (last part) if we assume flat structure, 
        // but robustly we should handle folders if they exist.
        // For now, assuming standard structure where Key is the path.
        // However, if using Virtual-Hosted-Style (bucket.s3...): key is path (minus leading /)

        if (urlObj.hostname.startsWith(process.env.AWS_BUCKET_NAME)) {
            // https://bucket.s3.region.amazonaws.com/folder/file.jpg
            key = urlObj.pathname.substring(1); // remove leading /
        } else {
            // https://s3.region.amazonaws.com/bucket/folder/file.jpg
            // Remove first part (bucket name)
            key = urlObj.pathname.split('/').slice(2).join('/');
        }

        if (!key) {
            // Fallback
            key = pathParts[pathParts.length - 1];
        }

        // Decode Key (in case of %20 etc)
        key = decodeURIComponent(key);

        const command = new DeleteObjectCommand({
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: key,
        });

        await s3.send(command);
        return true;
    } catch (error) {
        console.error("Error deleting from S3:", error);
        // Don't throw, just log. Deletion failure shouldn't break the flow.
        return false;
    }
};


const generatePresignedGetUrl = async (fileKey) => {
    try {
        const command = new GetObjectCommand({
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: fileKey,
        });

        // Expires in 3600 seconds (1 hour)
        const url = await getSignedUrl(s3, command, { expiresIn: 3600 });
        return url;
    } catch (error) {
        console.error("Error generating presigned GET URL:", error);
        return null;
    }
};

export { generatePresignedUrl, deleteFromS3, generatePresignedGetUrl, uploadVerificationFile, deleteVerificationFile };

// Upload verification JSON to S3 and return a presigned GET URL (24h expiry)
const uploadVerificationFile = async (studentId, email) => {
    const key = `email-verifications/${studentId}.json`;
    const body = JSON.stringify({ studentId, email, createdAt: new Date().toISOString() });

    const putCommand = new PutObjectCommand({
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: key,
        Body: body,
        ContentType: "application/json",
    });

    await s3.send(putCommand);

    // Generate presigned GET URL that expires in 24 hours (86400 seconds)
    const getCommand = new GetObjectCommand({
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: key,
    });

    const presignedUrl = await getSignedUrl(s3, getCommand, { expiresIn: 86400 });
    return presignedUrl;
};

// Delete verification file from S3 after successful verification
const deleteVerificationFile = async (studentId) => {
    try {
        const key = `email-verifications/${studentId}.json`;
        const command = new DeleteObjectCommand({
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: key,
        });
        await s3.send(command);
        return true;
    } catch (error) {
        console.error("Error deleting verification file from S3:", error);
        return false;
    }
};
