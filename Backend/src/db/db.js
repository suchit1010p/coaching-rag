import mongoose from "mongoose";
import { DB_NAME } from "../constants.js";

const connectDB = async () => {
    try {

        const connectionInstance = await mongoose.connect(`${process.env.MONGODB_URL}`, {
            dbName: process.env.DB_NAME
        })
        console.log(`\n MongoDB is connected !! `);

    } catch (error) {
        console.log("mongoDB connection error: ", error);
        process.exit(1);
    }
}

export default connectDB