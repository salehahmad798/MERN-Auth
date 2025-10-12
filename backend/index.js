import express from "express";

import dotenv from "dotenv";

import connectDB from "./src/config/db.js";

dotenv.config();


await connectDB();

const app = express();

// import middlewares
app.use(express.json());

// importing routes
import userRoutes from "./src/routes/user.route.js";

// using user route

app.use("/api/v1/",userRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
