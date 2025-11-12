import TryCatch from "../middlewares/TryCatch.js";
import sanitize from "mongo-sanitize";
import { User } from "../models/user.model.js";
import { registerSchema, loginSchema } from "../utils/zod.js";
import { redisClient } from "../../index.js";
import bcrypt from "bcrypt";
import crypto from "crypto";
import sendMail from "../config/sendMail.js";
import { getOtpHtml, getVerifyEmailHtml } from "../config/html.js";
import {
  generateToken,
  verifyRefreshToken,
  generateAccessToken,
  revokeRefreshToken,
} from "../config/generateToken.js";

/* ===============================
   REGISTER USER
=================================*/
export const registerUser = async (req, res) => {
  console.log("Register Controller called!");

  const cleanData = sanitize(req.body);
  const validation = registerSchema.safeParse(cleanData);

  if (!validation.success) {
    const zodError = validation.error;
    let firstErrorMessage = "Validation failed";
    let allErrors = [];

    if (zodError?.issues && Array.isArray(zodError.issues)) {
      allErrors = zodError.issues.map((issue) => ({
        field: issue.path ? issue.path.join(".") : "Unknown",
        message: issue.message || "Validation error",
      }));

      firstErrorMessage = allErrors[0]?.message || "Validation error";
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
      message: "Too many requests, try again later",
    });
  }

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return res.status(400).json({
      message: "User already exists",
    });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const verifyToken = crypto.randomBytes(32).toString("hex");
  const verifyKey = `verify:${verifyToken}`;
  const dataToStore = JSON.stringify({ name, email, password: hashedPassword });

  await redisClient.set(verifyKey, dataToStore, { EX: 300 }); // 5 min

  const subject = "Verify your email account";
  const html = getVerifyEmailHtml({ email, token: verifyToken });

  await sendMail({ email, subject, html });
  await redisClient.set(rateLimitKey, "true", { EX: 60 }); // 1 min

  res.json({
    message:
      "If your email is valid, a verification link has been sent. It will expire in 5 minutes.",
  });
};

/* ===============================
   VERIFY EMAIL LINK
=================================*/
export const verifyUser = TryCatch(async (req, res) => {
  const { token } = req.params;
  const verifyKey = `verify:${token}`;
  const userData = await redisClient.get(verifyKey);

  if (!userData)
    return res.status(400).json({ message: "Verification link expired" });

  const { name, email, password } = JSON.parse(userData);
  const userExists = await User.findOne({ email });
  if (userExists)
    return res.status(400).json({ message: "User already verified" });

  await User.create({ name, email, password });
  await redisClient.del(verifyKey);

  res.status(201).json({
    message: "Email verified successfully. You can now log in.",
  });
});

/* ===============================
   LOGIN → SEND OTP
=================================*/
export const loginUser = TryCatch(async (req, res) => {
  const clean = sanitize(req.body);
  const validation = loginSchema.safeParse(clean);

  if (!validation.success) {
    return res.status(400).json({ message: "Validation failed" });
  }

  const { email, password } = validation.data;
  const user = await User.findOne({ email });
  if (!user) return res.status(400).json({ message: "Invalid credentials" });

  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.status(400).json({ message: "Invalid credentials" });

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  await redisClient.set(`otp:${email}`, otp, { EX: 300 }); // 5 min

  const subject = "Your OTP Code";
  const html = getOtpHtml({ email, otp });
  await sendMail({ email, subject, html });

  res.json({ message: "OTP sent. Valid for 5 minutes." });
});

/* ===============================
   VERIFY OTP → ISSUE TOKENS
=================================*/
export const verifyOtp = TryCatch(async (req, res) => {
  const { email, otp } = req.body;
  const storedOtp = await redisClient.get(`otp:${email}`);

  if (!storedOtp) return res.status(400).json({ message: "OTP expired" });
  if (storedOtp !== otp)
    return res.status(400).json({ message: "Invalid OTP" });

  await redisClient.del(`otp:${email}`);

  const user = await User.findOne({ email });
  const { accessToken, refreshToken } = await generateToken(user._id, res);

  res.status(200).json({
    message: `Welcome ${user.name}`,
    accessToken,
    refreshToken,
    user,
  });
});

/* ===============================
   PROFILE (Protected)
=================================*/
export const myProfile = TryCatch(async (req, res) => {
  res.json({ user: req.user });
});

/* ===============================
   REFRESH TOKEN
=================================*/
export const refreshToken = TryCatch(async (req, res) => {
  const refreshToken = req.cookies.refreshToken;
  if (!refreshToken)
    return res.status(401).json({ message: "No refresh token" });

  const decoded = await verifyRefreshToken(refreshToken);
  if (!decoded)
    return res.status(401).json({ message: "Invalid refresh token" });

  const newAccessToken = generateAccessToken(decoded.id, res);

  res.status(200).json({
    message: "Access token refreshed",
    accessToken: newAccessToken,
  });
});

/* ===============================
   LOGOUT
=================================*/
export const logoutUser = TryCatch(async (req, res) => {
  const userId = req.user._id;

  await revokeRefreshToken(userId);
  await redisClient.del(`user:${userId}`);

  res.clearCookie("accessToken");
  res.clearCookie("refreshToken");

  res.json({ message: "Logged out successfully" });
});
