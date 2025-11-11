import jwt from "jsonwebtoken";
import { redisClient } from "../../index.js";
import cookieParser from "cookie-parser";

export const generateToken = async (id, res) => {
  const accessToken = jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: "1m",
  });

  const refreshToken = jwt.sign({ id }, process.env.REFRESH_SECRET, {
    expiresIn: "7d",
  });

  const refreshTokenKey = `refresh_token:${id}`;

  await redisClient.setEx(refreshTokenKey, 7 * 24 * 60 * 60, refreshToken);

  res.cookie("accessToken", accessToken, {
    httpOnly: true, // only read for backend

    // secure: true,
    sameSite: "strict",
    maxAge: 1 * 60 * 1000,
  });
  res.cookie("refreshToken", refreshToken, {
    httpOnly: true, /// always true for refreshToken
    maxAge: 7 * 24 * 60 * 60 * 1000,
    sameSite: "none",

    // secure : true
  });

  return { accessToken, refreshToken };
};

export const verifyRefreshToken = async (refreshToken) => {
  try {
    const dedcode = jwt.verify(refreshToken, process.env.REFRESH_SECRET);

    const storedToken = await redisClient.get(`refresh_token:${dedcode.id}`);

    if (storedToken === refreshToken) {
      return dedcode;
    }
    return null;
  } catch (error) {
    return null;
  }
};

export const generateaccessToken = (id, res) => {
  const accessToken = jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: "1m",
  });

  res.cookie("accessToken", accessToken, {
    httpOnly: true,

    sameSite: "strict",
    maxAge: 1 * 60 * 1000,
  });
};
