import jwt from "jsonwebtoken";
import { redisClient } from "../../index.js";

export const generateToken = async (id) => {
  const accessToken = jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: "1m",
  });

  const refreshToken = jwt.sign({ id }, process.env.REFRESH_SECRET, {
    expiresIn: "7d",
  });

  // store refresh token in redis
  const refreshTokenKey = `refresh_token:${id}`;
  await redisClient.setEx(refreshTokenKey, 7 * 24 * 60 * 60, refreshToken);

  return { accessToken, refreshToken };
};

export const verifyRefreshToken = async (refreshToken) => {
  try {
    const decoded = jwt.verify(refreshToken, process.env.REFRESH_SECRET);

    const storedToken = await redisClient.get(`refresh_token:${decoded.id}`);

    if (storedToken === refreshToken) {
      return decoded;
    }
    return null;
  } catch {
    return null;
  }
};

export const generateAccessTokenOnly = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: "1m",
  });
};

// delete the refresh_token from redis
export const revokeRefreshToken = async (UserId) => {
  await redisClient.del(`refresh_token:${UserId}`);
};
