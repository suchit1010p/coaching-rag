import "./src/config.js";
import serverlessHttp from "serverless-http";
import { app } from "./src/app.js";
import connectDB from "./src/db/db.js";

// Connect to MongoDB once when Lambda container starts (warm start reuses this)
let isConnected = false;

const connectIfNeeded = async () => {
    if (!isConnected) {
        await connectDB();
        isConnected = true;
    }
};

const serverlessHandler = serverlessHttp(app, {
    binary: [
        "application/octet-stream",
        "application/pdf",
        "image/*",
        "multipart/form-data"
    ]
});

export const handler = async (event, context) => {
    context.callbackWaitsForEmptyEventLoop = false;
    await connectIfNeeded();
    return serverlessHandler(event, context);
};
