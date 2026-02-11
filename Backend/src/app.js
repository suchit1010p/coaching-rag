import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

const app = express();

app.use(cors({
    origin: ['http://localhost:8000', 'http://localhost:3000', 'http://localhost:5173'],
    credentials: true
}));

// limiting the request so that server can hold the load 
app.use(express.json({ limit: "16kb" }));
// encode url data and put it in object form  
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
// store static files in public
app.use(express.static("public"));

app.use(cookieParser());

// Import routes
import userRoute from "./routers/user.route.js";
import studentRoute from "./routers/student.route.js";
import materialRoute from "./routers/material.route.js";

// User routes (for teachers/admins)
app.use("/api/v1/users", userRoute);

// Student routes (for students)
app.use("/api/v1/students", studentRoute);

// Material routes
app.use("/api/v1/materials", materialRoute);

export { app };