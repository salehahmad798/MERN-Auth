import TryCatch from "../middlewares/TryCatch.js";
import sanitize from "mongo-sanitize";
import { User } from "../models/user.model.js";
import { registerSchema, loginSchema } from "../utils/zod.js";
import { redisClient } from "../../index.js";
import bcrypt from "bcrypt";

import crypto from "crypto";
import sendMail from "../config/sendMail.js";
import { getOtpHtml, getVerifyEmailHtml } from "../config/html.js";
import { _discriminatedUnion } from "zod/v4/core";
import { generateToken } from "../config/generateToken.js";

export const registerUser = TryCatch(async (req, res) => {
  console.log("Register Controller called!");

  //    const {name , email , password}  = sanitize(req.body);  /// to aviod the $ from hacker

  const cleandata = sanitize(req.body);
  const validation = registerSchema.safeParse(cleandata);
  console.log(validation);

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

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return res.status(400).json({
      message: "User already exists",
    });
  }

  const hasdPassword = await bcrypt.hash(password, 10);

  const verifyToken = crypto.randomBytes(32).toString("hex");

  const verifyKey = `verify:${verifyToken}`;
  const datatoStore = JSON.stringify({
    name,
    email,
    password: hasdPassword,
  });

  await redisClient.set(verifyKey, datatoStore, { EX: 300 }); // 300 second means to 5 mint.

  const subject = "verify your email account for creation ";
  const html = getVerifyEmailHtml({ email, token: verifyToken });

  await sendMail({ email, subject, html });

  await redisClient.set(rateLimitKey, "true", { EX: 60 }); // 60 second means one mint.

  //    res.json({
  //     name,
  //     email,
  //     password
  //    });

  // console.log("Register request:", name, email, password);
  res.json({
    message:
      "If your email is valid , a verification link has been sent . It will be expire in 5 minutes",
  });
});

export const verifyUser = TryCatch(async (req, res) => {
  const { token } = req.params;

  if (!token) {
    return res.status(400).json({
      message: "verification token is required",
    });
  }
  const verifyKey = `verify:${token}`;

  const userDataJson = await redisClient.get(verifyKey);

  if (!userDataJson) {
    return res.status(400).json({
      message: "verification link is expired.",
    });
  }

  await redisClient.del(verifyKey);

  const userData = JSON.parse(userDataJson);

  const existingUser = await User.findOne({ email: userData.email });
  if (existingUser) {
    return res.status(400).json({
      message: "User already exists",
    });
  }

  const newUser = await User.create({
    name: userData.name,
    email: userData.email,
    password: userData.password,
  });

  res.status(201).json({
    message: "Email verified successfully! your account has been created",
    user: { _id: newUser._id, name: newUser.name, password: newUser.password },
  });
});

export const loginUser = TryCatch(async (req, res) => {
  const cleandata = sanitize(req.body);
  const validation = loginSchema.safeParse(cleandata);
  console.log(validation);

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
  const { email, password } = validation.data;

  const rateLimitKey = `login-rate-limit:${req.ip}:${email}`;

  if (await redisClient.get(rateLimitKey)) {
    return res.status(429).json({
      message: "Too many requests, try again later",
    });
  }

  const user = await User.findOne({ email });

  if (!user) {
    return res.status(400).json({
      message: "Invailid credentials",
    });
  }

  const comparePassword = await bcrypt.compare(password, user.password);
  if (!comparePassword) {
    return res.status(400).json({
      message: "Invailid credentials",
    });
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  const otpKey = `otp:${email}`;

  await redisClient.set(otpKey, JSON.stringify(otp), { EX: 300 });

  const subject = "Otp for verification";

  const html = getOtpHtml({ email, otp });

  await sendMail({ email, subject, html });

  await redisClient.set(rateLimitKey, "true", { EX: 60 });

  res.json({
    message:
      "If Email is vaild , otp has been sent. It will be vaild for 5 mint.",
  });
});

export const verifyOtp = TryCatch(async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({
      message: "Please provide all details",
    });
  }

  const otpKey = `otp:${email}`;

  const storeOtpString = await redisClient.get(otpKey);

  if (!storeOtpString) {
    return res.status(400).json({
      message: "otp expired",
    });
  }

  const storeOtp = JSON.parse(storeOtpString);

  if (storeOtp !== otp) {
    return res.status(400).json({
      message: "Invailid Otp",
    });
  }

  await redisClient.del(otpKey);

  const user = await User.findOne({ email });

  const tokenData = await generateToken(user._id, res);

  res.status(200).json({
    message: `Welcome ${user.name}`,
    user,
  });
});


export const myProfile = TryCatch(async (req , res)=>{
  const user = req.user;
  res.json(user);
})