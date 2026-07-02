const mongoose = require("mongoose");
const env = require("./env");

mongoose.set("strictQuery", true);

async function connectDB() {
    try {
        console.log("Connecting to MongoDB...");
        console.log("URI:", env.mongoUri);

        const conn = await mongoose.connect(env.mongoUri, {
            serverSelectionTimeoutMS: 10000,
        });

        console.log(`✅ MongoDB Connected`);
        console.log(`Host: ${conn.connection.host}`);
        console.log(`Database: ${conn.connection.name}`);

        mongoose.connection.on("error", (err) => {
            console.error("MongoDB Error:", err);
        });

        mongoose.connection.on("disconnected", () => {
            console.warn("MongoDB Disconnected");
        });

    } catch (err) {
        console.error("Connection Error:");
        console.error(err);
        throw err;
    }
}

module.exports = { connectDB };