#!/usr/bin/env node
/**
 * Uploads your .env values to AWS SSM Parameter Store as SecureStrings.
 * Run once before first deploy:  node upload-secrets.mjs
 *
 * Prerequisites:
 *   - AWS CLI configured (aws configure)
 *   - .env file present in this directory
 */

import { SSMClient, PutParameterCommand } from "@aws-sdk/client-ssm";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const STAGE = process.argv[2] || "prod";
const REGION = process.argv[3] || "ap-south-1";
const PREFIX = `/bg-coaching/${STAGE}`;

// Keys from your .env that should be uploaded to SSM
const SECRET_KEYS = [
    "MONGODB_URL",
    "ACCESS_TOKEN_SECRET",
    "ACCESS_TOKEN_EXPIRY",
    "REFRESH_TOKEN_SECRET",
    "REFRESH_TOKEN_EXPIRY",
    "STUDENT_ACCESS_TOKEN_SECRET",
    "STUDENT_ACCESS_TOKEN_EXPIRY",
    "STUDENT_REFRESH_TOKEN_SECRET",
    "STUDENT_REFRESH_TOKEN_EXPIRY",
    "AWS_BUCKET_NAME",
    "AWS_ACCESS_KEY_ID",
    "AWS_SECRET_ACCESS_KEY",
    "SMTP_HOST",
    "SMTP_PORT",
    "SMTP_USER",
    "SMTP_PASS",
    "SENDER_EMAIL",
    "CORS_ORIGIN",
    "DB_NAME",
    "BACKEND_URL",
];

// Parse .env file
const parseEnv = (filePath) => {
    const content = readFileSync(filePath, "utf8");
    const result = {};
    for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIndex = trimmed.indexOf("=");
        if (eqIndex === -1) continue;
        const key = trimmed.slice(0, eqIndex).trim();
        const value = trimmed.slice(eqIndex + 1).trim().replace(/^["']|["']$/g, "");
        result[key] = value;
    }
    return result;
};

const main = async () => {
    const envPath = resolve(__dirname, ".env");
    console.log(`\nReading .env from: ${envPath}`);
    const env = parseEnv(envPath);

    const ssm = new SSMClient({ region: REGION });
    console.log(`Uploading secrets to SSM prefix: ${PREFIX}\n`);

    let uploaded = 0;
    let skipped = 0;

    for (const key of SECRET_KEYS) {
        const value = env[key];
        if (!value) {
            console.warn(`  SKIP  ${key}  (not found in .env)`);
            skipped++;
            continue;
        }

        const paramName = `${PREFIX}/${key}`;
        try {
            await ssm.send(new PutParameterCommand({
                Name: paramName,
                Value: value,
                Type: "SecureString",
                Overwrite: true,
            }));
            console.log(`  OK    ${paramName}`);
            uploaded++;
        } catch (err) {
            console.error(`  FAIL  ${paramName}: ${err.message}`);
        }
    }

    console.log(`\nDone. Uploaded: ${uploaded}, Skipped: ${skipped}`);
    console.log(`\nNext step: serverless deploy --stage ${STAGE}`);
};

main().catch((err) => {
    console.error("Fatal error:", err.message);
    process.exit(1);
});
