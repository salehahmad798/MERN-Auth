import mongoose from "mongoose";

const connectDB = async () => {
  try {
    const connectionInstance = await mongoose.connect(
      `${process.env.MONGODB_URI}/${process.env.DB_NAME}`
    );
    console.log(
      "Database connected successfully to",
      connectionInstance.connection.host
    );
  } catch (error) {
    console.error("Database connection error :", error);
    process.exit(1);
  }
};

export default connectDB;
