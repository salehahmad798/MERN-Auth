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


/* ==================================================
    REGISTER USER
================================================== */
export const registerUser = TryCatch(async (req, res) => {
  const cleanData = sanitize(req.body);
  const validation = registerSchema.safeParse(cleanData);

  if (!validation.success) return handleZodError(validation, res);

  const { name, email, password } = validation.data;

  // ======== Rate Limit (1 request per minute per email/IP)
  const rateKey = `rl:register:${req.ip}:${email}`;
  if (await rateLimit(rateKey, 60, res, "Too many registration attempts, try again in 1 minute"))
    return;

  // ======= Check if user already exists
  const existingUser = await User.findOne({ email });
  if (existingUser)
    return res.status(400).json({ success: false, message: "User already exists" });

  // =========== Hash password
  const hashedPassword = await bcrypt.hash(password, 10);

  // ====== Create verification token (5 minutes)
  const verifyToken = crypto.randomBytes(32).toString("hex");
  const verifyKey = `verify:${verifyToken}`;
  const dataToStore = JSON.stringify({ name, email, password: hashedPassword });
  await redisClient.set(verifyKey, dataToStore, { EX: 300 });

  // ======== Send verification email
  const subject = "Verify Your Email";
  const html = getVerifyEmailHtml({ email, token: verifyToken });
  await sendMail({ email, subject, html });

  res.status(200).json({
    success: true,
    message:
      "Verification email sent. Please check your inbox. Link expires in 5 minutes.",
  });
});

/* ==================================================
    VERIFY EMAIL LINK
================================================== */
export const verifyUser = TryCatch(async (req, res) => {
  const { token } = req.params;
  const verifyKey = `verify:${token}`;

  const userData = await redisClient.get(verifyKey);
  if (!userData)
    return res.status(400).json({ success: false, message: "Verification link expired" });

  const { name, email, password } = JSON.parse(userData);

  // ====== Check if already verified
  const userExists = await User.findOne({ email });
  if (userExists)
    return res.status(400).json({ success: false, message: "User already verified" });

  await User.create({ name, email, password });
  await redisClient.del(verifyKey);

  res.status(201).json({
    success: true,
    message: "Email verified successfully. You can now log in.",
  });
});

/* ==================================================
    LOGIN (Send OTP)
================================================== */
export const loginUser = TryCatch(async (req, res) => {
  const clean = sanitize(req.body);
  const validation = loginSchema.safeParse(clean);
  if (!validation.success) return handleZodError(validation, res);

  const { email, password } = validation.data;

  // ======= Rate Limit login (per IP/email - 1 per 30 seconds)
  const rateKey = `rl:login:${req.ip}:${email}`;
  if (await rateLimit(rateKey, 30, res, "Too many login attempts, try again shortly"))
    return;

  // ========= Validate user
  const user = await User.findOne({ email });
  if (!user)
    return res.status(400).json({ success: false, message: "Invalid credentials" });

  const match = await bcrypt.compare(password, user.password);
  if (!match)
    return res.status(400).json({ success: false, message: "Invalid credentials" });

  // ========= Generate and store OTP (5 min)
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  await redisClient.set(`otp:${email}`, otp, { EX: 300 });

  // ======= Send OTP
  const subject = "Your OTP Code";
  const html = getOtpHtml({ email, otp });
  await sendMail({ email, subject, html });

  res.json({
    success: true,
    message: "OTP sent successfully. Valid for 5 minutes.",
  });
});

/* ==================================================
    VERIFY OTP → ISSUE TOKENS
================================================== */
export const verifyOtp = TryCatch(async (req, res) => {
  const clean = sanitize(req.body);
  const { email, otp } = clean;

  // ========== Rate Limit OTP verification (5 per minute)
  const rateKey = `rl:otp:${req.ip}:${email}`;
  if (await rateLimit(rateKey, 10, res, "Too many OTP attempts, try again later"))
    return;

  const storedOtp = await redisClient.get(`otp:${email}`);
  if (!storedOtp)
    return res.status(400).json({ success: false, message: "OTP expired" });
  if (storedOtp !== otp)
    return res.status(400).json({ success: false, message: "Invalid OTP" });

  await redisClient.del(`otp:${email}`);

  // ========== Issue tokens
  const user = await User.findOne({ email });
  if (!user)
    return res.status(404).json({ success: false, message: "User not found" });

  const { accessToken, refreshToken } = await generateToken(user._id, res);

  res.status(200).json({
    success: true,
    message: `Welcome ${user.name}`,
    accessToken,
    refreshToken,
    user: { id: user._id, name: user.name, email: user.email },
  });
});

/* ==================================================
    PROFILE (Protected)
================================================== */
export const myProfile = TryCatch(async (req, res) => {
  res.json({ success: true, user: req.user });
});

/* ==================================================
    REFRESH TOKEN
================================================== */
export const refreshToken = TryCatch(async (req, res) => {
  const refreshToken = req.cookies.refreshToken;
  if (!refreshToken)
    return res.status(401).json({ success: false, message: "No refresh token provided" });

  const decoded = await verifyRefreshToken(refreshToken);
  if (!decoded)
    return res.status(401).json({ success: false, message: "Invalid refresh token" });

  const newAccessToken = generateAccessToken(decoded.id, res);

  res.status(200).json({
    success: true,
    message: "Access token refreshed successfully",
    accessToken: newAccessToken,
  });
});

/* ==================================================
    LOGOUT
================================================== */
export const logoutUser = TryCatch(async (req, res) => {
  const userId = req.user._id;
  await revokeRefreshToken(userId);
  await redisClient.del(`user:${userId}`);

  res.clearCookie("accessToken");
  res.clearCookie("refreshToken");

  res.json({ success: true, message: "Logged out successfully" });
});


/* ==================================================
    Helper: Handle Zod Validation Errors
================================================== */
const handleZodError = (validation, res) => {
  const zodError = validation.error;
  const errors = zodError.issues.map((issue) => ({
    field: issue.path.join("."),
    message: issue.message,
  }));

  return res.status(400).json({
    success: false,
    message: errors[0]?.message || "Validation failed",
    errors,
  });
};

/* ==================================================
    Helper: Rate Limiter with Redis
================================================== */
const rateLimit = async (key, limitSeconds, res, message) => {
  const existing = await redisClient.get(key);
  if (existing) {
    res.status(429).json({ success: false, message });
    return true;
  }
  await redisClient.set(key, "true", { EX: limitSeconds });
  return false;
};

