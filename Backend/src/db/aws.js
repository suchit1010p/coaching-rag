import { S3Client } from "@aws-sdk/client-s3";

// On Lambda, credentials and region are automatically provided
// via the execution role — no need to pass them explicitly.
// This also works locally if AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY
// are set in your .env file.

const s3 = new S3Client({
    region: process.env.AWS_REGION || "ap-south-1",
});

export default s3;