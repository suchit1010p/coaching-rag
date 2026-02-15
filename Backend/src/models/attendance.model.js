import mongoose, { Schema } from "mongoose";

const attendanceSchema = new mongoose.Schema(
    {
        batch: {
            type: Schema.Types.ObjectId,
            ref: "Batch",
            required: true
        },
        subject: {
            type: Schema.Types.ObjectId,
            ref: "Subject",
            required: true
        },
        date: {
            type: Date,
            required: true
        },
        takenBy: {
            type: Schema.Types.ObjectId,
            ref: "User"
        }
    }, { timestamps: true }
);

attendanceSchema.index(
    { batch: 1, subject: 1, date: 1 },
    { unique: true }
);

export const Attendance = mongoose.model("Attendance", attendanceSchema);
