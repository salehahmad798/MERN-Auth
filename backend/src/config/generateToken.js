import jwt from "jsonwebtoken";
import { redisClient } from "../../index.js";

// Generate both tokens and set them in cookies
export const generateToken = async (id, res) => {
  const accessToken = jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: "1m",
  });

  const refreshToken = jwt.sign({ id }, process.env.REFRESH_SECRET, {
    expiresIn: "7d",
  });

  // Store refresh token in Redis for 7 days
  const refreshKey = `refresh_token:${id}`;
  await redisClient.setEx(refreshKey, 7 * 24 * 60 * 60, refreshToken);

  // Set cookies
  res.cookie("accessToken", accessToken, {
    httpOnly: true,
    sameSite: "strict",
    // secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 1000, // 1 minute
  });

  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    sameSite: "strict",
    // secure: process.env.NODE_ENV === "production",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  return { accessToken, refreshToken };
};

export const verifyRefreshToken = async (refreshToken) => {
  try {
    const decoded = jwt.verify(refreshToken, process.env.REFRESH_SECRET);
    const stored = await redisClient.get(`refresh_token:${decoded.id}`);
    if (stored === refreshToken) return decoded;
    return null;
  } catch {
    return null;
  }
};

export const generateAccessToken = (id, res) => {
  const newAccessToken = jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: "1m",
  });

  res.cookie("accessToken", newAccessToken, {
    httpOnly: true,
    sameSite: "strict",
    // secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 1000,
  });

  return newAccessToken;
};

export const revokeRefreshToken = async (userId) => {
  await redisClient.del(`refresh_token:${userId}`);
};
