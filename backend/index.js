import express from "express";

import dotenv from "dotenv";

import connectDB from "./src/config/db.js";

import { createClient } from "redis"; //connected redis for the rate limit of user only in one min. to sent one verification code with the help of upstash


dotenv.config();

const redisUrl = process.env.REDIS_URL;

if (!redisUrl) {
  console.log("Missing redis Url ");
  process.exit(1);
}
export const redisClient = createClient({
  url: redisUrl,
});

redisClient
  .connect()
  .then(console.log("Connect Redis successfully"))
  .catch(console.error);

await connectDB();

const app = express();

// import middlewares
app.use(express.json());

// importing routes
import userRoutes from "./src/routes/user.route.js";

// using user route

app.use("/api/v1/", userRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
