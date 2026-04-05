import dotenv from "dotenv";
import path from "path";

// On AWS Lambda, environment variables are injected directly —
// there is no .env file on the filesystem.
// We only load .env locally (when NODE_ENV is not "production").
if (process.env.NODE_ENV !== "production") {
    const envPath = path.join(process.cwd(), ".env");
    dotenv.config({ path: envPath });
}

export default process.env;
