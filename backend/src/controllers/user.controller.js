import TryCatch from "../middlewares/TryCatch.js";
import sanitize from "mongo-sanitize";
import { User } from "../models/user.model.js";
import { registerSchema } from "../utils/zod.js";
import { redisClient } from "../../index.js";
import bcrypt from 'bcrypt';

import crypto from 'crypto';
import sendMail from "../config/sendMail.js";
import { getVerifyEmailHtml } from "../config/html.js";

export const registerUser = TryCatch(async (req, res) => {
  //    const {name , email , password}  = sanitize(req.body);  /// to aviod the $ from hacker

  const cleandata = sanitize(req.body);
  const validation = registerSchema.safeParse(cleandata);

  if (!validation.success) {
    const zodError = validation.error;
    let firstErrorMessage = "validation Failed";
    let allErrors = [];
    if (zodError?.issues && Array.isArray(zodError.issues)) {
      allErrors = zodError.issues.map((issue) => ({
        field: issue.path ? issue.path.join(".") : "Unknown",
        message: issue.message || "validation Error",
        code: issue.code,
      }));

      firstErrorMessage = allErrors[0]?.message || "validation Error";
    }

    return res.status(400).json({
      message: firstErrorMessage,
      error: allErrors,
    });
  }
  const { name, email, password } = validation.data;

  const rateLimitKey = `register-rate-limit:${req.ip}:${email}`;

  if (await redisClient.get(rateLimitKey)) {
    return res.status(429).json({
      message: "Too many request , try any later",
    });
  }

const existingUser = await User.findOne({email});
if (existingUser) {
  return res.status(400).json({
    message : "User already exists",
  })
}

const hasdPassword = await bcrypt.hash(password , 10);

const verifyToken = crypto.randomBytes(32).toString('hex');

const verifyKey = `verify:${verifyToken}`;
const datatoStore = JSON.stringify({
  name,
  email,
  password:hasdPassword,
});

await redisClient.set(verifyKey , datatoStore ,{EX : 300}) // 300 second means to 5 mint.

const subject = 'verify your email account for creation ';
const html = getVerifyEmailHtml({email , token:verifyToken});

await sendMail({email , subject , html});

await redisClient.set(rateLimitKey ,"true", {EX : 60} ) // 60 second means one mint.

  //    res.json({
  //     name,
  //     email,
  //     password
  //    });

  console.log("Register request:", name, email, password);
  res
    .status(201)
    .json({
      message: "If your email is valid , a verification link has been sent . It will be expire in 5 minutes",
      
    });
});
